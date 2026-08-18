/**
 * App shell — sidebar + top navigation bar + routed page content.
 *
 * Slim orchestrator: owns auth guard, RBAC filtering, sidebar visibility
 * state and the access-denied screen; delegates rendering to the modular
 * `layout/` components. Business logic (guards, RBAC, exact-path active
 * matching, logout) is unchanged from the original shell.
 */
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRoleAccent } from '../utils/roleTheme';
import { NAV_BY_ROLE, type Role } from '../navigation';
import { rbacApi } from '../services/rbac';
import { Sidebar, type SidebarState } from './layout/Sidebar';
import { TopBar } from './layout/TopBar';
import { BottomNav } from './layout/BottomNav';

export function Layout() {
  const { role, darkMode } = useApp();
  const accent = useRoleAccent();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebar, setDesktopSidebar] = useState<SidebarState>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches
      ? 'full'
      : 'icons'
  );
  const [allowedKeys, setAllowedKeys] = useState<Set<string> | null>(null);

  const cycleDesktopSidebar = () => {
    setDesktopSidebar(prev =>
      prev === 'full' ? 'icons' : prev === 'icons' ? 'hidden' : 'full'
    );
  };

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!role) navigate('/login', { replace: true });
  }, [role, navigate]);

  // Load this role's enabled menu keys to filter the sidebar and guard
  // direct-URL access to disabled modules. Admin always has full access.
  useEffect(() => {
    if (!role) return;
    if (role === 'admin') {
      setAllowedKeys(null); // admin always has full access
      return;
    }
    let cancelled = false;
    rbacApi
      .myAccess()
      .then(res => {
        if (!cancelled) setAllowedKeys(new Set(res.menu_keys));
      })
      .catch(err => {
        // Fail open — a down API must never lock a user out of the app.
        console.warn('Failed to load access permissions:', err);
        if (!cancelled) setAllowedKeys(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (!role) return null;

  const roleKey = role as Role;
  const fullNavGroups = NAV_BY_ROLE[roleKey];
  const fullNavItems = fullNavGroups.flatMap(g => g.items);
  const canAccess = (key: string) =>
    role === 'admin' || (allowedKeys ? allowedKeys.has(key) : true);
  const navGroups = fullNavGroups
    .map(g => ({ ...g, items: g.items.filter(item => canAccess(item.key)) }))
    .filter(g => g.items.length > 0);
  const bottomNavItems = navGroups.flatMap(g => g.items);

  const isActive = (path: string) => location.pathname === path;
  const currentNavItem = fullNavItems.find(n => isActive(n.path));
  const accessDenied =
    role !== 'admin' &&
    !!currentNavItem &&
    !(allowedKeys ? allowedKeys.has(currentNavItem.key) : true);
  const currentLabel = currentNavItem?.label || 'Dashboard';
  const activeGroup = fullNavGroups.find(g =>
    g.items.some(item => isActive(item.path))
  );
  const breadcrumbLabel = activeGroup?.group || 'Dashboard';

  return (
    <div
      className={`flex h-dvh overflow-hidden ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        navGroups={navGroups}
        sidebarState={desktopSidebar}
        mobileSidebarOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          navGroups={navGroups}
          currentLabel={currentLabel}
          breadcrumbLabel={breadcrumbLabel}
          sidebarState={desktopSidebar}
          onCycleSidebar={cycleDesktopSidebar}
          onOpenMobile={() => setMobileSidebarOpen(true)}
        />

        <main
          className={`app-scroll flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6 ${
            darkMode ? 'bg-gray-900' : 'bg-gray-50'
          }`}>
          {accessDenied ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="max-w-md px-4 text-center">
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                    darkMode ? 'bg-gray-800' : 'bg-red-50'
                  }`}>
                  <Lock size={28} className="text-red-500" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-gray-800 dark:text-white">
                  Access Restricted
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  You do not have permission to view this module. Please contact
                  your ICT Coordinator if you believe this is a mistake.
                </p>
                <button
                  onClick={() => navigate(`/${roleKey}`)}
                  className={`mt-5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${accent.button}`}>
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <BottomNav items={bottomNavItems} />
    </div>
  );
}
