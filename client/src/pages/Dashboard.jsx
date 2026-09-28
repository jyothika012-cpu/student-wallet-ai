import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Donut, EmptyState, MiniBars, ProgressBar, SectionTitle, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { categoryColors, emojiFor, formatDate, monthKey, monthLabel, money, relativeTime, shiftMonth } from '../lib/format.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ label, value, sub, tone = 'slate', icon }) {
  const tones = {
    slate: 'text-slate-900',
    brand: 'text-emerald-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="card animate-fade-up p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span className="text-[16px] leading-none">{icon}</span>
      </div>
      <p className={`mt-2 text-[22px] font-extrabold leading-none tracking-tight sm:text-[24px] ${tones[tone]}`}>
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function Dashboard({ onAdd, onEdit }) {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const [month, setMonth] = useState(monthKey());
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const [s, list] = await Promise.all([
          api.items.summary(month, signal),
          api.items.list({ month }, signal),
        ]);
        setSummary(s);
        setItems(list.items);
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err.message || 'Could not load your wallet.');
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const totals = summary?.totals || { income: 0, expense: 0, balance: 0, count: 0 };
  const budget = Number(user?.monthlyBudget || 0);
  const used = totals.expense;
  const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
  const left = budget > 0 ? budget - used : 0;
  const dailyLeft = budget > 0 && summary?.daysElapsed ? left / Math.max(1, summary.daysInMonth - summary.daysElapsed + 1) : 0;

  const donutData = useMemo(
    () => (summary?.categories || []).slice(0, 6).map((c) => ({ ...c, color: categoryColors(c.category)[0] })),
    [summary],
  );

  const recent = items.slice(0, 6);
  const hasData = items.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-emerald-600">
            {greeting()}
            {user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''} 👋
          </p>
          <h1 className="mt-0.5 text-[24px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
            {monthLabel(month)}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="btn-ghost px-2.5 py-2" aria-label="Previous month">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button type="button" onClick={() => setMonth(monthKey())} className="btn-ghost px-3 py-2 text-[13px]">
            This month
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= monthKey()}
            className="btn-ghost px-2.5 py-2 disabled:opacity-40"
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] font-medium text-rose-700">
          {error}{' '}
          <button type="button" onClick={() => load()} className="font-bold underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {loading && !summary ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-6 w-28" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Balance"
              icon="💼"
              tone={totals.balance >= 0 ? 'brand' : 'rose'}
              value={money(totals.balance, currency)}
              sub={`${totals.count} transaction${totals.count === 1 ? '' : 's'} this month`}
            />
            <StatCard
              label="Spent"
              icon="💸"
              tone="rose"
              value={money(totals.expense, currency)}
              sub={totals.income > 0 ? `of ${money(totals.income, currency)} received` : 'No income logged yet'}
            />
            <StatCard
              label="Budget left"
              icon="🎯"
              tone={budget > 0 && left <= 0 ? 'rose' : 'slate'}
              value={budget > 0 ? money(Math.max(0, left), currency) : 'Not set'}
              sub={
                budget > 0
                  ? `${Math.round(pct)}% of ${money(budget, currency)} used`
                  : 'Set a budget in Settings'
              }
            />
          </>
        )}
      </div>

      {/* Budget + breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="animate-fade-up p-5 lg:col-span-3">
          <SectionTitle title="Where your money went" subtitle="Spending by category" />
          {loading && !summary ? (
            <Skeleton className="mx-auto h-[168px] w-[168px] rounded-full" />
          ) : donutData.length ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <Donut
                data={donutData}
                centerLabel="Total spent"
                centerValue={money(totals.expense, currency, true)}
              />
              <ul className="w-full flex-1 space-y-2">
                {summary.categories.slice(0, 6).map((c) => {
                  const share = totals.expense > 0 ? (c.amount / totals.expense) * 100 : 0;
                  return (
                    <li key={c.category} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: categoryColors(c.category)[0] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-slate-700">
                        {emojiFor(c.category)} {c.category}
                      </span>
                      <span className="text-[12.5px] font-semibold tabular-nums text-slate-500">
                        {Math.round(share)}%
                      </span>
                      <span className="w-20 text-right text-[13.5px] font-bold tabular-nums text-slate-900">
                        {money(c.amount, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon="📊"
              title="Nothing to chart yet"
              hint="Add your first transaction and this fills up instantly."
              action={
                <button type="button" onClick={onAdd} className="btn-primary">
                  Add a transaction
                </button>
              }
            />
          )}
        </Card>

        <Card className="animate-fade-up p-5 lg:col-span-2">
          <SectionTitle
            title="Monthly budget"
            subtitle={budget > 0 ? `${money(budget, currency)} planned` : 'Not set yet'}
            action={
              <Link to="/settings" className="text-[12.5px] font-bold text-emerald-600 hover:underline">
                Edit
              </Link>
            }
          />

          {budget > 0 ? (
            <div className="mt-1 space-y-4">
              <div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
                    {money(Math.max(0, left), currency)}
                  </span>
                  <span className="text-[12.5px] font-semibold text-slate-500">left to spend</span>
                </div>
                <ProgressBar
                  value={used}
                  max={budget}
                  tone={pct > 90 ? 'rose' : pct > 70 ? 'amber' : 'brand'}
                />
                <p className="mt-2 text-[12.5px] text-slate-500">
                  {money(used, currency)} of {money(budget, currency)} used ({Math.round(pct)}%)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                    Per day left
                  </p>
                  <p className="mt-1 text-[18px] font-extrabold tracking-tight text-slate-900">
                    {money(dailyLeft, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                    Day
                  </p>
                  <p className="mt-1 text-[18px] font-extrabold tracking-tight text-slate-900">
                    {summary?.daysElapsed ?? '-'}
                    <span className="text-[13px] font-semibold text-slate-400">/{summary?.daysInMonth ?? '-'}</span>
                  </p>
                </div>
              </div>

              {left <= 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] font-medium text-amber-800">
                  You are over budget this month. The AI coach can help you plan the next one.
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon="🎯"
              title="Set a monthly budget"
              hint="A number for the whole month keeps the AI coach honest and useful."
              action={
                <Link to="/settings" className="btn-primary">
                  Set budget
                </Link>
              }
            />
          )}

          <div className="mt-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-glow">
            <p className="text-[13px] font-bold">Ask the AI coach</p>
            <p className="mt-1 text-[12.5px] leading-snug text-emerald-50/90">
              Get a plain-English summary of this month in one tap.
            </p>
            <Link to="/coach" className="btn mt-3 w-full bg-white/95 py-2 text-[13px] text-emerald-700 hover:bg-white">
              Open coach
            </Link>
          </div>
        </Card>
      </div>

      {/* Daily rhythm */}
      <Card className="animate-fade-up p-5">
        <SectionTitle
          title="Daily spending"
          subtitle={summary ? `${money(totals.expense, currency)} across ${summary.daysInMonth} days` : ''}
        />
        {loading && !summary ? (
          <Skeleton className="h-[74px] w-full" />
        ) : summary?.daily?.length ? (
          <>
            <MiniBars data={summary.daily} />
            <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
              <span>1</span>
              <span>{Math.round((summary.daysInMonth || 30) / 2)}</span>
              <span>{summary.daysInMonth}</span>
            </div>
          </>
        ) : null}
      </Card>

      {/* Recent */}
      <Card className="animate-fade-up p-5">
        <SectionTitle
          title="Recent transactions"
          subtitle={hasData ? 'Tap any row to edit it' : ''}
          action={
            hasData ? (
              <Link to="/transactions" className="text-[12.5px] font-bold text-emerald-600 hover:underline">
                View all
              </Link>
            ) : null
          }
        />
        {loading && !items.length ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : recent.length ? (
          <ul className="-mx-1 divide-y divide-slate-100">
            {recent.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onEdit(it)}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-[17px]">
                    {emojiFor(it.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-slate-800">
                      {it.title}
                    </span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {it.category} · {formatDate(it.createdAt)} · {relativeTime(it.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[15px] font-extrabold tabular-nums ${
                      it.kind === 'income' ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {it.kind === 'income' ? '+' : '−'}
                    {money(it.amount, currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="🧾"
            title="No transactions this month"
            hint="Everything you add shows up here instantly and stays synced to your account."
            action={
              <button type="button" onClick={onAdd} className="btn-primary">
                Add your first one
              </button>
            }
          />
        )}
      </Card>
    </div>
  );
}
