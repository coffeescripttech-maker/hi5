/**
 * Quick actions dropdown — a small set of role-relevant shortcuts.
 *
 * Items are looked up in the already RBAC-filtered `navGroups` by their
 * stable menu `key` (see navigation.ts / server permissions), so every action
 * points to an existing route and disappears automatically if the admin
 * disabled that module for the role.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '../ui/dropdown-menu';
import type { NavGroup, NavItem, Role } from '../../navigation';

const QUICK_KEYS: Record<Role, string[]> = {
  admin: ['admin_users', 'admin_settings', 'admin_forms_sf1', 'admin_logs'],
  teacher: ['teacher_enroll', 'teacher_grades', 'teacher_my_students', 'teacher_upload'],
  registrar: ['registrar_students', 'registrar_forms_sf1', 'registrar_section_assignment', 'registrar_reports'],
  principal: ['principal_enrollment', 'principal_sections', 'principal_grades', 'principal_atrisk']
};

export function QuickActions({ navGroups }: { navGroups: NavGroup[] }) {
  const { role } = useApp();
  const navigate = useNavigate();

  if (!role) return null;
  const roleKey = role as Role;
  const items = navGroups.flatMap(g => g.items);
  const quick = QUICK_KEYS[roleKey]
    .map(key => items.find(i => i.key === key))
    .filter((i): i is NavItem => !!i);

  if (quick.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Quick actions"
          aria-haspopup="menu"
          className="hidden h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:inline-flex lg:h-10 lg:w-10 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <Plus size={20} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quick.map(item => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.key} onSelect={() => navigate(item.path)}>
              <Icon />
              <span className="truncate">{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
