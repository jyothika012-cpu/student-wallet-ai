import { useEffect, useRef, useState } from 'react';
import { Card, Logo, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { initials, monthKey } from '../lib/format.js';

const ACTIONS = [
  {
    task: 'summarize',
    emoji: '📝',
    title: 'Summarise my month',
    text: 'A 4-line honest recap of where everything went.',
  },
  {
    task: 'tips',
    emoji: '💡',
    title: 'Give me 3 tips',
    text: 'Specific, realistic things to cut starting today.',
  },
  {
    task: 'plan',
    emoji: '🗓️',
    title: 'Plan the rest of this month',
    text: 'Safe-to-spend number plus a mini plan.',
  },
  {
    task: 'explain',
    emoji: '🔍',
    title: 'Find anything odd',
    text: 'Spots expensive or repeated spending patterns.',
  },
];

const STARTERS = [
  'Where can I save the most this month?',
  'Is my food spending out of control?',
  'I want to save ₹500 by month end - how?',
  'Why is my balance going down?',
];

let messageId = 0;

export default function Coach() {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiReady, setAiReady] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.ai
      .status()
      .then((s) => alive && setAiReady(Boolean(s.configured)))
      .catch(() => alive && setAiReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  function push(role, text) {
    messageId += 1;
    setMessages((m) => [...m, { id: messageId, role, text }]);
  }

  async function ask(task, prompt) {
    if (busy) return;
    const question = prompt?.trim();
    if (task === 'chat' && !question) return;

    if (task === 'chat') push('user', question);
    else push('user', `${ACTIONS.find((a) => a.task === task)?.title || 'Coach'} →`);

    setBusy(true);
    try {
      const res = await api.ai.generate({ task, prompt: question, month: monthKey() });
      push('ai', res.reply);
    } catch (err) {
      if (err.status === 503) {
        setAiReady(false);
        push('ai', 'The AI coach is not switched on yet. Add GEMINI_API_KEY to server/.env and I will be live.');
      } else {
        push('ai', `Sorry, I could not do that just now. ${err.message}`);
        toast.error('AI request failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    ask('chat', q);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-glow">
          <Logo className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">AI Coach</h1>
          <p className="text-[13px] text-slate-500">
            Hi {user?.fullName?.split(' ')[0] || 'there'} - I read your real numbers before I answer.
          </p>
        </div>
      </div>

      {aiReady === false ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
          The Gemini key is not configured on the server yet, so live answers are paused. Your wallet
          and transactions still work perfectly.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <button
            key={a.task}
            type="button"
            disabled={busy}
            onClick={() => ask(a.task)}
            className="card flex items-start gap-3 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[18px]">
              {a.emoji}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-slate-800">{a.title}</span>
              <span className="block text-[12.5px] leading-snug text-slate-500">{a.text}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="flex min-h-[380px] flex-col p-4">
        <div className="flex-1 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <span className="mb-3 text-4xl">👋</span>
              <p className="max-w-xs text-[14px] font-semibold text-slate-700">
                Ask me anything about your money.
              </p>
              <p className="mt-1 max-w-xs text-[13px] text-slate-500">
                I only see your own transactions - never anyone else's.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex animate-fade-up items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'ai' ? (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-[11px] font-bold text-white">
                    AI
                  </span>
                ) : null}
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-md bg-slate-900 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'user' ? (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-bold text-slate-700">
                    {initials(user?.fullName, user?.email)}
                  </span>
                ) : null}
              </div>
            ))
          )}
          {busy ? (
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-[11px] font-bold text-white">
                AI
              </span>
              <span className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-400">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {messages.length === 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask('chat', s)}
                className="chip text-left text-[12.5px]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-100 pt-3">
          <textarea
            ref={inputRef}
            className="input max-h-32 min-h-[46px] resize-none py-3"
            rows={1}
            placeholder="Ask about your spending…"
            value={input}
            disabled={busy}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary h-[46px] w-[46px] shrink-0 p-0"
            aria-label="Send"
          >
            {busy ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7-7 7-7-7Z" />
                <path d="M12 19V5" />
              </svg>
            )}
          </button>
        </form>
      </Card>

      <p className="pb-2 text-center text-[11.5px] leading-relaxed text-slate-400">
        Powered by Google Gemini, called only from the backend. Your password and API keys never
        reach the browser.
      </p>
    </div>
  );
}
