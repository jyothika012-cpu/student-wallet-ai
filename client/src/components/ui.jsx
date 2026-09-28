import { useEffect } from 'react';
import { categoryColors, clamp } from '../lib/format.js';

/* ------------------------------------------------------------- brand ---- */
export function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="swaLogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="url(#swaLogo)" />
      <path
        d="M26 62c6.5 0 6.5-24 13-24s6.5 24 13 24 6.5-18 13-18"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------- cards ---- */
export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[17px] font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="truncate text-[13px] text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = '🗒️', title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <p className="text-[15px] font-semibold text-slate-800">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-[13px] text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} />;
}

/* ------------------------------------------------------------ charts ---- */
export function ProgressBar({ value = 0, max = 100, tone = 'brand', className = '' }) {
  const pct = clamp(max > 0 ? (value / max) * 100 : 0, 0, 100);
  const tones = {
    brand: 'from-emerald-400 to-emerald-500',
    rose: 'from-rose-400 to-rose-500',
    amber: 'from-amber-400 to-amber-500',
    indigo: 'from-indigo-400 to-indigo-500',
  };
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${tones[tone] || tones.brand}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Donut({ data = [], size = 168, thickness = 22, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + Number(d.amount || 0), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={thickness} />
        {total > 0 &&
          data.map((d) => {
            const frac = Number(d.amount || 0) / total;
            const len = frac * c;
            const el = (
              <circle
                key={d.category}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color || categoryColors(d.category)[0]}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {centerLabel}
        </span>
        <span className="text-[19px] font-extrabold leading-tight tracking-tight text-slate-900">
          {centerValue}
        </span>
      </div>
    </div>
  );
}

export function MiniBars({ data = [], height = 74, color = '#10B981' }) {
  const max = Math.max(1, ...data.map((d) => Number(d.amount || 0)));
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(3, (Number(d.amount || 0) / max) * (height - 6));
        const isToday = i === data.length - 1;
        return (
          <div
            key={`${d.day}-${i}`}
            title={`Day ${d.day}`}
            className="flex-1 rounded-t-[3px] transition-all duration-500"
            style={{
              height: h,
              background: isToday
                ? 'linear-gradient(180deg,#34D399,#059669)'
                : `linear-gradient(180deg, ${color}66, ${color}33)`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- modal ---- */
export function Modal({ open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex max-h-[92vh] w-full ${maxWidth} animate-scale-in flex-col
          overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-lift sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">{title}</h3>
            {subtitle ? <p className="text-[13px] text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- avatars ---- */
export function Avatar({ text = 'S', className = 'h-10 w-10 text-sm' }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 font-bold text-white shadow-glow ${className}`}
    >
      {text}
    </div>
  );
}

export function Badge({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
