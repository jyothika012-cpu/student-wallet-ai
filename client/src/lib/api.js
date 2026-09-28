/**
 * Thin API client. The browser NEVER sees a secret key: it only talks to the
 * backend, which holds the Supabase + Gemini credentials in server/.env.
 */
const BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const TOKEN_KEY = 'swa.token';
const USER_KEY = 'swa.user';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* storage blocked */
    }
  },
  clear: () => {
    tokenStore.set(null);
    tokenStore.setUser(null);
  },
};

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(
      'Cannot reach the server. Check your connection and try again.',
      0,
      null,
    );
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('swa:signed-out'));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

const qs = (params = {}) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  });
  const out = s.toString();
  return out ? `?${out}` : '';
};

export const api = {
  health: () => request('/health', { auth: false }),

  auth: {
    signup: (payload) => request('/auth/signup', { method: 'POST', body: payload, auth: false }),
    login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
    me: () => request('/auth/me'),
    update: (patch) => request('/auth/me', { method: 'PATCH', body: patch }),
  },

  items: {
    list: (params, signal) => request(`/items${qs(params)}`, { signal }),
    summary: (month, signal) => request(`/items/summary${qs({ month })}`, { signal }),
    create: (payload) => request('/items', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/items/${id}`, { method: 'PATCH', body: payload }),
    remove: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },

  ai: {
    status: () => request('/ai/status'),
    generate: (payload) => request('/ai/generate', { method: 'POST', body: payload }),
    note: (payload) => request('/ai/note', { method: 'POST', body: payload }),
  },
};

export { BASE as API_BASE };
