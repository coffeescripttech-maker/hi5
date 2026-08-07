/**
 * Autocomplete student search used by both certificate pages.
 *
 * Same suggestion pattern as StudentSearch and the global command palette:
 * debounced `studentsApi.list({ search })` with a dropdown of matches.
 * Picking a suggestion fills the input and reports the StudentRow upward so
 * the page can call the certificate API for that student.
 */
import React, { useEffect, useRef, useState } from "react";
import { Search, X, ChevronRight } from "lucide-react";
import { studentsApi, StudentRow } from "../../services/students";
import { useRoleAccent } from "../../utils/roleTheme";

interface Props {
  /** Called with the student the user picked from the suggestions. */
  onPick: (student: StudentRow) => void;
  /** While true, the input shows a spinner instead of the clear button. */
  busy?: boolean;
}

export function CertificateStudentSearch({ onPick, busy }: Props) {
  const accent = useRoleAccent();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StudentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await studentsApi.list({ search: q });
        setSuggestions((Array.isArray(res) ? res : []).slice(0, 6));
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (s: StudentRow) => {
    setQuery(s.name);
    setOpen(false);
    onPick(s);
  };

  const onEnter = () => {
    if (suggestions.length > 0) pick(suggestions[0]);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <Search
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="Search student by name, LRN, or Student ID…"
        className={`w-full bg-white py-2.5 pl-10 pr-9 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${accent.ring} transition-all`}
      />
      {searching ? (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
        </span>
      ) : (
        query && (
          <button
            onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 transition hover:text-gray-500"
            aria-label="Clear search">
            <X size={16} />
          </button>
        )
      )}

      {open && suggestions.length > 0 && (
        <div className="animate-scale-in absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50">
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-gray-50">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-xs font-bold text-indigo-700 shadow-sm">
                {s.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-mono">{s.lrn}</span> · Grade {s.grade_level} ·{" "}
                  {s.sex === "male" ? "Male" : "Female"}
                </p>
              </div>
              <ChevronRight size={14} className="flex-shrink-0 text-gray-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
