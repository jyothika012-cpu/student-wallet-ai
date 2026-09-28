/**
 * Supabase data-access layer.
 *
 * Every call goes to PostgREST with the SERVICE ROLE key from server/.env.
 * The service role key never leaves the backend: the browser only ever talks
 * to this Express server.
 */

const ENV = process.env;

/**
 * Accepts either the bare project URL (https://abc.supabase.co) or the full
 * PostgREST URL (https://abc.supabase.co/rest/v1/) and always returns the base.
 */
function normaliseSupabaseUrl(raw) {
  let url = String(raw || '').trim().replace(/\/+$/, '');
  url = url.replace(/\/rest\/v\d+$/i, '');
  url = url.replace(/\/(auth|storage|functions)$/i, '');
  return url;
}

export const config = {
  url: normaliseSupabaseUrl(ENV.SUPABASE_URL),
  anonKey: ENV.SUPABASE_ANON_KEY || '',
  serviceRoleKey: ENV.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiKey: ENV.GEMINI_API_KEY || '',
  geminiModel: ENV.GEMINI_MODEL || 'gemini-2.0-flash',
  jwtSecret: ENV.JWT_SECRET || 'dev-only-insecure-secret',
  clientUrl: ENV.CLIENT_URL || 'http://localhost:5173',
};

export const isSupabaseConfigured = () =>
  Boolean(config.url && config.serviceRoleKey);

class SupabaseError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
    this.details = details;
  }
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  if (!isSupabaseConfigured()) {
    throw new SupabaseError(
      'Database is not configured yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server/.env',
      503,
    );
  }

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error || data.hint)) || `Database request failed (${res.status})`;
    throw new SupabaseError(message, res.status, data);
  }
  return data;
}

const RETURN_REP = 'return=representation';

export const db = {
  /** Insert one row, return the created row. */
  async insert(table, row) {
    const rows = await rest(table, {
      method: 'POST',
      body: [row],
      prefer: RETURN_REP,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /** Select rows. `query` is a PostgREST query string, e.g. `id=eq.1&select=*`. */
  async select(table, query = 'select=*') {
    const rows = await rest(`${table}?${query}`);
    return Array.isArray(rows) ? rows : [];
  },

  /** Select exactly one row (first match) or null. */
  async selectOne(table, query = 'select=*') {
    const rows = await db.select(table, `${query}&limit=1`);
    return rows[0] ?? null;
  },

  /** Patch a single row by uuid, return updated row. */
  async update(table, id, patch) {
    const rows = await rest(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
      prefer: RETURN_REP,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /** Delete a single row by uuid, return deleted row. */
  async remove(table, id) {
    const rows = await rest(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      prefer: RETURN_REP,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /** Health probe. */
  async ping() {
    await rest('profiles?select=id&limit=1');
    return true;
  },
};

export { SupabaseError };
