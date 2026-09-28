import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.getUser());
  const [booting, setBooting] = useState(Boolean(tokenStore.get()));

  const applySession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    tokenStore.setUser(u);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Re-validate the stored session on load so expired tokens never linger.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    api.auth
      .me()
      .then(({ user: u }) => {
        if (!cancelled) {
          tokenStore.setUser(u);
          setUser(u);
        }
      })
      .catch(() => {
        if (!cancelled) signOut();
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  // A 401 from any request means the session is gone.
  useEffect(() => {
    const onOut = () => signOut();
    window.addEventListener('swa:signed-out', onOut);
    return () => window.removeEventListener('swa:signed-out', onOut);
  }, [signOut]);

  const value = useMemo(
    () => ({
      user,
      booting,
      isAuthed: Boolean(user),
      signIn: async (email, password) => {
        const data = await api.auth.login({ email, password });
        applySession(data);
        return data.user;
      },
      signUp: async (payload) => {
        const data = await api.auth.signup(payload);
        applySession(data);
        return data.user;
      },
      updateProfile: async (patch) => {
        const data = await api.auth.update(patch);
        tokenStore.setUser(data.user);
        setUser(data.user);
        return data.user;
      },
      signOut,
    }),
    [user, booting, applySession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
