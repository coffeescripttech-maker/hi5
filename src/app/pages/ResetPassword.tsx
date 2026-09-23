/**
 * Password Reset page — reached from the emailed one-time reset link
 * (/reset-password?token=...). Lets the user set a new password, then returns
 * them to the login screen.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { KeyRound, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi, ApiError } from '../services/api';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const valid = token.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, new_password: password });
      setDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.detail.error || 'Failed to reset password. Please try again.'
          : 'Unable to connect to the server. Please check your connection and try again.'
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="hi5-card hi5-stagger-1 mb-7 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200 flex items-center justify-center">
            <KeyRound size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 leading-tight">
              Hi5 Portal
            </h2>
            <p className="text-gray-500 text-sm">Reset your password</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200/70 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

          {!valid ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={28} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Invalid reset link
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                This link is missing its reset token. Request a new password
                reset from the login page, or copy the full link from the email
                you received.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
                Back to Login
              </button>
            </div>
          ) : done ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={30} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Password Updated!
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Your password has been changed. You can now sign in with your
                new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <Lock size={22} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-800">
                  Create a new password
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  Choose a new password for your account. It must be at least 6
                  characters long.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full pl-9 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm border border-gray-200 focus:ring-emerald-400 focus:border-emerald-400"
                    placeholder="At least 6 characters"
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(v => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => {
                      setConfirm(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full pl-9 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition shadow-sm border border-gray-200 focus:ring-emerald-400 focus:border-emerald-400"
                    placeholder="Re-enter your new password"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                  boxShadow: '0 4px 20px rgba(5,150,105,0.3)'
                }}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Set New Password</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}