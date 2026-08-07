/**
 * Global command palette (⌘K / Ctrl+K).
 *
 * Searches the role's menu pages (RBAC-filtered nav groups passed in from the
 * shell) and student records via `studentsApi.list({ search })` — name / LRN /
 * student ID — and navigates to the matching page or `/student/:id`.
 * Built on the existing cmdk primitives (`ui/command.tsx`), which provide the
 * overlay dialog, autofocus, escape/backdrop close and arrow-key navigation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { studentsApi, type StudentRow } from '../../services/students';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator
} from '../ui/command';
import type { NavGroup } from '../../navigation';

interface SearchCommandProps {
  navGroups: NavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCommand({
  navGroups,
  open,
  onOpenChange
}: SearchCommandProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pages = navGroups.flatMap(g => g.items);

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Reset the query whenever the palette is closed.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setStudents([]);
      setLoading(false);
    }
  }, [open]);

  // Debounced student search (server-side LIKE on name / LRN / student_id).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      studentsApi
        .list({ search: q })
        .then(res => setStudents(res))
        .catch(() => setStudents([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const canSearchStudents = query.trim().length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Search"
      description="Search for a page or student">
      <CommandInput
        placeholder="Search students or pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map(item => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.key}
                value={`${item.label} ${item.key}`}
                onSelect={() => go(item.path)}>
                <Icon />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Students">
          {!canSearchStudents ? (
            <CommandItem disabled>
              Type at least 2 characters to search students
            </CommandItem>
          ) : loading ? (
            <CommandItem disabled>Searching students…</CommandItem>
          ) : students.length === 0 ? (
            <CommandItem disabled>No students found.</CommandItem>
          ) : (
            students.slice(0, 8).map(s => (
              <CommandItem
                key={s.id}
                value={`${s.name} ${s.lrn} ${s.student_id}`}
                onSelect={() => go(`/student/${s.id}`)}>
                <GraduationCap />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.lrn || s.student_id} · Gr.{s.grade_level}
                  </span>
                </div>
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
