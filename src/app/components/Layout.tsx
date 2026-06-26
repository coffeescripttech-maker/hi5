import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  BarChart2,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  UserCheck,
  Bell,
  Shield,
  Calendar,
  Database,
  Layers,
  BookMarked,
  FileSpreadsheet,
  Search,
  Activity,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  Moon,
  Sun,
  Camera,
  UsersRound
} from 'lucide-react';
import logoImage from '../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png';

type NavItem = { label: string; icon: React.ElementType; path: string };
type NavGroup = { group: string; items: NavItem[] };

const adminNav: NavGroup[] = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/admin' }]
  },
  {
    group: 'Management',
    items: [
      { label: 'User Management', icon: Users, path: '/admin/users' },
      { label: 'Subject Management', icon: BookOpen, path: '/admin/subjects' },
      { label: 'Section Creation', icon: Layers, path: '/admin/sections' },
      {
        label: 'Academic Year Mgmt.',
        icon: Calendar,
        path: '/admin/academic-year'
      }
    ]
  },
  {
    group: 'School Forms',
    items: [
      {
        label: 'SF1 — School Register',
        icon: FileSpreadsheet,
        path: '/admin/forms/sf1'
      },
      {
        label: 'SF5 — Promotion Report',
        icon: BarChart2,
        path: '/admin/forms/sf5'
      },
      { label: 'SF9 — Report Card', icon: FileText, path: '/admin/forms/sf9' },
      {
        label: 'SF10 — Permanent Record',
        icon: BookOpen,
        path: '/admin/forms/sf10'
      }
    ]
  },
  {
    group: 'System',
    items: [
      { label: 'School Settings', icon: Settings, path: '/admin/settings' },
      { label: 'Database Backup', icon: Database, path: '/admin/backup' },
      { label: 'Activity Logs', icon: Activity, path: '/admin/logs' },
      { label: 'My Profile', icon: User, path: '/admin/profile' }
    ]
  }
];

const teacherNav: NavGroup[] = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/teacher' }]
  },
  {
    group: 'Student Management',
    items: [
      { label: 'Enrollment', icon: UserCheck, path: '/teacher/enroll' },
      { label: 'My Students', icon: UsersRound, path: '/teacher/my-students' },
      // { label: "Auto Sectioning", icon: Layers, path: "/teacher/sectioning" },
      {
        label: 'Section Management',
        icon: BookMarked,
        path: '/teacher/sections'
      },
      { label: 'Bulk Promotion', icon: GraduationCap, path: '/teacher/promote' }
    ]
  },
  {
    group: 'School Forms',
    items: [
      {
        label: 'SF1 — School Register',
        icon: FileSpreadsheet,
        path: '/teacher/forms/sf1'
      },
      {
        label: 'SF5 — Promotion Report',
        icon: BarChart2,
        path: '/teacher/forms/sf5'
      },
      {
        label: 'SF9 — Report Card',
        icon: FileText,
        path: '/teacher/forms/sf9'
      },
      {
        label: 'SF10 — Permanent Record',
        icon: BookOpen,
        path: '/teacher/forms/sf10'
      }
    ]
  },
  {
    group: 'Academic',
    items: [
      { label: 'Grade Management', icon: BookOpen, path: '/teacher/grades' },
      { label: 'Upload Grades', icon: Upload, path: '/teacher/upload' },
      {
        label: 'Document Management',
        icon: FileText,
        path: '/teacher/documents'
      },
      {
        label: 'At-Risk Detection',
        icon: AlertTriangle,
        path: '/teacher/atrisk'
      }
    ]
  },
  {
    group: 'Account',
    items: [{ label: 'My Profile', icon: User, path: '/teacher/profile' }]
  }
];

const registrarNav: NavGroup[] = [
  {
    group: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/registrar' }]
  },
  {
    group: 'Records',
    items: [
      { label: 'Student Search', icon: Search, path: '/registrar/students' },
      {
        label: 'Section Assignment',
        icon: Layers,
        path: '/registrar/section-assignment'
      },

      {
        label: 'Promotion Records',
        icon: GraduationCap,
        path: '/registrar/promotions'
      },
      {
        label: 'Subject Directory',
        icon: BookOpen,
        path: '/registrar/subjects'
      }
    ]
  },
  {
    group: 'School Forms',
    items: [
      {
        label: 'SF1 — School Register',
        icon: FileSpreadsheet,
        path: '/registrar/forms/sf1'
      },
      {
        label: 'SF5 — Promotion Report',
        icon: BarChart2,
        path: '/registrar/forms/sf5'
      },
      {
        label: 'SF9 — Report Card',
        icon: FileText,
        path: '/registrar/forms/sf9'
      },
      {
        label: 'SF10 — Permanent Record',
        icon: BookOpen,
        path: '/registrar/forms/sf10'
      }
    ]
  },
  {
    group: 'Reports & Monitoring',
    items: [
      {
        label: 'Enrollment Report',
        icon: BarChart2,
        path: '/registrar/reports'
      },
      {
        label: 'Section Management',
        icon: Layers,
        path: '/registrar/sections'
      },
      {
        label: 'At-Risk Students',
        icon: AlertTriangle,
        path: '/registrar/atrisk'
      }
    ]
  },
  {
    group: 'Account',
    items: [{ label: 'My Profile', icon: User, path: '/registrar/profile' }]
  }
];

const roleColors: Record<string, string> = {
  admin: 'from-[#0d1b3e] to-[#1a3a8f]',
  teacher: 'from-[#064e35] to-[#065f46]',
  registrar: 'from-[#1a1040] to-[#3730a3]'
};
const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  registrar: 'Registrar'
};
const roleIcons: Record<string, React.ElementType> = {
  admin: Shield,
  teacher: GraduationCap,
  registrar: FileText
};
const roleBadgeColors: Record<string, string> = {
  admin: 'bg-blue-700',
  teacher: 'bg-emerald-600',
  registrar: 'bg-indigo-600'
};

type SidebarState = 'full' | 'icons' | 'hidden';

function NavTooltip({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center w-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute left-full ml-2 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap shadow-lg pointer-events-none">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}

const ALL_NOTIFICATIONS: Record<
  string,
  { id: number; icon: string; text: string; time: string }[]
> = {
  admin: [
    {
      id: 1,
      icon: '👤',
      text: 'New user account created: teacher03 (Teacher)',
      time: 'Today 10:02'
    },
    {
      id: 2,
      icon: '🔄',
      text: 'Bulk promotion submitted by Mr. Ramon Dela Cruz — 7-Star (42 students)',
      time: 'Today 09:45'
    },
    {
      id: 3,
      icon: '💾',
      text: 'Database backup completed successfully.',
      time: 'Today 08:00'
    },
    {
      id: 4,
      icon: '📅',
      text: 'Enrollment period is currently OPEN for SY 2025–2026.',
      time: 'Yesterday'
    },
    {
      id: 5,
      icon: '🤖',
      text: 'AI At-Risk model run completed — 11 students flagged system-wide.',
      time: 'Yesterday'
    }
  ],
  teacher: [
    {
      id: 1,
      icon: '✅',
      text: 'Grades successfully locked: 7-Star — Mathematics.',
      time: 'Today 10:30'
    },
    {
      id: 2,
      icon: '🔴',
      text: 'At-Risk alert: Juan dela Cruz (7-Gold) — declining grade trajectory detected.',
      time: 'Today 09:00'
    },
    {
      id: 3,
      icon: '🟡',
      text: 'Needs Monitoring: Ana Reyes (8-Silver) — Q3 average dropped below 82.',
      time: 'Today 08:45'
    },
    {
      id: 4,
      icon: '👨‍🎓',
      text: 'New student enrolled in your section: Mark Bautista — 7-Gold.',
      time: 'Yesterday'
    },
    {
      id: 5,
      icon: '📅',
      text: 'Enrollment period is open. You may now enroll new and returning students.',
      time: 'Yesterday'
    }
  ],
  registrar: [
    {
      id: 1,
      icon: '📋',
      text: 'Teacher Mr. Dela Cruz submitted grades for 7-Star — ready for SF generation.',
      time: 'Today 10:30'
    },
    {
      id: 2,
      icon: '📤',
      text: 'SF1 generated successfully for Grade 7-Star — SY 2025–2026.',
      time: 'Today 09:12'
    },
    {
      id: 3,
      icon: '🔼',
      text: 'Bulk promotion record received: 7-Star → Grade 8 (42 students). Record PR-003.',
      time: 'Today 09:45'
    },
    {
      id: 4,
      icon: '🤖',
      text: 'At-Risk report updated — 2 At-Risk, 4 Needs Monitoring across all sections.',
      time: 'Yesterday'
    },
    {
      id: 5,
      icon: '👤',
      text: 'Student record updated: Maria Santos — SF10 generated by registrar01.',
      time: 'Yesterday'
    }
  ]
};

export function Layout() {
  const {
    role,
    username,
    logout,
    darkMode,
    toggleDarkMode,
    profilePhoto,
    readNotifs,
    markAllRead,
    markOneRead,
    securityNotifs,
    schoolName,
    schoolYearLabel
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebar, setDesktopSidebar] = useState<SidebarState>('full');
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const cycleDesktopSidebar = () => {
    setDesktopSidebar(prev =>
      prev === 'full' ? 'icons' : prev === 'icons' ? 'hidden' : 'full'
    );
  };

  const staticNotifs = ALL_NOTIFICATIONS[role || 'admin'] || [];
  const currentNotifs = [
    ...securityNotifs.map(n => ({
      id: parseInt(n.id, 36) || 9999,
      icon: n.icon,
      text: n.text,
      time: n.time,
      isSecurity: true
    })),
    ...staticNotifs.map(n => ({ ...n, isSecurity: false }))
  ];
  const unreadCount =
    securityNotifs.length +
    staticNotifs.filter(n => !readNotifs.includes(n.id)).length;

  useEffect(() => {
    if (!role) navigate('/login', { replace: true });
  }, [role, navigate]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  if (!role) return null;

  const navGroups =
    role === 'admin'
      ? adminNav
      : role === 'teacher'
        ? teacherNav
        : registrarNav;
  const allNavItems = navGroups.flatMap(g => g.items);
  const gradientClass = roleColors[role];
  const badgeColor = roleBadgeColors[role];
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const isActive = (path: string) => location.pathname === path;
  const currentLabel =
    allNavItems.find(n => isActive(n.path))?.label || 'Dashboard';
  const isIcons = desktopSidebar === 'icons';
  const isHidden = desktopSidebar === 'hidden';

  return (
    <div
      className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-30
        bg-gradient-to-b ${gradientClass}
        flex flex-col transition-all duration-300 shadow-xl
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isHidden ? 'lg:w-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none' : isIcons ? 'lg:w-14' : 'w-64'}
      `}>
        {/* Logo */}
        <div
          className={`border-b border-white/10 flex-shrink-0 ${isIcons ? 'px-2 py-4 flex justify-center' : 'px-4 py-5'}`}>
          {isIcons ? (
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/40 shadow-sm bg-white/10">
              <img
                src={logoImage}
                alt="Hi5"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/40 flex-shrink-0 shadow-sm bg-white/10">
                <img
                  src={logoImage}
                  alt="DSPMNHS Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">
                  Hi5 Portal
                </p>
                <p className="text-blue-200 text-xs leading-tight">
                  {schoolName || 'DSPMNHS'}
                </p>
                <p className="text-blue-200 text-xs">
                  SY {schoolYearLabel || '2025–2026'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User info with profile photo */}
        {!isIcons && (
          <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 ${badgeColor} rounded-full flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden`}>
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-bold">
                    {username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {username}
                </p>
                <p className="text-blue-200 text-xs">{roleLabels[role]}</p>
              </div>
            </div>
          </div>
        )}
        {isIcons && (
          <div className="flex justify-center py-3 border-b border-white/10 flex-shrink-0">
            <div
              className={`w-8 h-8 ${badgeColor} rounded-full flex items-center justify-center shadow-sm overflow-hidden`}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-xs font-bold">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navGroups.map((group, gi) => (
            <div key={gi} className={isIcons ? 'mb-1' : 'mb-3'}>
              {!isIcons && (
                <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-300/70 select-none">
                  {group.group}
                </p>
              )}
              {isIcons && gi > 0 && (
                <div className="mx-2 mb-1 border-t border-white/10" />
              )}
              <div
                className={isIcons ? 'px-1 space-y-0.5' : 'px-3 space-y-0.5'}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  if (isIcons) {
                    return (
                      <NavTooltip key={item.path} label={item.label}>
                        <button
                          onClick={() => {
                            navigate(item.path);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${active ? 'bg-white/20 text-white shadow-sm' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                          <Icon size={17} />
                        </button>
                      </NavTooltip>
                    );
                  }
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${active ? 'bg-white/20 text-white font-semibold shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}>
                      <Icon
                        size={17}
                        className={active ? 'text-white' : 'text-blue-300'}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {active && (
                        <ChevronRight size={13} className="text-white/60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div
          className={`border-t border-white/10 flex-shrink-0 ${isIcons ? 'px-1 py-3' : 'px-3 py-4'}`}>
          {isIcons ? (
            <NavTooltip label="Logout">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-all">
                <LogOut size={17} />
              </button>
            </NavTooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-100 hover:bg-white/10 hover:text-white transition-all">
              <LogOut size={17} className="text-blue-300" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className={`border-b px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm z-10 ${
            darkMode
              ? role === 'admin'
                ? 'bg-[#0d1b3e] border-blue-900'
                : role === 'registrar'
                  ? 'bg-[#1a1040] border-indigo-900'
                  : 'bg-[#0a1a10] border-emerald-900'
              : 'bg-white border-gray-200'
          }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <Menu size={20} />
            </button>
            <button
              onClick={cycleDesktopSidebar}
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title={
                isHidden
                  ? 'Show sidebar'
                  : isIcons
                    ? 'Hide sidebar'
                    : 'Collapse sidebar'
              }>
              {isHidden ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <div>
              <h1
                className={`font-semibold text-base ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {currentLabel}
              </h1>
              <p
                className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                Hi5 Portal ·{' '}
                {schoolName ||
                  'Don Servillano Platon Memorial National High School'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-500'}`}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className={`p-2 rounded-lg relative ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}>
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 top-11 w-84 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(160deg, #0a1a10 0%, #064e35 100%)',
                    border: '1px solid rgba(52,211,153,0.25)',
                    minWidth: '320px'
                  }}>
                  {/* Header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(52,211,153,0.15)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="font-semibold text-sm text-white">
                        Notifications
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(52,211,153,0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.3)'
                          }}>
                          {unreadCount} new
                        </span>
                      )}
                      <button
                        onClick={markAllRead}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition font-medium">
                        Mark all read
                      </button>
                    </div>
                  </div>
                  {/* Items */}
                  <div className="max-h-72 overflow-y-auto">
                    {currentNotifs.map((n, idx) => {
                      const isUnread = !readNotifs.includes(n.id);
                      const isSec = (n as { isSecurity?: boolean }).isSecurity;
                      const bgUnread = isSec
                        ? 'rgba(239,68,68,0.10)'
                        : 'rgba(52,211,153,0.06)';
                      const bgHover = isSec
                        ? 'rgba(239,68,68,0.16)'
                        : 'rgba(52,211,153,0.1)';
                      const textColor = isSec
                        ? '#fca5a5'
                        : isUnread
                          ? '#d1fae5'
                          : '#6ee7b7';
                      const dotColor = isSec ? '#f87171' : '#34d399';
                      return (
                        <div
                          key={`${n.id}-${idx}`}
                          onClick={() => !isSec && markOneRead(n.id)}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all"
                          style={{
                            borderBottom:
                              idx < currentNotifs.length - 1
                                ? '1px solid rgba(52,211,153,0.08)'
                                : 'none',
                            background:
                              isSec || isUnread ? bgUnread : 'transparent',
                            borderLeft: isSec
                              ? '3px solid #ef4444'
                              : '3px solid transparent'
                          }}
                          onMouseEnter={e =>
                            (e.currentTarget.style.background = bgHover)
                          }
                          onMouseLeave={e =>
                            (e.currentTarget.style.background =
                              isSec || isUnread ? bgUnread : 'transparent')
                          }>
                          <span className="text-base mt-0.5 flex-shrink-0">
                            {n.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isSec && (
                              <p className="text-xs font-bold text-red-400 mb-0.5 uppercase tracking-wide">
                                Security Alert
                              </p>
                            )}
                            <p
                              className="text-xs leading-snug"
                              style={{ color: textColor }}>
                              {n.text}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: 'rgba(110,231,183,0.5)' }}>
                              {n.time}
                            </p>
                          </div>
                          {(isSec || isUnread) && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                              style={{ background: dotColor }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Footer */}
                  <div
                    className="px-4 py-2.5 text-center"
                    style={{ borderTop: '1px solid rgba(52,211,153,0.15)' }}>
                    <p
                      className="text-xs"
                      style={{ color: 'rgba(110,231,183,0.4)' }}>
                      Hi5 Portal · DSPMNHS Notification Center
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* User badge */}
            <div
              className={`hidden sm:flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                darkMode
                  ? role === 'admin'
                    ? 'bg-blue-900/50 border border-blue-800'
                    : role === 'registrar'
                      ? 'bg-indigo-900/50 border border-indigo-800'
                      : 'bg-emerald-900/50 border border-emerald-800'
                  : role === 'admin'
                    ? 'bg-blue-50 border border-blue-200'
                    : role === 'registrar'
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'bg-emerald-50 border border-emerald-200'
              }`}>
              <div
                className={`w-6 h-6 ${badgeColor} rounded-full flex items-center justify-center overflow-hidden`}>
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-bold">
                    {username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  darkMode
                    ? role === 'admin'
                      ? 'text-blue-200'
                      : role === 'registrar'
                        ? 'text-indigo-200'
                        : 'text-emerald-200'
                    : role === 'admin'
                      ? 'text-blue-800'
                      : role === 'registrar'
                        ? 'text-indigo-800'
                        : 'text-emerald-800'
                }`}>
                {username}
              </span>
              <span
                className={`text-xs ${
                  darkMode
                    ? role === 'admin'
                      ? 'text-blue-400'
                      : role === 'registrar'
                        ? 'text-indigo-400'
                        : 'text-emerald-500'
                    : role === 'admin'
                      ? 'text-blue-500'
                      : role === 'registrar'
                        ? 'text-indigo-500'
                        : 'text-emerald-500'
                }`}>
                · {roleLabels[role]}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className={`flex-1 overflow-y-auto p-4 md:p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
