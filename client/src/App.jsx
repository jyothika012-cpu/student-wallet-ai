import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import TransactionModal from './components/TransactionModal.jsx';
import { Logo, Spinner } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';
import { useToast } from './lib/toast.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Coach from './pages/Coach.jsx';
import Settings from './pages/Settings.jsx';

function Splash() {
  return (
    <div className="relative z-10 grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-12 w-12 animate-float" />
        <p className="text-[13px] font-semibold text-slate-500">Opening your wallet…</p>
        <Spinner className="h-4 w-4 text-emerald-500" />
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthed, booting } = useAuth();
  const location = useLocation();
  if (booting) return <Splash />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { isAuthed, booting } = useAuth();
  if (booting) return <Splash />;
  if (isAuthed) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const [modal, setModal] = useState({ open: false, item: null });
  const [tick, setTick] = useState(0);

  const openAdd = useCallback(() => setModal({ open: true, item: null }), []);
  const openEdit = useCallback((item) => setModal({ open: true, item }), []);
  const close = useCallback(() => setModal({ open: false, item: null }), []);

  // Remount page data after a create/edit so every list stays in sync.
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    document.title = 'Student Wallet AI - Smart money for students';
  }, []);

  return (
    <>
      <Layout onAdd={openAdd}>
        <Routes>
          <Route path="/" element={<Dashboard key={`d${tick}`} onAdd={openAdd} onEdit={openEdit} />} />
          <Route
            path="/transactions"
            element={<Transactions key={`t${tick}`} onAdd={openAdd} onEdit={openEdit} />}
          />
          <Route path="/coach" element={<Coach />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>

      <button
        type="button"
        onClick={openAdd}
        className="btn-primary fixed bottom-6 right-6 z-20 hidden h-12 gap-2 rounded-full px-5 shadow-lift lg:inline-flex"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add transaction
      </button>

      <TransactionModal
        open={modal.open}
        editing={modal.item}
        onClose={close}
        onSaved={bump}
      />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
