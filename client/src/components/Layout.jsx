import { NavLink, useLocation } from 'react-router-dom';
import { Avatar, Logo } from './ui.jsx';
import { initials } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </>
    ),
  },
  {
    to: '/transactions',
    label: 'Transactions',
    icon: (
      <>
        <path d="M3 6h13l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
        <path d="M7 12h7M7 16h4" />
      </>
    ),
  },
  {
    to: '/coach',
    label: 'AI Coach',
    spark: true,
    icon: (
      <>
        <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4L12 3Z" />
        <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
      </>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9.1a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
      </>
    ),
  },
];

function NavItem({ item, mobile = false }) {
  const { to, label, icon, spark } = item;
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        mobile
          ? `flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-semibold transition ${
              isActive ? 'text-emerald-600' : 'text-slate-400'
            }`
          : `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-gradient-to-r from-emerald-50 to-transparent text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]'
                : 'text-slate-600 hover:bg-slate-100/70'
            }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`relative flex items-center justify-center rounded-lg transition ${
              mobile ? '' : isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`${mobile ? 'h-[22px] w-[22px]' : 'h-5 w-5'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive ? 2.2 : 1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {icon}
            </svg>
            {spark && !isActive ? (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ) : null}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children, onAdd }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const title =
    NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))?.label || 'Dashboard';

  return (
    <div className="relative z-10 min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/70 bg-white/70 px-4 py-5 backdrop-blur-2xl lg:flex">
        <div className="mb-7 flex items-center gap-2.5 px-1">
          <Logo className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Student Wallet</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
              AI Edition
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavItem key={n.to} item={n} />
          ))}
        </nav>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar text={initials(user?.fullName, user?.email)} className="h-9 w-9 text-[13px]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-slate-800">
                {user?.fullName || 'Student'}
              </p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-white/60 bg-canvas/80 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-[14px] font-extrabold tracking-tight text-slate-900">{title}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                Student Wallet AI
              </p>
            </div>
          </div>
          <button type="button" onClick={onAdd} className="btn-primary px-3 py-2 text-[13px]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        </div>
      </header>

      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:pb-12 lg:pt-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-stretch px-2 py-1.5">
          {NAV.map((n) => (
            <NavItem key={n.to} item={n} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
