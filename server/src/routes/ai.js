import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth, asyncHandler } from '../middleware.js';
import { geminiText, runTask, buildContext, writeTransactionNote, isAiConfigured, providerLabel } from '../lib/ai.js';

const router = Router();

const SYSTEM_PROMPT = `You are "Paisa", a warm, practical AI money coach built into a student finance app.
Rules:
- Be encouraging and never guilt the student about spending.
- Be concrete: always use the real numbers you are given.
- Keep answers short (under 120 words) unless asked for a plan.
- Use plain text. No markdown headings, no tables, minimal emoji (at most one).
- If the student has almost no data, give general advice and ask one short question.`;

async function loadContext(req) {
  const month = req.body?.month || new Date().toISOString().slice(0, 7);
  const filter = `user_id=eq.${encodeURIComponent(req.user.id)}&order=created_at.desc&limit=40`;
  const items = await db.select('items', filter);
  const profile = await db.selectOne('profiles', `id=eq.${encodeURIComponent(req.user.id)}`);

  const income = items.filter((r) => r.kind === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
  const expenses = items.filter((r) => r.kind !== 'income');
  const expense = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byCategory = new Map();
  for (const r of expenses) {
    byCategory.set(r.category || 'Other', (byCategory.get(r.category || 'Other') || 0) + Number(r.amount || 0));
  }

  const summary = {
    month,
    currency: profile?.currency || 'INR',
    totals: { income, expense, balance: income - expense, count: items.length },
    categories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };

  const user = {
    fullName: profile?.full_name,
    email: profile?.email,
    monthlyBudget: Number(profile?.monthly_budget || 0),
  };

  return { context: buildContext({ summary, items, user }), itemsCount: items.length };
}

/**
 * POST /api/ai/generate
 * body: { task?: 'summarize'|'tips'|'plan'|'explain'|'chat', prompt?: string, month?: string }
 */
router.post(
  '/generate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = String(req.body?.task || 'chat');
    const prompt = String(req.body?.prompt || '').trim();
    const { context, itemsCount } = await loadContext(req);

    if (!isAiConfigured()) {
      return res.status(503).json({
        error: 'The AI coach is not switched on yet. Add GEMINI_API_KEY to server/.env to enable it.',
        configured: false,
      });
    }

    let reply;
    if (task === 'chat') {
      if (!prompt) return res.status(400).json({ error: 'Ask the coach a question first.' });
      reply = await geminiText(
        `Here is the student's real financial data:\n\n${context}\n\nStudent's question: ${prompt}\n\nAnswer directly and helpfully.`,
        { system: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 500 },
      );
    } else {
      reply = await runTask(task, context);
    }

    return res.json({ reply, task, month: req.body?.month || null, itemsCount });
  }),
);

/** POST /api/ai/note - short AI note for one transaction (used by the edit form) */
router.post(
  '/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await writeTransactionNote(req.body || {});
    if (!note) {
      return res.status(503).json({ error: 'The AI coach is not switched on yet.' });
    }
    return res.json({ aiSummary: note });
  }),
);

/** GET /api/ai/status */
router.get('/status', (_req, res) => res.json({ configured: isAiConfigured() }));

export default router;
