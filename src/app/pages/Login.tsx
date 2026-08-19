import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { authApi, setToken, LoginResponse } from '../services/api';
import { ApiError } from '../services/api';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Shield,
  Lock,
  User,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Mail,
  AlertTriangle,
  Keyboard,
  GraduationCap,
  BookOpen,
  FileText,
  Sparkles,
  Landmark
} from 'lucide-react';
import bgImage from '../../assets/202c9b6425aa8d526006a7e3262187c250e06d15.png';
import logoImage from '../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png';

const ROLE_PATHS: Record<string, string> = {
  admin: '/admin',
  teacher: '/teacher',
  registrar: '/registrar',
  principal: '/principal'
};

/* ── Zod Validation Schemas ─────────────────────────── */
const MAX_LOGIN_USERNAME = 50;
const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(
      MAX_LOGIN_USERNAME,
      `Username must be at most ${MAX_LOGIN_USERNAME} characters`
    )
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Username may only contain letters, numbers, dots, dashes, and underscores'
    ),
  password: z.string().min(1, 'Password is required')
});

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Enter a valid email address (e.g. you@school.edu.ph)')
});

const resetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Reset code is required')
      .regex(/^\d{6}$/, 'Reset code must be the 6-digit code shown to you'),
    new_password: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
    confirm: z.string().min(1, 'Please confirm your new password')
  })
  .refine(data => data.new_password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm']
  });
/* ── End Validation Schemas ─────────────────────────── */

/** Quick demo accounts available in the development seed */
const DEMO_ACCOUNTS: {
  role: string;
  username: string;
  label: string;
  icon: React.ElementType;
  desc: string;
  color: string;
}[] = [
  {
    role: 'admin',
    username: 'admin',
    label: 'Admin',
    icon: Shield,
    desc: 'Full system control',
    color: 'from-blue-500 to-indigo-600'
  },
  {
    role: 'teacher',
    username: 'teacher01',
    label: 'Teacher',
    icon: BookOpen,
    desc: 'Class & grades',
    color: 'from-emerald-500 to-teal-600'
  },
  {
    role: 'registrar',
    username: 'registrar01',
    label: 'Registrar',
    icon: FileText,
    desc: 'Records & sections',
    color: 'from-amber-500 to-orange-600'
  },
  {
    role: 'principal',
    username: 'principal01',
    label: 'Principal',
    icon: Landmark,
    desc: 'School oversight',
    color: 'from-purple-500 to-violet-600'
  }
];

type Screen = 'login' | 'forgot' | 'forgot-reset' | 'forgot-sent';

const ANIM_STYLE = `
@keyframes hi5FadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes hi5FadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes hi5Float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.hi5-card { animation: hi5FadeUp .55s cubic-bezier(.2,.7,.2,1) both; }
.hi5-stagger-1 { animation-delay: .05s; }
.hi5-stagger-2 { animation-delay: .1s; }
.hi5-stagger-3 { animation-delay: .18s; }
.hi5-stagger-4 { animation-delay: .26s; }
.hi5-orb-1 { animation: hi5Float 9s ease-in-out infinite; }
.hi5-orb-2 { animation: hi5Float 12s ease-in-out infinite reverse; }
`;

export function Login() {
  const navigate = useNavigate();
  const {
    setSession,
    showToast,
    loginAttempts,
    lockoutUntil,
    recordFailedAttempt,
    resetAttempts
  } = useApp();
  const [screen, setScreen] = useState<Screen>('login');
  const [username, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetCode, setResetCode] = useState(''); // the code returned by the API
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Per-field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [forgotError, setForgotError] = useState('');
  const [resetErrors, setResetErrors] = useState<{
    code?: string;
    new_password?: string;
    confirm?: string;
  }>({});
  const [countdown, setCountdown] = useState(0);

  // Auto-focus the username field on load
  useEffect(() => {
    document.getElementById('login-username')?.focus();
  }, []);

  // Lockout countdown ticker
  useEffect(() => {
    if (!lockoutUntil) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lockoutUntil - Date.now()) / 1000)
      );
      setCountdown(remaining);
      if (remaining === 0) resetAttempts();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, resetAttempts]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;
  const attemptsLeft = Math.max(0, 5 - loginAttempts);

  /** Loose helper so schemas use `.trim()` and values stay string-ish */
  const asString = (v: unknown): string =>
    typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);

  /** Validate a single login field on blur/change; returns error message or "" */
  const validateField = (field: 'username' | 'password', value: string) => {
    const result = loginSchema.shape[field].safeParse(asString(value));
    setFieldErrors(prev => ({
      ...prev,
      [field]: result.success ? '' : result.error.issues[0]?.message || ''
    }));
  };

  /** Full login validation for submit — returns true when valid */
  const validateAll = (): boolean => {
    const result = loginSchema.safeParse({ username, password });
    if (result.success) {
      setFieldErrors({ username: '', password: '' });
      return true;
    }
    const errs: { username?: string; password?: string } = {};
    result.error.issues.forEach(i => {
      const path = i.path[0];
      if (path === 'username' || path === 'password') {
        if (!errs[path]) errs[path] = i.message;
      }
    });
    setFieldErrors(errs);
    return false;
  };

  /** Shared post-login success path */
  const completeLogin = (res: LoginResponse) => {
    setToken(res.token);
    resetAttempts();
    const displayName = res.user.name || res.user.role;
    setSession(res.user.role, displayName + ' – ' + res.user.username);
    showToast('success', `Welcome back, ${displayName}!`);
    navigate(ROLE_PATHS[res.user.role] ?? `/${res.user.role}`);
  };

  /** Shared error path — handles lockout, attempts remaining, and network errors */
  const handleLoginError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 423 || err.detail.locked) {
        const lockedUntil = err.detail.lockedUntil
          ? new Date(err.detail.lockedUntil).getTime()
          : Date.now() + 5 * 60 * 1000;
        recordFailedAttempt(lockedUntil);
        setError(
          err.detail.error || 'Account is locked. Please try again later.'
        );
      } else if (err.status === 401) {
        recordFailedAttempt();
        if (err.detail.attemptsRemaining !== undefined) {
          if (err.detail.attemptsRemaining <= 0) {
            setError(
              'Too many failed attempts. Your account is locked for 5 minutes.'
            );
          } else {
            setError(
              `Invalid username or password. ${err.detail.attemptsRemaining} attempt${err.detail.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout.`
            );
          }
        } else {
          setError(err.detail.error || 'Invalid username or password.');
        }
      } else {
        setError(
          err.detail.error || `Login failed (${err.status}). Please try again.`
        );
      }
    } else {
      setError(
        'Unable to connect to the server. Please check your connection and try again.'
      );
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    if (!validateAll()) return; // inline field errors shown
    setError('');
    setLoading(true);
    try {
      completeLogin(
        await authApi.login({ username: username.trim(), password })
      );
    } catch (err: unknown) {
      handleLoginError(err);
    }
    setLoading(false);
  };

  /** Fill credentials from a demo account and submit immediately */
  const handleDemoLogin = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    if (isLockedOut) return;
    setError('');
    setLoading(true);
    setUsernameInput(account.username);
    setPassword('password123');
    authApi
      .login({ username: account.username, password: 'password123' })
      .then(completeLogin)
      .catch(err => {
        setLoading(false);
        handleLoginError(err);
      });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = forgotSchema.safeParse({ email: forgotEmail });
    if (!result.success) {
      setForgotError(
        result.error.issues[0]?.message || 'Please enter a valid email address.'
      );
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword({ email: forgotEmail.trim() });
      setResetCode(res.reset_code || '');
      setScreen('forgot-reset');
    } catch (err: unknown) {
      setForgotError(
        err instanceof ApiError
          ? err.detail.error || 'Failed to send reset code. Please try again.'
          : 'Unable to connect to the server. Please check your connection and try again.'
      );
    }
    setForgotLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = resetSchema.safeParse({
      code: forgotCode,
      new_password: newPassword,
      confirm: confirmPassword
    });
    if (!result.success) {
      const errs: { code?: string; new_password?: string; confirm?: string } =
        {};
      result.error.issues.forEach(i => {
        const path = i.path[0];
        if (path === 'code' || path === 'new_password' || path === 'confirm') {
          if (!errs[path]) errs[path] = i.message;
        }
      });
      setResetErrors(errs);
      return;
    }
    setResetErrors({});
    setForgotError('');
    setForgotLoading(true);
    try {
      await authApi.resetPassword({
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        new_password: newPassword
      });
      setScreen('forgot-sent');
    } catch (err: unknown) {
      setForgotError(
        err instanceof ApiError
          ? err.detail.error || 'Failed to reset password. Please try again.'
          : 'Unable to connect to the server. Please check your connection and try again.'
      );
    }
    setForgotLoading(false);
  };

  const LeftPanel = () => (
    <div
      className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, rgba(3,37,36,0.93) 0%, rgba(6,78,59,0.88) 50%, rgba(4,47,46,0.95) 100%)'
        }}
      />
      <div
        className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full opacity-10 pointer-events-none hi5-orb-1"
        style={{
          background: 'radial-gradient(circle, #34d399, transparent 70%)'
        }}
      />
      <div
        className="absolute bottom-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-10 pointer-events-none hi5-orb-2"
        style={{
          background: 'radial-gradient(circle, #6ee7b7, transparent 70%)'
        }}
      />
      <div className="relative z-10 flex flex-col h-full p-10 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400/40">
            <img
              src={logoImage}
              alt="DSPMNHS"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">
              Hi5 Portal
            </p>
            <p className="text-emerald-200/60 text-xs">
              DSPMNHS · Tinambac, Camarines Sur
            </p>
          </div>
        </div>
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.25)'
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-medium">
              School Year 2025–2026 · Active
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Integrated Enrollment
            <br />& Academic Records
            <br />
            <span style={{ color: '#34d399' }}>Management System</span>
          </h1>
          <p className="text-emerald-200/70 text-sm leading-relaxed max-w-sm">
            Hi5 Portal streamlines student enrollment, grade management, school
            form generation, and AI-powered at-risk detection for Don Servillano
            Platon Memorial National High School.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {[
              'SF1 · SF5 · SF9 · SF10',
              'AI At-Risk Detection',
              'Auto-Sectioning',
              'Grade Management',
              'RA 10173 Compliant'
            ].map(f => (
              <span
                key={f}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#a7f3d0'
                }}>
                <CheckCircle size={10} className="text-emerald-400" />
                {f}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">
            Don Servillano Platon Memorial
          </p>
          <p style={{ color: '#6ee7b7' }} className="font-semibold text-base">
            National High School
          </p>
          <p className="text-emerald-200/40 text-xs mt-2">
            Sta. Cruz, Tinambac, Camarines Sur · 3,200 Students · Grades 7–12
          </p>
        </div>
      </div>
    </div>
  );

  const MobileBanner = () => (
    <div
      className="lg:hidden relative flex items-center gap-3 px-4 py-3 overflow-hidden select-none shrink-0"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, rgba(3,37,36,0.93) 0%, rgba(6,78,59,0.90) 50%, rgba(4,47,46,0.95) 100%)'
        }}
      />
      <div className="relative z-10 flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-400/40 flex-shrink-0">
          <img
            src={logoImage}
            alt="DSPMNHS"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase leading-tight">
            Hi5 Portal
          </p>
          <p className="text-emerald-200/60 text-xs truncate">
            DSPMNHS · Tinambac, Camarines Sur
          </p>
        </div>
        <div
          className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.25)'
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-[11px] font-medium whitespace-nowrap">
            SY 2025–26
          </span>
        </div>
      </div>
    </div>
  );

  // ── FORGOT PASSWORD ──
  if (
    screen === 'forgot' ||
    screen === 'forgot-reset' ||
    screen === 'forgot-sent'
  ) {
    return (
      <>
        <style>{ANIM_STYLE}</style>
        <div className="min-h-dvh flex flex-col lg:flex-row overflow-hidden">
          <LeftPanel />
          <MobileBanner />
          <div className="flex-1 flex flex-col items-center bg-gray-50 px-6 py-5 lg:py-10 overflow-y-auto">
            <div className="w-full max-w-md hi5-card my-auto">
              <button
                onClick={() => {
                  setScreen('login');
                  setError('');
                  setForgotEmail('');
                  setForgotCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setResetCode('');
                  setForgotError('');
                  setResetErrors({});
                }}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition">
                <ArrowLeft size={15} /> Back to Login
              </button>

              {/* STEP 1 — enter email */}
              {screen === 'forgot' && (
                <>
                  <div className="mb-8">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                      <Mail size={22} className="text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      Forgot Password?
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Enter your school email address and we'll give you a
                      password reset code.
                    </p>
                  </div>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                        School Email Address
                      </label>
                      <div className="relative">
                        <Mail
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={e => {
                            setForgotEmail(e.target.value);
                            setError('');
                            if (forgotError) setForgotError('');
                          }}
                          onBlur={() => {
                            const r = forgotSchema.shape.email.safeParse(
                              forgotEmail.trim()
                            );
                            setForgotError(
                              r.success ? '' : r.error.issues[0]?.message || ''
                            );
                          }}
                          className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                            forgotError
                              ? 'border border-red-300 focus:ring-red-300 focus:border-red-400'
                              : 'border border-gray-200 focus:ring-emerald-400 focus:border-emerald-400'
                          }`}
                          placeholder="e.g. yourname@school.edu.ph"
                          required
                        />
                      </div>
                      {forgotError && (
                        <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                          <AlertCircle size={12} className="flex-shrink-0" />
                          {forgotError}
                        </p>
                      )}
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                      style={{
                        background:
                          'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                        boxShadow: '0 4px 20px rgba(5,150,105,0.3)'
                      }}>
                      {forgotLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        'Send Reset Code'
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* STEP 2 — enter reset code + new password */}
              {screen === 'forgot-reset' && (
                <>
                  <div className="mb-8">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                      <Lock size={22} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-800">
                      Create New Password
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      We found an account for{' '}
                      <span className="font-semibold text-gray-700">
                        {forgotEmail}
                      </span>
                      . Enter the reset code below to continue.
                    </p>
                  </div>

                  {/* Dev-mode code display — no email service configured yet */}
                  {resetCode && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Mail size={12} /> Your Reset Code
                      </p>
                      <p className="font-mono text-2xl font-extrabold tracking-[0.3em] text-amber-800 text-center py-1 select-all">
                        {resetCode}
                      </p>
                      <p className="text-[11px] text-amber-600 mt-1.5">
                        Valid for 15 minutes. (Demo mode — no email is actually
                        sent.)
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                        6-Digit Reset Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={forgotCode}
                        onChange={e => {
                          setForgotCode(e.target.value.replace(/\D/g, ''));
                          if (resetErrors.code)
                            setResetErrors(prev => ({ ...prev, code: '' }));
                        }}
                        onBlur={() => {
                          const r =
                            resetSchema.shape.code.safeParse(forgotCode);
                          setResetErrors(prev => ({
                            ...prev,
                            code: r.success
                              ? ''
                              : r.error.issues[0]?.message || ''
                          }));
                        }}
                        className={`w-full px-4 py-3 rounded-xl text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                          resetErrors.code
                            ? 'border border-red-300 focus:ring-red-300 focus:border-red-400'
                            : 'border border-gray-200 focus:ring-indigo-400 focus:border-indigo-400'
                        }`}
                        placeholder="000000"
                        required
                        autoComplete="one-time-code"
                      />
                      {resetErrors.code && (
                        <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                          <AlertCircle size={12} className="flex-shrink-0" />
                          {resetErrors.code}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => {
                            setNewPassword(e.target.value);
                            if (resetErrors.new_password)
                              setResetErrors(prev => ({
                                ...prev,
                                new_password: ''
                              }));
                          }}
                          onBlur={() => {
                            const r =
                              resetSchema.shape.new_password.safeParse(
                                newPassword
                              );
                            setResetErrors(prev => ({
                              ...prev,
                              new_password: r.success
                                ? ''
                                : r.error.issues[0]?.message || ''
                            }));
                          }}
                          className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                            resetErrors.new_password
                              ? 'border border-red-300 focus:ring-red-300 focus:border-red-400'
                              : 'border border-gray-200 focus:ring-indigo-400 focus:border-indigo-400'
                          }`}
                          placeholder="At least 6 characters"
                          required
                          autoComplete="new-password"
                        />
                      </div>
                      {resetErrors.new_password && (
                        <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                          <AlertCircle size={12} className="flex-shrink-0" />
                          {resetErrors.new_password}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => {
                            setConfirmPassword(e.target.value);
                            if (resetErrors.confirm)
                              setResetErrors(prev => ({
                                ...prev,
                                confirm: ''
                              }));
                          }}
                          onBlur={() => {
                            const r =
                              resetSchema.shape.confirm.safeParse(
                                confirmPassword
                              );
                            setResetErrors(prev => ({
                              ...prev,
                              confirm: r.success
                                ? ''
                                : r.error.issues[0]?.message || ''
                            }));
                          }}
                          className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                            resetErrors.confirm
                              ? 'border border-red-300 focus:ring-red-300 focus:border-red-400'
                              : 'border border-gray-200 focus:ring-indigo-400 focus:border-indigo-400'
                          }`}
                          placeholder="Re-enter your new password"
                          required
                          autoComplete="new-password"
                        />
                      </div>
                      {resetErrors.confirm && (
                        <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                          <AlertCircle size={12} className="flex-shrink-0" />
                          {resetErrors.confirm}
                        </p>
                      )}
                    </div>
                    {forgotError && (
                      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {forgotError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                      style={{
                        background:
                          'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                        boxShadow: '0 4px 20px rgba(5,150,105,0.3)'
                      }}>
                      {forgotLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Lock size={15} /> Reset Password
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* STEP 3 — success */}
              {screen === 'forgot-sent' && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={30} className="text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-800 mb-2">
                    Password Reset!
                  </h2>
                  <p className="text-gray-500 text-sm mb-1">
                    Your password has been changed successfully for:
                  </p>
                  <p className="text-emerald-600 font-semibold text-sm mb-6">
                    {forgotEmail}
                  </p>
                  <p className="text-gray-400 text-xs mb-6">
                    You can now sign in with your new password.
                  </p>
                  <button
                    onClick={() => {
                      setScreen('login');
                      setForgotEmail('');
                      setForgotCode('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setResetCode('');
                      setError('');
                    }}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
                    style={{
                      background:
                        'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
                    }}>
                    Back to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── MAIN LOGIN ──
  return (
    <>
      <style>{ANIM_STYLE}</style>
      <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
        <LeftPanel />
        <MobileBanner />
        <div className="flex-1 flex flex-col items-center bg-gray-50 px-4 sm:px-6 py-5 lg:py-8 overflow-y-auto">
          <div className="w-full max-w-md my-auto">
            {/* Card header */}
            <div className="hi5-card hi5-stagger-1 mb-7 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200 flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-800 leading-tight">
                  Welcome back
                </h2>
                <p className="text-gray-500 text-sm">
                  Sign in to the Hi5 Portal
                </p>
              </div>
            </div>

            {/* Card body */}
            <form
              onSubmit={handleLogin}
              className="hi5-card hi5-stagger-2 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/60 p-6 sm:p-7 space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative group">
                  <User
                    size={15}
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition group-focus-within:text-emerald-600 ${fieldErrors.username ? 'text-red-400' : 'text-gray-400'}`}
                  />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => {
                      setUsernameInput(e.target.value);
                      if (fieldErrors.username)
                        validateField('username', e.target.value);
                    }}
                    onBlur={e => validateField('username', e.target.value)}
                    className={`w-full pl-9 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                      fieldErrors.username
                        ? 'border border-red-300 focus:ring-red-300 focus:border-red-400'
                        : 'border border-gray-200 focus:ring-emerald-400/70 focus:border-emerald-400'
                    }`}
                    placeholder="Enter your username"
                    required
                    autoComplete="username"
                    onKeyDown={e =>
                      e.key === 'Enter' &&
                      password &&
                      document.getElementById('login-password')?.focus()
                    }
                  />
                </div>
                {fieldErrors.username && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle size={12} className="flex-shrink-0" />
                    {fieldErrors.username}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative group">
                  <Lock
                    size={15}
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition group-focus-within:text-emerald-600 ${fieldErrors.password ? 'text-red-400' : 'text-gray-400'}`}
                  />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (fieldErrors.password)
                        validateField('password', e.target.value);
                    }}
                    onBlur={e => validateField('password', e.target.value)}
                    onKeyUp={e => {
                      setCapsLock(
                        e.getModifierState && e.getModifierState('CapsLock')
                      );
                    }}
                    className={`w-full pl-9 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm ${
                      fieldErrors.password
                        ? 'border border-red-300 focus:ring-red-400 focus:border-red-400'
                        : 'border border-gray-200 focus:ring-emerald-400/70 focus:border-emerald-400'
                    }`}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle size={12} className="flex-shrink-0" />
                    {fieldErrors.password}
                  </p>
                )}
                {capsLock && (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600 mt-1.5">
                    <Keyboard size={12} /> Caps Lock is on
                  </p>
                )}
              </div>

              {/* Forgot password */}
              <div className="flex items-center justify-between">
                <div />
                <button
                  type="button"
                  onClick={() => {
                    setScreen('forgot');
                    setError('');
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-medium transition">
                  Forgot password?
                </button>
              </div>

              {/* Errors */}
              {error && (
                <div
                  className="hi5-card flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 shadow-sm"
                  style={{ animationDuration: '.25s' }}>
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}
              {isLockedOut && (
                <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-300 shadow-sm">
                  <AlertTriangle
                    size={16}
                    className="text-red-600 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="font-semibold text-red-700">
                      Account Temporarily Locked
                    </p>
                    <p className="text-red-600 text-xs mt-0.5">
                      Too many failed attempts. Please wait{' '}
                      <span className="font-bold">
                        {Math.floor(countdown / 60)}:
                        {String(countdown % 60).padStart(2, '0')}
                      </span>{' '}
                      before trying again.
                    </p>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || isLockedOut}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-lg mt-1"
                style={{
                  background: isLockedOut
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                  boxShadow: isLockedOut
                    ? 'none'
                    : '0 8px 24px rgba(5,150,105,0.35)'
                }}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : isLockedOut ? (
                  <>
                    <Lock size={15} />
                    Account Locked
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    Sign In to Portal
                  </>
                )}
              </button>
            </form>

            {/* Demo quick access */}
            {/* <div className="hi5-card hi5-stagger-3 mt-4 bg-white/70 backdrop-blur border border-dashed border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-emerald-500" />
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Demo Quick Access</p>
                <span className="text-[10px] text-gray-400 ml-auto hidden sm:inline">password: <code className="font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">password123</code></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {DEMO_ACCOUNTS.map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.role} type="button" onClick={() => handleDemoLogin(a)} disabled={loading || isLockedOut}
                      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-emerald-300 hover:shadow-md transition-all duration-150 disabled:opacity-60">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon size={15} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-700">{a.label}</p>
                        <p className="text-[10px] text-gray-400">{a.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div> */}

            {/* Trust footer */}
            <div className="hi5-card hi5-stagger-4 mt-6 pt-5 border-t border-gray-200 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Shield size={11} className="text-emerald-500" />
                <span>
                  DepEd compliant · Data Privacy Act of 2012 (RA 10173)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Lock size={11} className="text-emerald-500" />
                <span>For authorized school personnel only</span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-300 mt-4 mb-2">
              © 2026 Hi5 Portal · DSPMNHS
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
