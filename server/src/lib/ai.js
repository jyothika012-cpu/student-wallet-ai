/**
 * AI provider - BACKEND ONLY.
 *
 * Supports two providers, auto-detected from the key in server/.env:
 *   • an OpenAI-compatible provider  (key starts with "sk-")  -> Gemini via OpenRouter
 *   • a Google AI Studio key         (key starts with "AIza") -> Gemini direct
 *
 * Either way the browser only ever calls our own /api/ai routes; the key is
 * never sent to the client.
 */
import { config } from './db.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export const isAiConfigured = () =>
  Boolean(config.aiKey) && Boolean(config.aiModel);

/** Which provider the configured key belongs to. */
export function provider() {
  const key = String(config.aiKey || '');
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openrouter';
  return key ? 'gemini' : 'none';
}

// Kept for readability at call sites.
export const isGeminiConfigured = isAiConfigured;

/* ------------------------------------------------------------ direct ---- */
async function callDirect(prompt, { system, temperature, maxOutputTokens }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt).slice(0, 12000) }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (system) body.systemInstruction = { parts: [{ text: String(system).slice(0, 4000) }] };

  const url = `${ENDPOINT}/${config.aiModel}:generateContent?key=${encodeURIComponent(config.aiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `AI request failed (${res.status}). Please try again in a moment.`,
    );
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }

  return (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
}

/* ---------------------------------------------------- openai-compatible - */
async function callOpenAiCompatible(prompt, { system, temperature, maxOutputTokens }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: String(system).slice(0, 4000) });
  messages.push({ role: 'user', content: String(prompt).slice(0, 12000) });

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.aiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://student-wallet-ai.vercel.app',
      'X-Title': 'Student Wallet AI',
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxOutputTokens ?? 900,
    }),
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.error?.metadata?.raw ||
      `AI request failed (${res.status}). Please try again in a moment.`;
    const err = new Error(String(message).slice(0, 300));
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    const err = new Error('The AI coach had nothing to say this time. Try rephrasing your question.');
    err.status = 502;
    throw err;
  }
  return text.trim();
}

/* ------------------------------------------------------------ public ---- */
/** Call the configured Gemini model and return plain text. */
export async function geminiText(prompt, options = {}) {
  if (!isAiConfigured()) {
    const err = new Error(
      'The AI coach is not switched on yet. Add GEMINI_API_KEY to server/.env to enable it.',
    );
    err.status = 503;
    throw err;
  }
  const kind = provider();
  if (kind === 'openrouter') return callOpenAiCompatible(prompt, options);
  return callDirect(prompt, options);
}

export function providerLabel() {
  const kind = provider();
  if (kind === 'openrouter') return `gemini via openrouter (${config.aiModel})`;
  if (kind === 'gemini') return `gemini direct (${config.aiModel})`;
  return 'not_configured';
}

/** One-line friendly note stored on a transaction row. Never throws. */
export async function writeTransactionNote(tx) {
  if (!isAiConfigured()) return '';
  const amount = Number(tx.amount || 0);
  const kind = tx.kind === 'income' ? 'money received' : 'money spent';
  const prompt = `A student logged ${kind} of ${amount} in category "${tx.category || 'Other'}"${
    tx.description ? ` with the note: "${tx.description}"` : ''
  }, titled "${tx.title}". Write ONE short, friendly sentence (max 18 words) that explains this ${kind} in a useful way for a student's budget. No quotes, no emoji, no preamble.`;
  try {
    return await geminiText(prompt, { temperature: 0.6, maxOutputTokens: 80 });
  } catch {
    return '';
  }
}

const money = (n, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(n || 0),
  );

/** Build a compact snapshot of the user's money for the AI to reason about. */
export function buildContext({ summary, items, user }) {
  const s = summary || {};
  const t = s.totals || {};
  const cur = user?.currency || s.currency || 'INR';
  const lines = [
    `Student: ${user?.fullName || 'Student'} (${user?.email || 'unknown'})`,
    `Month: ${s.month || 'current'}`,
    `Monthly budget: ${user?.monthlyBudget ? money(user.monthlyBudget, cur) : 'not set'}`,
    `Income: ${money(t.income, cur)} | Spending: ${money(t.expense, cur)} | Balance: ${money(t.balance, cur)}`,
  ];
  if (s.categories?.length) {
    lines.push(
      `Spending by category: ${s.categories
        .map((c) => `${c.category} ${money(c.amount, cur)}`)
        .join(', ')}`,
    );
  }
  if (s.daysElapsed && s.daysInMonth) {
    lines.push(`Day ${s.daysElapsed} of ${s.daysInMonth} in this month.`);
  }
  const recent = (items || []).slice(0, 25);
  if (recent.length) {
    lines.push('Recent transactions (newest first):');
    for (const r of recent) {
      lines.push(
        `- ${String(r.createdAt || '').slice(0, 10)} | ${r.kind === 'income' ? '+' : '-'}${money(
          r.amount,
          cur,
        )} | ${r.category} | ${r.title}${r.description ? ` (${r.description})` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

const TASKS = {
  summarize: {
    label: 'Spending summary',
    prompt: () =>
      `Summarise this student's month in at most 4 short sentences. State the biggest spending category, the single biggest thing they could cut, and whether they are on track for the month. Use plain language, no bullet points, no headings.`,
  },
  tips: {
    label: 'Money tips',
    prompt: () =>
      `Give exactly 3 specific, realistic money-saving tips for this student based on their actual numbers. Each tip must be one sentence and mention a concrete amount or action. Start with a line "1." then "2." then "3.". No preamble.`,
  },
  plan: {
    label: 'Spending plan',
    prompt: () =>
      `Create a simple plan for the rest of this month for this student. Give: Safe-to-spend for the remaining days (one line with the amount), then 3 short bullet lines of what to do. Be realistic for a student with a low income.`,
  },
  explain: {
    label: 'Explain this',
    prompt: () =>
      `Look at the recent transactions and point out anything unusual: an expensive one, a repeated habit, or a category that is growing too fast. Answer in 2-3 short sentences and name the amounts.`,
  },
};

/** Run one of the built-in coaching tasks. */
export async function runTask(task, context) {
  const spec = TASKS[task];
  if (!spec) {
    const err = new Error(`Unknown AI task "${task}".`);
    err.status = 400;
    throw err;
  }
  const prompt = `Here is the student's real financial data:\n\n${context}\n\n${spec.prompt(context)}`;
  return geminiText(prompt, { temperature: 0.75, maxOutputTokens: 600 });
}

export const TASKS_AVAILABLE = Object.keys(TASKS);

export { money };
