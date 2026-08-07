/**
 * Top navigation bar.
 *
 * Neutral surface (white / slate in dark mode) with the role color used only
 * for accents — breadcrumb highlight, focus rings and the notification badge.
 * Left: mobile hamburger + desktop collapse toggle + breadcrumb/title.
 * Center: global search trigger (⌘K hint) on desktop.
 * Right: mobile search icon, quick actions, notifications, theme toggle,
 * profile dropdown.
 */
import React, { useState } from 'react';
import {
  ChevronRight,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import type { NavGroup } from '../../navigation';
import type { SidebarState } from './Sidebar';
import { QuickActions } from './QuickActions';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ProfileDropdown } from './ProfileDropdown';
import { SearchCommand } from './SearchCommand';

interface TopBarProps {
  navGroups: NavGroup[];
  currentLabel: string;
  breadcrumbLabel: string;
  sidebarState: SidebarState;
  onCycleSidebar: () => void;
  onOpenMobile: () => void;
}

export function TopBar({
  navGroups,
  currentLabel,
  breadcrumbLabel,
  sidebarState,
  onCycleSidebar,
  onOpenMobile
}: TopBarProps) {
  const { darkMode, toggleDarkMode } = useApp();
  const accent = useRoleAccent();
  const [searchOpen, setSearchOpen] = useState(false);

  const isHidden = sidebarState === 'hidden';
  const isIcons = sidebarState === 'icons';
  const ringClass = `focus-visible:ring-2 ${accent.ring}`;

  return (
    <>
      <header className="relative z-40 flex h-16 flex-shrink-0 items-center gap-2 border-b border-gray-200/70 bg-white/80 px-3 backdrop-blur md:gap-3 md:px-5 dark:border-slate-700/60 dark:bg-slate-900/80">
        {/* Mobile hamburger */}
        <button
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          aria-expanded="false"
          className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 ${ringClass}`}>
          <Menu size={22} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={onCycleSidebar}
          aria-label={
            isHidden
              ? 'Show sidebar'
              : isIcons
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          aria-expanded={!isHidden}
          title={
            isHidden
              ? 'Show sidebar'
              : isIcons
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          className={`hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 md:inline-flex dark:text-slate-400 dark:hover:bg-slate-800 ${ringClass}`}>
          {isHidden ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        {/* Breadcrumb + page title */}
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-1.5 text-[11px] font-medium text-gray-400 sm:flex dark:text-slate-500">
            <span className="truncate">Home</span>
            <ChevronRight size={11} className="flex-shrink-0" />
            <span className="truncate" style={{ color: accent.chartHex }}>
              {breadcrumbLabel}
            </span>
          </nav>
          <h1 className="truncate text-base font-bold leading-tight text-gray-800 dark:text-slate-100">
            {currentLabel}
          </h1>
        </div>

        {/* Center search (desktop) */}
        <div className="mx-auto hidden w-full max-w-md flex-1 px-2 lg:block">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search students or pages"
            className={`flex w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 ${ringClass}`}>
            <Search size={15} className="flex-shrink-0" />
            <span className="flex-1 truncate text-left">
              Search students, pages…
            </span>
            <kbd className="hidden items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 sm:flex dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1 md:gap-1.5">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search students or pages"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 ${ringClass}`}>
            <Search size={20} />
          </button>

          <QuickActions navGroups={navGroups} />

          <NotificationsDropdown />

          <button
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 lg:h-10 lg:w-10 dark:text-slate-400 dark:hover:bg-slate-800 ${ringClass}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <ProfileDropdown />
        </div>
      </header>

      <SearchCommand
        navGroups={navGroups}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}
