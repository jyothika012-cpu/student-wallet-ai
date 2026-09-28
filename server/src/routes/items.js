import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { writeTransactionNote } from '../lib/ai.js';

const router = Router();

export const CATEGORIES = [
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

const KINDS = ['expense', 'income'];

const serialise = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  amount: Number(r.amount ?? 0),
  category: r.category || 'Other',
  kind: r.kind === 'income' ? 'income' : 'expense',
  aiSummary: r.ai_summary || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at || r.created_at,
});

function monthWindow(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return null;
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildQuery(userId, { month, kind, category } = {}) {
  const parts = [`user_id=eq.${encodeURIComponent(userId)}`];
  const win = monthWindow(month);
  if (win) {
    parts.push(
      `and=(created_at.gte.${encodeURIComponent(win.start)},created_at.lt.${encodeURIComponent(win.end)})`,
    );
  }
  if (kind && KINDS.includes(kind)) parts.push(`kind=eq.${kind}`);
  if (category) parts.push(`category=eq.${encodeURIComponent(String(category).slice(0, 40))}`);
  parts.push('order=created_at.desc,id.desc');
  parts.push('limit=500');
  return parts.join('&');
}

function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) errors.push('Give this transaction a short name.');
    else if (title.length > 120) errors.push('Name must be 120 characters or less.');
    else out.title = title;
  }

  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push('Amount must be 0 or more.');
    else if (amount > 100_000_000) errors.push('That amount looks too large.');
    else out.amount = Math.round(amount * 100) / 100;
  }

  if (body.description !== undefined) {
    out.description = String(body.description ?? '').trim().slice(0, 1000);
  }

  if (body.category !== undefined) {
    const category = String(body.category ?? '').trim().slice(0, 40);
    out.category = category || 'Other';
  }

  if (!partial || body.kind !== undefined) {
    const kind = String(body.kind ?? 'expense').toLowerCase();
    if (!KINDS.includes(kind)) errors.push('Type must be either expense or income.');
    else out.kind = kind;
  }

  if (body.aiSummary !== undefined) {
    out.ai_summary = String(body.aiSummary ?? '').trim().slice(0, 600);
  }

  if (body.date !== undefined) {
    const raw = String(body.date).trim();
    if (raw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        errors.push('Date must look like 2026-09-28.');
      } else {
        const parsed = new Date(`${raw}T12:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
          errors.push('That date could not be read.');
        } else if (parsed.getTime() > Date.now() + 86_400_000) {
          errors.push('Date cannot be in the future.');
        } else {
          out.created_at = parsed.toISOString();
        }
      }
    }
  }

  return { out, errors };
}

/** GET /api/items - list the signed-in user's own transactions */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db.select('items', buildQuery(req.user.id, req.query));
    res.json({ items: rows.map(serialise) });
  }),
);

/** GET /api/items/summary?month=YYYY-MM - totals, category split and recent activity */
router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const rows = (await db.select('items', buildQuery(req.user.id, { month }))).map(serialise);

    let income = 0;
    let expense = 0;
    const byCategory = new Map();
    const byDay = new Map();
    const dayCount = new Date();
    const daysInMonth = new Date(dayCount.getFullYear(), dayCount.getMonth() + 1, 0).getDate();
    const today = new Date().getDate();
    const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

    for (const r of rows) {
      if (r.kind === 'income') income += r.amount;
      else {
        expense += r.amount;
        byCategory.set(r.category, (byCategory.get(r.category) || 0) + r.amount);
        const day = String(r.createdAt || '').slice(8, 10);
        if (day) byDay.set(Number(day), (byDay.get(Number(day)) || 0) + r.amount);
      }
    }

    const categories = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    const daily = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      daily.push({ day: d, amount: Math.round((byDay.get(d) || 0) * 100) / 100 });
    }

    res.json({
      month,
      currency: req.user.currency || 'INR',
      totals: {
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        balance: Math.round((income - expense) * 100) / 100,
        count: rows.length,
      },
      categories,
      daily,
      isCurrentMonth,
      daysInMonth,
      daysElapsed: isCurrentMonth ? today : daysInMonth,
      topCategory: categories[0] || null,
    });
  }),
);

/** GET /api/items/categories */
router.get('/categories', (_req, res) => res.json({ categories: CATEGORIES, kinds: KINDS }));

/** POST /api/items - create a transaction for the signed-in user */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { out, errors } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0] });

    if (req.body?.withAi) {
      out.ai_summary = await writeTransactionNote(out);
    }

    const row = await db.insert('items', { ...out, user_id: req.user.id });
    return res.status(201).json({ item: serialise(row) });
  }),
);

/** PATCH /api/items/:id - only the owner can update */
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.selectOne(
      'items',
      `id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(req.user.id)}`,
    );
    if (!existing) return res.status(404).json({ error: 'That transaction was not found.' });

    const { out, errors } = validateBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors[0] });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    if (req.body?.withAi) {
      out.ai_summary = await writeTransactionNote({ ...existing, ...out });
    }

    const row = await db.update('items', req.params.id, out);
    return res.json({ item: serialise(row) });
  }),
);

/** DELETE /api/items/:id - only the owner can delete */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await db.selectOne(
      'items',
      `id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(req.user.id)}`,
    );
    if (!existing) return res.status(404).json({ error: 'That transaction was not found.' });
    await db.remove('items', req.params.id);
    return res.json({ ok: true, id: req.params.id });
  }),
);

export default router;
