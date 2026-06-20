import React from "react";
import { useNavigate } from "react-router";
import { Home, FileQuestion, ArrowLeft } from "lucide-react";
import logoImage from "../../assets/7bbc1fa74b8ecc07e723d0d3864673c9601cbba5.png";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #93c5fd, transparent 70%)" }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #60a5fa, transparent 70%)" }} />

      <div className="relative z-10 text-center max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-400/30 bg-white/10">
            <img src={logoImage} alt="Hi5 Portal" className="w-full h-full object-contain p-1" />
          </div>
        </div>

        {/* 404 */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-12 bg-blue-400/30" />
          <p className="text-7xl font-black text-white/10 select-none tracking-tight">404</p>
          <div className="h-px w-12 bg-blue-400/30" />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-blue-800/60 border border-blue-600/40 flex items-center justify-center mx-auto mb-5">
          <FileQuestion size={28} className="text-blue-300" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-blue-200/70 text-sm mb-2">
          The page you're looking for doesn't exist or you may not have access to it.
        </p>
        <p className="text-blue-300/50 text-xs mb-8">Hi5 Portal · DSPMNHS · SY 2025–2026</p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-200 border border-blue-600/40 hover:bg-blue-800/50 transition"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 15px rgba(37,99,235,0.4)" }}
          >
            <Home size={15} /> Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
