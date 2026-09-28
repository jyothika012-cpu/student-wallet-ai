import { useEffect, useState } from 'react';
import { Avatar, Card, SectionTitle, Spinner } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { formatDateLong, initials, money } from '../lib/format.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'ZAR', 'NGN', 'KES', 'PKR', 'BDT', 'LKR', 'NPR'];

export default function Settings() {
  const { user, updateProfile, signOut } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [budget, setBudget] = useState(
    user?.monthlyBudget ? String(user.monthlyBudget) : '',
  );
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
    setBudget(user?.monthlyBudget ? String(user.monthlyBudget) : '');
    setCurrency(user?.currency || 'INR');
  }, [user]);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setError('');

    const n = budget === '' ? 0 : Number(budget);
    if (!Number.isFinite(n) || n < 0) return setError('Monthly budget must be 0 or a positive number.');

    setSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim(), monthlyBudget: n, currency });
      toast.success('Settings saved.');
    } catch (err) {
      setError(err.message || 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  }

  const healthTone = (value) =>
    value === 'connected' || value === true
      ? 'bg-emerald-400'
      : value === 'not_configured'
        ? 'bg-slate-300'
        : 'bg-rose-400';

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900">Settings</h1>

      <Card className="p-5">
        <div className="flex items-center gap-3.5">
          <Avatar text={initials(user?.fullName, user?.email)} className="h-14 w-14 text-[18px]" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-extrabold text-slate-900">
              {user?.fullName || 'Student'}
            </p>
            <p className="truncate text-[13px] text-slate-500">{user?.email}</p>
            {user?.createdAt ? (
              <p className="mt-0.5 text-[12px] text-slate-400">
                Member since {formatDateLong(user.createdAt)}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Your details" subtitle="Used to personalise the AI coach" />
        <form onSubmit={save} className="space-y-3.5">
          <div>
            <label className="label" htmlFor="s-name">
              Display name
            </label>
            <input
              id="s-name"
              className="input"
              type="text"
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="s-budget">
                Monthly budget
              </label>
              <input
                id="s-budget"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
              />
              <p className="mt-1 text-[11.5px] text-slate-400">0 turns the budget off</p>
            </div>
            <div>
              <label className="label" htmlFor="s-currency">
                Currency
              </label>
              <select
                id="s-currency"
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11.5px] text-slate-400">
                {money(1200, currency)} shows as 1,200
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner className="h-4 w-4" /> : 'Save changes'}
            </button>
            <button type="button" onClick={signOut} className="btn-danger">
              Sign out
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <SectionTitle title="System status" subtitle="Live check from the backend" />
        <ul className="space-y-2.5 text-[13.5px]">
          {[
            { label: 'Backend API', value: health ? 'connected' : 'unreachable' },
            { label: 'Database (Supabase)', value: health?.database ?? 'unknown' },
            { label: 'AI (Gemini)', value: health?.ai ?? 'unknown' },
          ].map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-slate-600">{row.label}</span>
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <span className={`h-2 w-2 rounded-full ${healthTone(row.value)}`} />
                <span className="max-w-[220px] truncate text-[12.5px]">{row.value}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
          All secret keys (Supabase service role, Gemini) live only in the server&apos;s{' '}
          <code className="rounded bg-slate-200/70 px-1 py-0.5 text-[11px]">.env</code> file, which is
          git-ignored. The browser bundle contains no secrets.
        </p>
      </Card>
    </div>
  );
}
