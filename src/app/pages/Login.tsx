import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { authApi, setToken } from "../services/api";
import { ApiError } from "../services/api";
import { Eye, EyeOff, Shield, BookOpen, FileText, Lock, User, CheckCircle, AlertCircle, ArrowLeft, Mail, AlertTriangle } from "lucide-react";
import bgImage from "../../assets/202c9b6425aa8d526006a7e3262187c250e06d15.png";
import logoImage from "../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png";

const CREDENTIALS = [
  { role: "admin" as const, username: "admin", label: "Administrator", icon: Shield, desc: "Full system access, user management & school settings", path: "/admin", activeColor: "border-blue-600 bg-blue-100", iconColor: "text-blue-600", iconBg: "bg-blue-100" },
  { role: "teacher" as const, username: "teacher01", label: "Teacher", icon: BookOpen, desc: "Enroll students, encode & upload grades", path: "/teacher", activeColor: "border-emerald-600 bg-emerald-100", iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
  { role: "registrar" as const, username: "registrar01", label: "Registrar", icon: FileText, desc: "Generate SF1, SF5, SF9, SF10 & manage student records", path: "/registrar", activeColor: "border-indigo-600 bg-indigo-100", iconColor: "text-indigo-600", iconBg: "bg-indigo-100" },
];

type Screen = "login" | "forgot" | "forgot-sent";

export function Login() {
  const navigate = useNavigate();
  const { setSession, showToast, loginAttempts, lockoutUntil, recordFailedAttempt, resetAttempts } = useApp();
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedCred, setSelectedCred] = useState(CREDENTIALS[0]);
  const [username, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Lockout countdown ticker
  useEffect(() => {
    if (!lockoutUntil) { setCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) resetAttempts();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, resetAttempts]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;
  const attemptsLeft = Math.max(0, 5 - loginAttempts);

  const handleRoleSelect = (cred: typeof CREDENTIALS[0]) => {
    setSelectedCred(cred); setUsernameInput(""); setPassword(""); setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    setError(""); setLoading(true);
    try {
      const res = await authApi.login({ username, password });
      setToken(res.token);
      resetAttempts();
      const displayName = res.user.name || (CREDENTIALS.find(c => c.role === res.user.role)?.label ?? res.user.role);
      setSession(res.user.role, displayName + " – " + res.user.username);
      showToast("success", `Welcome back, ${displayName}!`);
      navigate(CREDENTIALS.find(c => c.role === res.user.role)?.path ?? `/${res.user.role}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 423 || err.detail.locked) {
          const lockedUntil = err.detail.lockedUntil
            ? new Date(err.detail.lockedUntil).getTime()
            : Date.now() + 5 * 60 * 1000;
          recordFailedAttempt(lockedUntil);
          setError(err.detail.error || "Account is locked. Please try again later.");
        } else if (err.status === 401) {
          recordFailedAttempt();
          if (err.detail.attemptsRemaining !== undefined) {
            if (err.detail.attemptsRemaining <= 0) {
              setError("Too many failed attempts. Your account is locked for 5 minutes.");
            } else {
              setError(`Invalid username or password. ${err.detail.attemptsRemaining} attempt${err.detail.attemptsRemaining !== 1 ? "s" : ""} remaining before lockout.`);
            }
          } else {
            setError(err.detail.error || "Invalid username or password.");
          }
        } else {
          setError(err.detail.error || `Login failed (${err.status}). Please try again.`);
        }
      } else {
        setError("Unable to connect to the server. Please check your connection and try again.");
      }
    }
    setLoading(false);
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.includes("@")) { setError("Please enter a valid email address."); return; }
    setForgotLoading(true);
    setTimeout(() => { setForgotLoading(false); setScreen("forgot-sent"); }, 1500);
  };

  const LeftPanel = () => (
    <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden select-none"
      style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(3,37,36,0.93) 0%, rgba(6,78,59,0.88) 50%, rgba(4,47,46,0.95) 100%)" }} />
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }} />
      <div className="absolute bottom-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #6ee7b7, transparent 70%)" }} />
      <div className="relative z-10 flex flex-col h-full p-10 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400/40">
            <img src={logoImage} alt="DSPMNHS" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Hi5 Portal</p>
            <p className="text-emerald-200/60 text-xs">DSPMNHS · Tinambac, Camarines Sur</p>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-xs font-medium">School Year 2025–2026 · Active</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Integrated Enrollment<br />& Academic Records<br />
            <span style={{ color: "#34d399" }}>Management System</span>
          </h1>
          <p className="text-emerald-200/70 text-sm leading-relaxed max-w-sm">
            Hi5 Portal streamlines student enrollment, grade management, school form generation, and AI-powered at-risk detection for Don Servillano Platon Memorial National High School.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {["SF1 · SF5 · SF9 · SF10", "AI At-Risk Detection", "Auto-Sectioning", "Grade Management", "RA 10173 Compliant"].map(f => (
              <span key={f} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#a7f3d0" }}>
                <CheckCircle size={10} className="text-emerald-400" />{f}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">Don Servillano Platon Memorial</p>
          <p style={{ color: "#6ee7b7" }} className="font-semibold text-base">National High School</p>
          <p className="text-emerald-200/40 text-xs mt-2">Sta. Cruz, Tinambac, Camarines Sur · 3,200 Students · Grades 7–12</p>
        </div>
      </div>
    </div>
  );

  const MobileBanner = () => (
    <div className="lg:hidden relative flex flex-col items-center justify-center py-8 px-6 overflow-hidden select-none"
      style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", minHeight: "220px" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(3,37,36,0.93) 0%, rgba(6,78,59,0.90) 50%, rgba(4,47,46,0.95) 100%)" }} />
      <div className="relative z-10 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-400/40">
          <img src={logoImage} alt="DSPMNHS" className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="text-emerald-400 font-bold text-base tracking-widest uppercase">Hi5 Portal</p>
          <p className="text-emerald-200/60 text-xs">DSPMNHS · Tinambac, Camarines Sur</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-xs font-medium">SY 2025–2026 · Active</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {["SF1·SF5·SF9·SF10", "AI At-Risk", "Auto-Sectioning", "RA 10173"].map(f => (
            <span key={f} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#a7f3d0" }}>
              <CheckCircle size={9} className="text-emerald-400" />{f}
            </span>
          ))}
        </div>
        <p className="text-emerald-200/40 text-xs">Sta. Cruz, Tinambac, Camarines Sur · 3,200 Students · Grades 7–12</p>
      </div>
    </div>
  );

  // ── FORGOT PASSWORD ──
  if (screen === "forgot" || screen === "forgot-sent") {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
        <LeftPanel />
        <MobileBanner />
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6 py-10">
          <div className="w-full max-w-md">
            <button onClick={() => { setScreen("login"); setError(""); setForgotEmail(""); }} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition">
              <ArrowLeft size={15} /> Back to Login
            </button>

            {screen === "forgot" ? (
              <>
                <div className="mb-8">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                    <Mail size={22} className="text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-800">Forgot Password?</h2>
                  <p className="text-gray-500 text-sm mt-1">Enter your school email address and we'll send you a password reset link.</p>
                </div>
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">School Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError(""); }}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white transition shadow-sm"
                        placeholder="e.g. yourname@school.edu.ph" required
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200">
                      <AlertCircle size={14} className="flex-shrink-0" />{error}
                    </div>
                  )}
                  <button type="submit" disabled={forgotLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.3)" }}>
                    {forgotLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : "Send Reset Link"}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={30} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Reset Link Sent!</h2>
                <p className="text-gray-500 text-sm mb-1">We sent a password reset link to:</p>
                <p className="text-emerald-600 font-semibold text-sm mb-6">{forgotEmail}</p>
                <p className="text-gray-400 text-xs mb-6">Didn't receive it? Check your spam folder or contact your School ICT Coordinator.</p>
                <button onClick={() => { setScreen("login"); setForgotEmail(""); setError(""); }}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN LOGIN ──
  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
      <LeftPanel />
      <MobileBanner />
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Select your role and sign in to continue</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {CREDENTIALS.map(cred => {
              const Icon = cred.icon;
              const isSelected = selectedCred.role === cred.role;
              return (
                <button key={cred.role} type="button" onClick={() => handleRoleSelect(cred)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${isSelected ? `${cred.activeColor} shadow-md scale-[1.02]` : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? cred.iconBg : "bg-gray-100"}`}>
                    <Icon size={17} className={isSelected ? cred.iconColor : "text-gray-400"} />
                  </div>
                  <span className={`text-xs font-semibold ${isSelected ? cred.iconColor : "text-gray-500"}`}>{cred.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mb-5 text-center">{selectedCred.desc}</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={username} onChange={e => setUsernameInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition shadow-sm"
                  placeholder={`e.g. ${selectedCred.username}`} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition shadow-sm"
                  placeholder="Enter your password" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {/* Forgot password link */}
            <div className="flex justify-end">
              <button type="button" onClick={() => { setScreen("forgot"); setError(""); }}
                className="text-xs text-emerald-600 hover:underline font-medium">
                Forgot password?
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 shadow-sm">
                <AlertCircle size={14} className="flex-shrink-0" />{error}
              </div>
            )}
            {isLockedOut && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-300 shadow-sm">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700">Account Temporarily Locked</p>
                  <p className="text-red-600 text-xs mt-0.5">
                    Too many failed attempts. Please wait <span className="font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}</span> before trying again.
                  </p>
                </div>
              </div>
            )}
            {!isLockedOut && loginAttempts > 0 && loginAttempts < 5 && (
              <p className="text-xs text-amber-600 text-center">
                ⚠️ {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout
              </p>
            )}
            <button type="submit" disabled={loading || isLockedOut}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
              style={{ background: isLockedOut ? "#9ca3af" : "linear-gradient(135deg, #059669 0%, #0d9488 100%)", boxShadow: isLockedOut ? "none" : "0 4px 20px rgba(5,150,105,0.3)" }}>
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</> : isLockedOut ? <><Lock size={15} />Account Locked</> : <><Lock size={15} />Sign In to Portal</>}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Shield size={11} className="text-emerald-500" />
              <span>DepEd compliant · Data Privacy Act of 2012 (RA 10173)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Lock size={11} className="text-emerald-500" />
              <span>For authorized school personnel only</span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-300 mt-4">© 2026 Hi5 Portal · DSPMNHS</p>
        </div>
      </div>
    </div>
  );
}
