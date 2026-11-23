import React, { useState } from 'react';
import { ArrowRight, HardDrive, Lock, Mail, User } from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { sha256Hash, uid } from '../utils/storage';
import type { UserAccount } from '../types';

interface AuthScreenProps {
  existingAccounts: Array<UserAccount & { passwordHash: string }>;
  onAuthenticate: (account: UserAccount, newRecord?: UserAccount & { passwordHash: string }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ existingAccounts, onAuthenticate }) => {
  const [mode, setMode] = useState<'signup' | 'login'>(existingAccounts.length > 0 ? 'login' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const passwordHash = await sha256Hash(`${cleanEmail}:${password}`);

      if (mode === 'signup') {
        if (cleanName.length < 2) {
          setError('Please enter your name (at least 2 characters).');
          setSubmitting(false);
          return;
        }
        const already = existingAccounts.find((a) => a.email === cleanEmail);
        if (already) {
          setError('An account with this email already exists on this device. Try signing in.');
          setSubmitting(false);
          return;
        }
        const initials = cleanName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        const account: UserAccount = {
          id: uid('usr'),
          name: cleanName,
          email: cleanEmail,
          initials: initials || 'PS',
          createdAt: new Date().toISOString(),
          mode: 'local',
        };
        onAuthenticate(account, { ...account, passwordHash });
      } else {
        const found = existingAccounts.find((a) => a.email === cleanEmail);
        if (!found || found.passwordHash !== passwordHash) {
          setError('Incorrect email or password for this device. Create a new local account or continue in guest mode.');
          setSubmitting(false);
          return;
        }
        const { passwordHash: _ignored, ...publicUser } = found;
        onAuthenticate(publicUser);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = () => {
    const guest: UserAccount = {
      id: 'usr-local-traveller',
      name: 'Pavithra',
      email: 'traveller@packsmart.local',
      initials: 'PV',
      createdAt: new Date().toISOString(),
      mode: 'local',
    };
    onAuthenticate(guest);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#FBFAF8] dark:bg-[#0B3B40] px-5 py-8">
      <div className="w-full max-w-md mx-auto">
        <div className="flex flex-col items-center text-center mb-7">
          <BrandLogo size={56} className="mb-4 shadow-md rounded-2xl" />
          <h1 className="font-display text-2xl font-extrabold text-[#0A0A0A] dark:text-white tracking-tight">
            {mode === 'signup' ? 'Create your PackSmart profile' : 'Welcome back to PackSmart'}
          </h1>
          <p className="text-sm text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-1">
            Pack less stress. Travel with confidence.
          </p>
        </div>

        {/* Transparent Local Device Storage notice */}
        <div className="mb-5 p-3.5 rounded-2xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] border border-[#D5DCD9] dark:border-[#FBFAF824] flex items-start gap-3">
          <HardDrive className="w-4 h-4 text-[#0A0A0A] dark:text-[#D5DCD9] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-[#0A0A0Acc] dark:text-[#FBFAF8]">
            <span className="font-semibold text-[#0A0A0A] dark:text-white">Local Offline-First Mode:</span>{' '}
            Your lists, settings, and PIN-locked documents save persistently on this device. Live weather and PackSmart AI connect through the app server when online.
          </div>
        </div>

        <div className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-6 border border-[#0A0A0A1f] dark:border-[#FBFAF824] shadow-sm">
          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#FBFAF8] dark:bg-[#0B3B40] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`min-h-[44px] text-sm font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-white shadow-xs'
                  : 'text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`min-h-[44px] text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-white shadow-xs'
                  : 'text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]'
              }`}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-[#0A0A0Acc] dark:text-[#FBFAF8a8] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#0A0A0A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Pavithra Nair"
                    className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm text-[#0A0A0A] dark:text-white placeholder:text-[#0A0A0A85] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A73]"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-[#0A0A0Acc] dark:text-[#FBFAF8a8] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#0A0A0A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm text-[#0A0A0A] dark:text-white placeholder:text-[#0A0A0A85] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A73]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-[#0A0A0Acc] dark:text-[#FBFAF8a8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#0A0A0A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm text-[#0A0A0A] dark:text-white placeholder:text-[#0A0A0A85] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A73]"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-[#0A0A0A] dark:text-[#E6DFD2] bg-[#E6DFD266] dark:bg-[#FBFAF80f] px-3.5 py-2.5 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <span>{mode === 'signup' ? 'Create Account & Start Packing' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="border-t border-[#0A0A0A1f] dark:border-[#FBFAF824] w-full" />
            <span className="px-3 text-xs text-[#0A0A0A99] bg-white dark:bg-[#FBFAF80f] whitespace-nowrap">or</span>
            <div className="border-t border-[#0A0A0A1f] dark:border-[#FBFAF824] w-full" />
          </div>

          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full min-h-[46px] rounded-2xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] font-semibold text-sm hover:bg-[#D5DCD966] dark:hover:bg-[#FBFAF80f] transition-colors"
          >
            Continue Instantly in Local Demo Mode
          </button>
        </div>
      </div>
    </div>
  );
};
