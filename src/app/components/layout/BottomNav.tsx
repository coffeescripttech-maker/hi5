/**
 * Mobile bottom tab bar — native-app style navigation for phones.
 *
 * Shows Dashboard + the next top items for the role (RBAC-filtered by the
 * parent Layout). Hidden on md+ where the desktop sidebar takes over. The
 * off-canvas drawer (Sidebar) still provides the full menu via the hamburger.
 *
 * z-20 keeps it BELOW the mobile drawer overlay (z-30), so opening the drawer
 * naturally covers the tab bar. `pb-safe` clears the home-indicator inset.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import type { NavItem } from '../../navigation';

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const { role } = useApp();
  const accent = useRoleAccent();
  const navigate = useNavigate();
  const location = useLocation();

  if (!role) return null;

  // Dashboard is first for every role; the next three are the most-used tools.
  const visible = items.slice(0, 4);

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 bg-white/95 pb-safe backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                active
                  ? accent.text
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}>
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 2}
                className="flex-shrink-0"
              />
              <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
