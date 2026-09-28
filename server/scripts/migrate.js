/**
 * Automatic database setup - creates the Postgres schema, enables RLS and
 * installs the row-level policies. No manual SQL copy/paste needed.
 *
 * Usage:  npm run migrate
 *
 * Two ways to run, checked in this order:
 *   1. SUPABASE_ACCESS_TOKEN  -> Supabase Management API (no DB password needed)
 *   2. DATABASE_URL / SUPABASE_DB_PASSWORD -> direct `pg` connection
 */
import 'dotenv/config';

const E = process.env;

function projectRef() {
  const url = (E.SUPABASE_URL || '').trim();
  const m = url.replace(/^https?:\/\//, '').match(/^([a-z0-9]+)\.supabase\./i);
  return m ? m[1] : null;
}

function buildConnectionString() {
  if (E.DATABASE_URL) return E.DATABASE_URL.trim();
  const url = (E.SUPABASE_URL || '').trim();
  const pass = (E.SUPABASE_DB_PASSWORD || '').trim();
  if (url && pass) {
    const ref = url.replace(/^https?:\/\//, '').split('.')[0];
    return `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres`;
  }
  return null;
}

const hasSupabaseAuth = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE $p$DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles$p$;
    EXECUTE $p$CREATE POLICY "Users can read own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles$p$;
    EXECUTE $p$CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles$p$;
    EXECUTE $p$CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users read own items" ON public.items$p$;
    EXECUTE $p$CREATE POLICY "Users read own items" ON public.items
      FOR SELECT USING (auth.uid() = user_id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users insert own items" ON public.items$p$;
    EXECUTE $p$CREATE POLICY "Users insert own items" ON public.items
      FOR INSERT WITH CHECK (auth.uid() = user_id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users update own items" ON public.items$p$;
    EXECUTE $p$CREATE POLICY "Users update own items" ON public.items
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)$p$;

    EXECUTE $p$DROP POLICY IF EXISTS "Users delete own items" ON public.items$p$;
    EXECUTE $p$CREATE POLICY "Users delete own items" ON public.items
      FOR DELETE USING (auth.uid() = user_id)$p$;
  END IF;
END $$;
`;

const STATEMENTS = [
  `create schema if not exists extensions;`,
  `create extension if not exists "uuid-ossp" with schema extensions;`,
  `create extension if not exists pgcrypto;`,

  `create table if not exists public.profiles (
     id uuid primary key default gen_random_uuid(),
     email text unique not null,
     password_hash text,
     full_name text,
     monthly_budget numeric(12,2) not null default 0,
     currency text not null default 'INR',
     created_at timestamp with time zone not null default now()
   );`,

  `create table if not exists public.items (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references public.profiles(id) on delete cascade,
     title text not null,
     description text,
     amount numeric(12,2) not null default 0 check (amount >= 0),
     category text not null default 'Other',
     kind text not null default 'expense' check (kind in ('expense','income')),
     ai_summary text,
     created_at timestamp with time zone not null default now(),
     updated_at timestamp with time zone not null default now()
   );`,

  // Keep the password hash invisible to any anon key.
  `alter table public.profiles enable row level security;`,
  `alter table public.items enable row level security;`,

  `create index if not exists items_user_id_created_at_idx on public.items (user_id, created_at desc);`,
  `create index if not exists items_user_id_idx on public.items (user_id);`,

  hasSupabaseAuth,

  `grant usage on schema public to anon, authenticated;`,
  `grant select, insert, update, delete on public.profiles to anon, authenticated;`,
  `grant select, insert, update, delete on public.items to anon, authenticated;`,
];

/* ------------------------------------------------------------ runners --- */
async function runViaManagementApi() {
  const ref = projectRef();
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

  console.log(`\nStudent Wallet AI - database setup`);
  console.log(`Using Supabase Management API for project ${ref} ...\n`);

  for (const sql of STATEMENTS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${E.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        detail = JSON.parse(raw).message || raw;
      } catch {
        /* keep raw */
      }
      console.error(`  [fail] ${sql.split('\n')[0].slice(0, 70)}...\n         ${detail}`);
      process.exit(1);
    }
  }
  console.log('  [ok] tables ready (profiles, items)');
  console.log('  [ok] indexes created');
  console.log('  [ok] row level security enabled');
  console.log('  [ok] access policies installed');

  const check = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${E.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query:
        "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('profiles','items') order by table_name;",
    }),
  });
  const checkJson = await check.json();
  const names = (checkJson || []).map((r) => r.table_name).join(', ');
  console.log(`\nVerified tables: ${names}`);
  console.log(`Setup finished at ${new Date().toISOString()}\n`);
}

async function runViaDirectConnection() {
  const conn = buildConnectionString();
  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    console.error('\n[!] The "pg" package is not installed. Run: npm install pg --prefix server\n');
    process.exit(1);
  }

  const sanitised = conn.replace(/:[^:@/]+@/, ':***@');
  console.log(`\nStudent Wallet AI - database setup`);
  console.log(`Connecting to ${sanitised} ...\n`);

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });

  await client.connect();
  console.log('  [ok] connected');

  for (const sql of STATEMENTS) {
    try {
      await client.query(sql);
    } catch (err) {
      console.error(`  [fail] ${sql.split('\n')[0].slice(0, 70)}...\n         ${err.message}`);
      await client.end().catch(() => {});
      process.exit(1);
    }
  }
  console.log('  [ok] tables ready (profiles, items)');
  console.log('  [ok] indexes created');
  console.log('  [ok] row level security enabled');
  console.log('  [ok] access policies installed');

  const { rows } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('profiles','items') order by table_name;
  `);
  console.log(`\nVerified tables: ${rows.map((r) => r.table_name).join(', ')}`);
  console.log(`Setup finished at ${new Date().toISOString()}\n`);
  await client.end();
}

async function main() {
  if (E.SUPABASE_ACCESS_TOKEN && projectRef()) {
    return runViaManagementApi();
  }
  if (buildConnectionString()) {
    return runViaDirectConnection();
  }
  console.error('\n[!] No way to reach the database.');
  console.error('    Add SUPABASE_ACCESS_TOKEN (preferred) or DATABASE_URL to server/.env.\n');
  process.exit(1);
}

main().catch((err) => {
  console.error(`\n[!] Migration failed: ${err.message}\n`);
  if (/password|auth|ENOTFOUND|EHOSTUNREACH|timeout|401|403/i.test(err.message)) {
    console.error('    Tip: check SUPABASE_URL and that the access token has Management API access.\n');
  }
  process.exit(1);
});
