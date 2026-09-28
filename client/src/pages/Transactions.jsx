import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { emojiFor, formatDateLong, monthKey, monthLabel, money, shiftMonth } from '../lib/format.js';

const KINDS = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
];

export default function Transactions({ onAdd, onEdit }) {
  const { user } = useAuth();
  const toast = useToast();
  const currency = user?.currency || 'INR';
  const [month, setMonth] = useState(monthKey());
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.items.list({ month, kind: kind === 'all' ? undefined : kind }, signal);
        setItems(res.items);
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err.message || 'Could not load transactions.');
      } finally {
        setLoading(false);
      }
    },
    [month, kind],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const income = visible.filter((i) => i.kind === 'income').reduce((s, i) => s + i.amount, 0);
    const expense = visible.filter((i) => i.kind === 'expense').reduce((s, i) => s + i.amount, 0);
    return { income, expense, net: income - expense };
  }, [visible]);

  async function remove(id) {
    setDeleting(true);
    try {
      await api.items.remove(id);
      setItems((list) => list.filter((i) => i.id !== id));
      toast.success('Transaction deleted.');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message || 'Could not delete that.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-[13px] text-slate-500">
            {loading ? 'Loading…' : `${visible.length} shown · ${monthLabel(month)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="btn-ghost px-2.5 py-2" aria-label="Previous month">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Income', value: totals.income, tone: 'text-emerald-600' },
          { label: 'Expenses', value: totals.expense, tone: 'text-rose-600' },
          { label: 'Net', value: totals.net, tone: totals.net >= 0 ? 'text-slate-900' : 'text-rose-600' },
        ].map((s) => (
          <div key={s.label} className="card px-3 py-3 sm:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`mt-1 truncate text-[15px] font-extrabold tabular-nums sm:text-[18px] ${s.tone}`}>
              {money(s.value, currency)}
            </p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="input pl-9"
              type="search"
              placeholder="Search title, note or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={`chip whitespace-nowrap ${kind === k.key ? 'chip-active' : ''}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] font-medium text-rose-700">
          {error}{' '}
          <button type="button" onClick={() => load()} className="font-bold underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : null}

      <Card className="overflow-hidden p-2 sm:p-3">
        {loading ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length ? (
          <ul className="divide-y divide-slate-100">
            {visible.map((it) => (
              <li key={it.id} className="group flex items-center gap-3 px-1 py-3 sm:px-2">
                <button
                  type="button"
                  onClick={() => onEdit(it)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-[18px]">
                    {emojiFor(it.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold text-slate-800">{it.title}</span>
                      {it.aiSummary ? (
                        <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                          AI
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {it.category} · {formatDateLong(it.createdAt)}
                    </span>
                    {it.aiSummary ? (
                      <span className="mt-1 block truncate text-[12px] italic text-indigo-500/90">
                        {it.aiSummary}
                      </span>
                    ) : null}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`text-[15px] font-extrabold tabular-nums ${
                      it.kind === 'income' ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {it.kind === 'income' ? '+' : '−'}
                    {money(it.amount, currency)}
                  </span>
                  {confirmId === it.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => remove(it.id)}
                        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-rose-700"
                      >
                        {deleting ? '…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(it)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Edit ${it.title}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(it.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${it.title}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2m1 0v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-2">
            <EmptyState
              icon={search ? '🔍' : '🧾'}
              title={search ? 'No matches found' : 'Nothing here yet'}
              hint={
                search
                  ? 'Try a different search term or clear the filter.'
                  : 'Add a transaction and it will be saved to your account right away.'
              }
              action={
                search ? (
                  <button type="button" onClick={() => setSearch('')} className="btn-ghost">
                    Clear search
                  </button>
                ) : (
                  <button type="button" onClick={onAdd} className="btn-primary">
                    Add transaction
                  </button>
                )
              }
            />
          </div>
        )}
      </Card>

      <button
        type="button"
        onClick={onAdd}
        className="btn-primary fixed bottom-20 right-4 z-20 h-12 w-12 rounded-full p-0 shadow-lift lg:hidden"
        aria-label="Add transaction"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
