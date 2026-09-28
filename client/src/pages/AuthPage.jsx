import { useState } from 'react';
import { Logo, Spinner } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';

const HIGHLIGHTS = [
  { emoji: '⚡️', title: 'Log in 5 seconds', text: 'Canteen lunch, bus pass, course fees - add it before you forget.' },
  { emoji: '🧠', title: 'AI money coach', text: 'Gemini reads your real spending and tells you exactly what to cut.' },
  { emoji: '🎯', title: 'Budget that works', text: 'Set a monthly budget and watch a live progress bar, not a guilt trip.' },
];

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');

    const email = form.email.trim().toLowerCase();
    if (!email) return setError('Please enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('That email address looks incomplete.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      if (isLogin) {
        await signIn(email, form.password);
        toast.success('Welcome back!');
      } else {
        await signUp({ email, password: form.password, fullName: form.fullName.trim() });
        toast.success('Account created. Let’s get you set up!');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative overflow-hidden px-6 pb-10 pt-10 lg:flex lg:w-[52%] lg:flex-col lg:justify-center lg:px-16 lg:py-0">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />

        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <div className="leading-tight">
              <p className="text-[19px] font-extrabold tracking-tight text-slate-900">Student Wallet AI</p>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                Smart money for students
              </p>
            </div>
          </div>

          <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-[38px]">
            Know where your money goes,
            <span className="bg-gradient-to-r from-emerald-500 to-indigo-500 bg-clip-text text-transparent">
              {' '}
              before the month ends.
            </span>
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
            A calm little money dashboard built for students - plus an AI coach that turns your
            spending into actual, doable advice.
          </p>

          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-3.5 shadow-soft backdrop-blur-xl"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[17px] shadow-sm">
                  {h.emoji}
                </span>
                <div>
                  <p className="text-[14px] font-bold text-slate-800">{h.title}</p>
                  <p className="text-[13px] leading-snug text-slate-500">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 pb-12 lg:px-10 lg:pb-0">
        <div className="w-full max-w-[420px]">
          <div className="card animate-fade-up p-6 sm:p-7">
            <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100/90 p-1.5">
              {[
                { key: 'login', label: 'Sign in' },
                { key: 'signup', label: 'Create account' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchMode(t.key)}
                  className={`rounded-lg py-2 text-[14px] font-bold transition ${
                    mode === t.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <h2 className="text-[21px] font-extrabold tracking-tight text-slate-900">
              {isLogin ? 'Welcome back' : 'Start your wallet'}
            </h2>
            <p className="mb-5 text-[13.5px] text-slate-500">
              {isLogin
                ? 'Sign in on any device - your data is waiting for you.'
                : 'Free, takes 20 seconds, no card needed.'}
            </p>

            <form onSubmit={submit} className="space-y-3.5">
              {!isLogin ? (
                <div>
                  <label className="label" htmlFor="name">
                    Your name
                  </label>
                  <input
                    id="name"
                    className="input"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Aarav Sharma"
                    value={form.fullName}
                    onChange={set('fullName')}
                  />
                </div>
              ) : null}

              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@college.edu"
                  value={form.email}
                  onChange={set('email')}
                />
              </div>

              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    className="input pr-11"
                    type={show ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? (
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M2 2l20 20" />
                        <path d="M6.61 6.61A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.39-1.61" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-700">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">
                {busy ? (
                  <Spinner className="h-4 w-4" />
                ) : isLogin ? (
                  'Sign in'
                ) : (
                  'Create my wallet'
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-400">
              Passwords are hashed with <span className="font-semibold text-slate-500">bcrypt</span> and
              never stored in plain text. Your data is private to your account.
            </p>
          </div>

          <p className="mt-5 text-center text-[12.5px] text-slate-500 lg:hidden">
            {isLogin ? 'New here?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? 'signup' : 'login')}
              className="font-bold text-emerald-600 underline-offset-2 hover:underline"
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
