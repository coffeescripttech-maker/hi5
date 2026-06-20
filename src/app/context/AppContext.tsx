import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';
import { getToken, clearToken, authApi } from '../services/api';
import { settingsApi } from '../services/settings';
import { schoolYearsApi } from '../services/schoolYears';

type Role = 'admin' | 'teacher' | 'registrar' | null;

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface SecurityNotif {
  id: string;
  icon: string;
  text: string;
  time: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

const SESSION_KEY = 'hi5_portal_session';

interface StoredSession {
  role: Role;
  username: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as StoredSession;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(role: Role, username: string) {
  if (role && username) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role, username }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

interface AppContextType {
  role: Role;
  username: string;
  setSession: (role: Role, username: string) => void;
  logout: () => void;
  // Toast
  toasts: Toast[];
  showToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;
  // Profile photo
  profilePhoto: string | null;
  setProfilePhoto: (photo: string | null) => void;
  // Notifications read state
  readNotifs: number[];
  markAllRead: () => void;
  markOneRead: (id: number) => void;
  // Lockout
  loginAttempts: number;
  lockoutUntil: number | null;
  recordFailedAttempt: (until?: number) => void;
  resetAttempts: () => void;
  // Security notifications
  securityNotifs: SecurityNotif[];
  // School info (shared so sidebar & header reflect saved values)
  schoolName: string;
  schoolYearLabel: string;
  refreshSchoolInfo: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  role: null,
  username: '',
  setSession: () => {},
  logout: () => {},
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
  darkMode: false,
  toggleDarkMode: () => {},
  profilePhoto: null,
  setProfilePhoto: () => {},
  readNotifs: [],
  markAllRead: () => {},
  markOneRead: () => {},
  loginAttempts: 0,
  lockoutUntil: null,
  recordFailedAttempt: () => {},
  resetAttempts: () => {},
  securityNotifs: [],
  schoolName: '',
  schoolYearLabel: '',
  refreshSchoolInfo: async () => {},
});

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Synchronously restore session from localStorage so Layout
// never sees a null role on page reload (avoids redirect → login race).
const _init = (() => {
  try {
    const s = loadSession();
    const t = getToken();
    return (s?.role && t)
      ? { role: s.role as Role, username: s.username }
      : { role: null as Role, username: '' };
  } catch {
    return { role: null as Role, username: '' };
  }
})();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(_init.role);
  const [username, setUsername] = useState(_init.username);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [readNotifs, setReadNotifs] = useState<number[]>([]);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [securityNotifs, setSecurityNotifs] = useState<SecurityNotif[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [schoolYearLabel, setSchoolYearLabel] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load school info from API so sidebar/header reflect saved values ──
  const refreshSchoolInfo = useCallback(async () => {
    try {
      const [settings, sys] = await Promise.all([
        settingsApi.get(),
        schoolYearsApi.list(),
      ]);
      setSchoolName(settings.school_name);
      const current = sys.find(sy => sy.is_current === 1);
      setSchoolYearLabel(current?.sy_label || '');
    } catch {
      // Silently fail — defaults stay empty
    }
  }, []);

  // Fetch school info whenever a role is active (covers login + page reload)
  useEffect(() => {
    if (role) {
      refreshSchoolInfo();
    }
  }, [role, refreshSchoolInfo]);

  // ── Verify persisted session on mount ──
  // role & username are already restored synchronously above;
  // this effect just validates the token is still live.
  useEffect(() => {
    const stored = loadSession();
    const token = getToken();
    if (stored?.role && token) {
      authApi
        .me()
        .then(me => {
          const displayName = me.name || stored.username;
          setRole(me.role);
          setUsername(displayName + ' – ' + me.username);
          saveSession(me.role, displayName + ' – ' + me.username);
          // Load school info so sidebar displays correct school name & SY
          refreshSchoolInfo();
        })
        .catch(() => {
          // Token expired or invalid — clear session
          clearToken();
          localStorage.removeItem(SESSION_KEY);
          setRole(null);
          setUsername('');
        });
    }
  }, []);

  // ── Set session (role + username) ──
  const setSession = useCallback((newRole: Role, newUsername: string) => {
    setRole(newRole);
    setUsername(newUsername);
    saveSession(newRole, newUsername);
  }, []);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Session timeout
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (role) {
      timeoutRef.current = setTimeout(() => {
        setRole(null);
        setUsername('');
        clearToken();
        localStorage.removeItem(SESSION_KEY);
        showToast(
          'warning',
          'Session expired due to inactivity. Please log in again.'
        );
      }, SESSION_TIMEOUT_MS);
    }
  }, [role, showToast]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  // Dark mode apply
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const logout = () => {
    // Best-effort logout API call
    authApi.logout().catch(() => {});
    clearToken();
    localStorage.removeItem(SESSION_KEY);
    setRole(null);
    setUsername('');
    setReadNotifs([]);
  };
  const recordFailedAttempt = useCallback((until?: number) => {
    setLoginAttempts(prev => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS || until) {
        const lockTime = until || Date.now() + LOCKOUT_MS;
        setLockoutUntil(lockTime);
        const notif: SecurityNotif = {
          id: Math.random().toString(36).slice(2),
          icon: '🔒',
          text: `Account temporarily locked after ${MAX_ATTEMPTS} failed login attempts. Lockout expires in 5 minutes.`,
          time: new Date().toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit'
          })
        };
        setSecurityNotifs(prev => [notif, ...prev].slice(0, 10));
      }
      return next;
    });
  }, []);

  const resetAttempts = useCallback(() => {
    setLoginAttempts(0);
    setLockoutUntil(null);
  }, []);

  const dismissToast = (id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id));
  const toggleDarkMode = () => setDarkMode(d => !d);
  const markAllRead = () => setReadNotifs([1, 2, 3, 4, 5]);
  const markOneRead = (id: number) =>
    setReadNotifs(prev => (prev.includes(id) ? prev : [...prev, id]));

  return (
    <AppContext.Provider
      value={{
        role,
        username,
        setSession,
        logout,
        toasts,
        showToast,
        dismissToast,
        darkMode,
        toggleDarkMode,
        profilePhoto,
        setProfilePhoto,
        readNotifs,
        markAllRead,
        markOneRead,
        loginAttempts,
        lockoutUntil,
        recordFailedAttempt,
        resetAttempts,
        securityNotifs,
        schoolName,
        schoolYearLabel,
        refreshSchoolInfo
      }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium min-w-[280px] max-w-[360px] animate-slide-in ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : t.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
            <span className="text-base mt-0.5 flex-shrink-0">
              {t.type === 'success'
                ? '✅'
                : t.type === 'error'
                  ? '❌'
                  : t.type === 'warning'
                    ? '⚠️'
                    : 'ℹ️'}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-gray-400 hover:text-gray-600 ml-1 flex-shrink-0">
              ✕
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
