/**
 * Role sidebar — brand header, RBAC-filtered nav groups, user + logout footer.
 *
 * Preserves the dark role gradient brand surface and exact-path active
 * matching from the original shell. The collapse state is applied with
 * `md:`-prefixed classes so that below 768px the mobile drawer always renders
 * full labels regardless of the desktop state, while 768px+ honors the
 * 'full' / 'icons' / 'hidden' mode. Icon-only mode gets focus-accessible
 * tooltips (see Tooltip.tsx).
 */
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRoleAccent } from '../../utils/roleTheme';
import { ROLE_LABELS, type NavGroup, type Role } from '../../navigation';
import { ROLE_BADGE_COLORS, ROLE_GRADIENTS, ROLE_ICONS } from './role-maps';
import { Tooltip } from './Tooltip';
import logoImage from '../../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png';

export type SidebarState = 'full' | 'icons' | 'hidden';

interface SidebarProps {
  navGroups: NavGroup[];
  sidebarState: SidebarState;
  mobileSidebarOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  navGroups,
  sidebarState,
  mobileSidebarOpen,
  onCloseMobile
}: SidebarProps) {
  const { role, username, profilePhoto, logout, schoolName, schoolYearLabel } =
    useApp();
  const accent = useRoleAccent();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  const isIcons = sidebarState === 'icons';
  const isHidden = sidebarState === 'hidden';

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Focus the first nav item when the mobile drawer opens, and close on Escape.
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const first = navRef.current?.querySelector<HTMLElement>(
      'button[data-nav-item]'
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileSidebarOpen, onCloseMobile]);

  if (!role) return null;
  const roleKey = role as Role;
  const displayName = (username.split(' – ')[0] || username).trim() || username;
  const initials = displayName.charAt(0).toUpperCase() || '?';
  const RoleIcon = ROLE_ICONS[roleKey];

  return (
    <aside
      aria-label="Sidebar navigation"
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b ${ROLE_GRADIENTS[roleKey]} text-white shadow-xl transition-all duration-300 md:static ${
        mobileSidebarOpen
          ? 'translate-x-0'
          : '-translate-x-full md:translate-x-0'
      } ${
        isHidden
          ? 'md:w-0 md:overflow-hidden md:opacity-0 md:pointer-events-none'
          : isIcons
            ? 'w-64 md:w-16'
            : 'w-64'
      }`}>
      {/* Soft top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent opacity-60" />

      {/* Brand */}
      <div
        className={`relative flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/10 px-4 ${
          isIcons ? 'md:justify-center md:px-2' : ''
        }`}>
        <div
          className={`flex-shrink-0 overflow-hidden rounded-xl border-2 border-white/30 bg-white/10 shadow-sm ${
            isIcons ? 'h-9 w-9' : 'h-10 w-10'
          }`}>
          <img
            src={logoImage}
            alt="Hi5 Portal"
            className="h-full w-full object-contain p-0.5"
          />
        </div>
        <div className={`min-w-0 ${isIcons ? 'md:hidden' : ''}`}>
          <p className="font-heading text-sm font-bold leading-tight text-white">
            Hi5 Portal
          </p>
          <p className="truncate text-[11px] leading-tight text-white/60">
            {schoolName || 'DSPMNHS'}
          </p>
          <p className="text-[11px] leading-tight text-white/50">
            SY {schoolYearLabel || '2025–2026'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav
        ref={navRef}
        className="app-scroll sidebar-scroll relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="space-y-6">
          {navGroups.map(group => (
            <div key={group.group}>
              {isIcons ? (
                <>
                  <p className="mb-2 select-none px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 md:hidden">
                    {group.group}
                  </p>
                  <div className="mx-2 mb-2 hidden h-px bg-white/10 md:block" />
                </>
              ) : (
                <p className="mb-2 select-none px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  {group.group}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  const button = (
                    <button
                      data-nav-item
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        navigate(item.path);
                        onCloseMobile();
                      }}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                        isIcons
                          ? 'md:h-11 md:w-11 md:justify-center md:px-0 md:mx-auto'
                          : ''
                      } ${
                        active
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}>
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                          style={{ backgroundColor: accent.chartHex }}
                        />
                      )}
                      <Icon
                        size={20}
                        className={`flex-shrink-0 transition-colors duration-200 ${
                          active
                            ? 'text-white'
                            : 'text-white/50 group-hover:text-white'
                        }`}
                      />
                      <span
                        className={`flex-1 truncate text-left ${
                          isIcons ? 'md:hidden' : ''
                        }`}>
                        {item.label}
                      </span>
                    </button>
                  );
                  return (
                    <li key={item.path}>
                      {isIcons ? (
                        <Tooltip label={item.label}>{button}</Tooltip>
                      ) : (
                        button
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer: user + logout */}
      <div className="relative flex-shrink-0 border-t border-white/10 p-3">
        {/* Full variant (mobile drawer + 'full' desktop mode) */}
        <div className={`space-y-1 ${isIcons ? 'md:hidden' : ''}`}>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${ROLE_BADGE_COLORS[roleKey]} shadow-sm`}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-white/60">
                <RoleIcon size={11} className="flex-shrink-0" />
                {ROLE_LABELS[roleKey]}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
            <LogOut size={18} className="flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>

        {/* Compact variant (icons desktop mode) */}
        <div
          className={`hidden flex-col items-center gap-2 ${
            isIcons ? 'md:flex' : ''
          }`}>
          <Tooltip label={displayName}>
            <div
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ${ROLE_BADGE_COLORS[roleKey]} shadow-sm`}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">{initials}</span>
              )}
            </div>
          </Tooltip>
          <Tooltip label="Logout">
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              <LogOut size={18} />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
