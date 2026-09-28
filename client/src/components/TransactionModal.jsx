import { useEffect, useMemo, useState } from 'react';
import { Modal, Spinner } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

const CATEGORIES = [
  'Food & Drinks',
  'Transport',
  'Books & Study',
  'Hostel & Rent',
  'College Fees',
  'Phone & Recharge',
  'Health',
  'Entertainment',
  'Subscriptions',
  'Clothes',
  'Stationery',
  'Part-time Income',
  'Scholarship',
  'Gift',
  'Other',
];

const INCOME_CATEGORIES = ['Part-time Income', 'Scholarship', 'Gift', 'Other'];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toDateInput = (iso) => {
  if (!iso) return todayISO();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayISO();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TransactionModal({ open, onClose, onSaved, editing = null, defaultKind = 'expense' }) {
  const toast = useToast();
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Drinks');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [withAi, setWithAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setWithAi(false);
    if (editing) {
      setKind(editing.kind || 'expense');
      setTitle(editing.title || '');
      setAmount(String(editing.amount ?? ''));
      setCategory(editing.category || 'Food & Drinks');
      setDescription(editing.description || '');
      setDate(toDateInput(editing.createdAt));
    } else {
      setKind(defaultKind);
      setTitle('');
      setAmount('');
      setCategory(defaultKind === 'income' ? 'Part-time Income' : 'Food & Drinks');
      setDescription('');
      setDate(todayISO());
    }
  }, [open, editing, defaultKind]);

  const list = useMemo(
    () => (kind === 'income' ? INCOME_CATEGORIES : CATEGORIES),
    [kind],
  );

  async function handleSubmit(e) {
    e?.preventDefault();
    if (saving) return;
    setError('');

    const value = Number(amount);
    if (!title.trim()) return setError('Give this transaction a short name.');
    if (!Number.isFinite(value) || value < 0) return setError('Enter an amount of 0 or more.');
    if (value > 100_000_000) return setError('That amount looks too large.');

    const payload = {
      title: title.trim(),
      amount: Math.round(value * 100) / 100,
      category,
      kind,
      description: description.trim(),
      date,
      withAi,
    };

    setSaving(true);
    try {
      const res = editing
        ? await api.items.update(editing.id, payload)
        : await api.items.create(payload);
      toast.success(editing ? 'Transaction updated.' : 'Transaction saved.');
      onSaved?.(res.item, Boolean(editing));
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'New transaction'}
      subtitle={editing ? 'Update the details below' : 'Add a spend or money you received'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWithAi((v) => !v)}
            className={`chip ${withAi ? 'chip-active' : ''}`}
            title="Let the AI write a short note about this"
          >
            <span>✨</span> AI note
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" form="txn-form" disabled={saving} className="btn-primary min-w-[104px]">
              {saving ? <Spinner className="h-4 w-4" /> : editing ? 'Save changes' : 'Add'}
            </button>
          </div>
        </div>
      }
    >
      <form id="txn-form" onSubmit={handleSubmit} className="space-y-4">
        {/* kind switch */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/80 p-1">
          {[
            { key: 'expense', label: 'Expense', tone: 'data-[on=true]:bg-white' },
            { key: 'income', label: 'Income', tone: 'data-[on=true]:bg-white' },
          ].map((opt) => {
            const on = kind === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setKind(opt.key);
                  setCategory(opt.key === 'income' ? 'Part-time Income' : 'Food & Drinks');
                }}
                className={`rounded-lg py-2 text-[13.5px] font-semibold transition ${
                  on
                    ? `${opt.tone} text-slate-900 shadow-sm`
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div>
          <label className="label" htmlFor="txn-amount">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-slate-400">
              ₹
            </span>
            <input
              id="txn-amount"
              className="input pl-8 text-[17px] font-bold"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="txn-title">
            What was it?
          </label>
          <input
            id="txn-title"
            className="input"
            type="text"
            maxLength={120}
            placeholder={kind === 'income' ? 'e.g. Freelance design work' : 'e.g. Lunch at canteen'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {list.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`chip ${category === c ? 'chip-active' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="txn-date">
              Date
            </label>
            <input
              id="txn-date"
              className="input"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <p className="pb-2.5 text-[12px] leading-snug text-slate-400">
              {withAi ? 'AI will add a short note.' : 'Tip: tap “AI note” for a smart summary.'}
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="txn-desc">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="txn-desc"
            className="input min-h-[84px] resize-y"
            rows={3}
            maxLength={1000}
            placeholder="Anything worth remembering about this"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
