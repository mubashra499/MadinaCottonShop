import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { Package, Mail, Lock, User, Phone, CheckCircle, Eye, EyeOff } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp, user, profile, loading: authLoading, passwordRecovery, clearPasswordRecovery } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const updatePasswordMode = passwordRecovery;
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });

  useEffect(() => {
    if (authLoading || !user) return;
    if (updatePasswordMode) return;
    const dest = profile?.role === 'owner' ? '/owner' : '/account';
    navigate(dest);
  }, [user, profile, authLoading, updatePasswordMode]);

  useEffect(() => {
    const raw = window.location.hash;
    if (raw.includes('error_code=') || raw.includes('error=')) {
      setLinkError('This password reset link is invalid or has expired. Please request a new one.');
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(form.email, form.password);
      if (error) {
        setError(error);
        setLoading(false);
      }
    } else {
      const { error, data } = await signUp(form.email, form.password, form.fullName, form.phone);
      if (error) {
        setError(error);
        setLoading(false);
      } else {
        setLoading(false);
        if (data?.session) {
          setSuccess('Account created! Welcome aboard.');
        } else {
          setSuccess('Account created! You can now sign in.');
          setMode('signin');
          setForm({ ...form, password: '' });
        }
      }
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError(null);
    const appUrl = import.meta.env.VITE_APP_URL?.trim() || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${appUrl}/#/auth`,
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setUpdatePasswordLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatePasswordLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      await supabase.auth.signOut();
      setSuccess('Password updated successfully! You can now sign in with your new password.');
      clearPasswordRecovery();
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('signin');
    }
  };

  if (updatePasswordMode) {
    return (
      <div className="mx-auto flex max-w-md items-center px-4 py-12">
        <div className="card w-full p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Lock size={24} />
            </div>
            <h1 className="font-display text-2xl font-bold">Set New Password</h1>
            <p className="mt-1 text-sm text-neutral-500">Enter your new password below</p>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input px-10" placeholder="At least 8 characters" required minLength={8} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="input px-10" placeholder="Re-enter new password" required minLength={8} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {confirmNewPassword && newPassword !== confirmNewPassword && <p className="mt-1 text-xs text-red-500">Passwords do not match</p>}
            </div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
            <button type="submit" disabled={updatePasswordLoading} className="btn-primary w-full">
              {updatePasswordLoading ? <Spinner size={16} /> : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (resetMode) {
    return (
      <div className="mx-auto flex max-w-md items-center px-4 py-12">
        <div className="card w-full p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Lock size={24} />
            </div>
            <h1 className="font-display text-2xl font-bold">Reset Password</h1>
            <p className="mt-1 text-sm text-neutral-500">Enter your email to receive a reset link</p>
          </div>

          {resetSent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 dark:bg-green-900/20">
                <CheckCircle size={20} className="mt-0.5 flex-shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Reset link sent!</p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">Check your email for a password reset link. The link will expire in one hour.</p>
                </div>
              </div>
              <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail(''); }} className="btn-outline w-full">
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="input pl-10" placeholder="you@example.com" required />
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
              <button type="submit" disabled={resetLoading} className="btn-primary w-full">
                {resetLoading ? <Spinner size={16} /> : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setError(null); }} className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700">
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md items-center px-4 py-12">
      <div className="card w-full p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Package size={24} />
          </div>
          <h1 className="font-display text-2xl font-bold">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h1>
          <p className="mt-1 text-sm text-neutral-500">{mode === 'signin' ? 'Sign in to your account' : 'Join Madina Cotton Shop'}</p>
        </div>

        {linkError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{linkError}</p>}

        {success && (
          <div className="mb-4 flex items-start gap-3 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input pl-10" placeholder="Your name" required />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input pl-10" placeholder="03xx-xxxxxxx" />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input pl-10" placeholder="you@example.com" required />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input px-10" placeholder="••••••••" required minLength={6} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Spinner size={16} /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center">
          {mode === 'signin' && (
            <button onClick={() => { setResetMode(true); setError(null); }} className="text-sm text-neutral-500 hover:text-primary-600">
              Forgot password?
            </button>
          )}
          <p className="text-sm text-neutral-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }} className="font-medium text-primary-600 hover:text-primary-700">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
