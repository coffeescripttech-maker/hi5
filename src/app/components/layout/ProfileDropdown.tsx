/**
 * User profile dropdown (avatar → Profile / Settings / Logout).
 *
 * Built on the Radix `ui/dropdown-menu` primitives (focus, arrow keys and
 * Escape handled for free). Profile points to the role's existing profile
 * route (`/{role}/profile` — present for every role); Settings appears only
 * for admin because no other role has a settings route.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { ROLE_LABELS, type Role } from '../../navigation';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '../ui/dropdown-menu';

function initialsFor(username: string): string {
  const name = (username.split(' – ')[0] || username).trim();
  return name.charAt(0).toUpperCase() || '?';
}

export function ProfileDropdown() {
  const { role, username, profilePhoto, logout } = useApp();
  const accent = useRoleAccent();
  const navigate = useNavigate();

  if (!role) return null;
  const roleKey = role as Role;
  const displayName = (username.split(' – ')[0] || username).trim() || username;
  const initials = initialsFor(username);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          aria-haspopup="menu"
          className="flex h-11 items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-gray-100 lg:h-10 lg:px-2 dark:hover:bg-slate-800">
          <Avatar className="size-8">
            {profilePhoto && <AvatarImage src={profilePhoto} alt={displayName} />}
            <AvatarFallback
              className="text-xs font-bold text-white"
              style={{ backgroundColor: accent.chartHex }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 xl:block dark:text-slate-200">
            {displayName}
          </span>
          <ChevronDown size={14} className="hidden text-gray-400 xl:block dark:text-slate-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 font-normal">
          <Avatar className="size-9">
            {profilePhoto && <AvatarImage src={profilePhoto} alt={displayName} />}
            <AvatarFallback
              className="text-sm font-bold text-white"
              style={{ backgroundColor: accent.chartHex }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
              {displayName}
            </p>
            <p className="truncate text-xs" style={{ color: accent.chartHex }}>
              {ROLE_LABELS[roleKey]}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/${roleKey}/profile`)}>
          <User /> Profile
        </DropdownMenuItem>
        {roleKey === 'admin' && (
          <DropdownMenuItem onSelect={() => navigate('/admin/settings')}>
            <Settings /> Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
