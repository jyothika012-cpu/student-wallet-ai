# Student Wallet AI

A student finance app: track every spend, see where the money goes, and get plain-English
advice from an AI money coach that reads your **real** numbers.

```
client/   React 18 + Vite + Tailwind  →  the UI users see (no secrets, ever)
server/   Node + Express              →  the brain (Supabase + Gemini keys live here)
```

## Features

| Area | What it does |
| --- | --- |
| Auth | Email + password sign-up / sign-in, **bcrypt** hashed, JWT session (30 days) so it works on any device |
| Wallet | Full CRUD on transactions: add, edit, delete, search, filter by month and type |
| Insights | Balance / spend / budget-left cards, category donut, daily spending bars |
| Budget | Monthly budget with a live progress bar and a "safe to spend per day" figure |
| AI Coach | Gemini-powered summaries, 3 tips, a rest-of-month plan, odd-spend detection and free chat — all on your own data |
| Safety | RLS enabled in Postgres, per-user ownership checks on every route, all secrets in `server/.env` |

## Local setup

```bash
# 1. backend
cd server
npm install
cp .env.example .env      # then fill in your keys
npm run migrate           # creates tables + RLS policies automatically
npm run dev               # http://localhost:8787

# 2. frontend
cd ../client
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so there are no CORS issues locally.
In production set `VITE_API_BASE_URL` to the deployed backend URL.

## Environment

**`server/.env` (never committed, never sent to the browser)**

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs session tokens |
| `CLIENT_URL` | Comma-separated list of allowed browser origins (CORS) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (server side only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side data access |
| `DATABASE_URL` / `SUPABASE_DB_PASSWORD` | Used by `npm run migrate` to create the tables |
| `GEMINI_API_KEY` | Google Gemini, called from the backend only |

**`client/.env` (safe to ship — contains no secrets)**

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the deployed backend |

## API

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | – | Create an account |
| POST | `/api/auth/login` | – | Sign in |
| GET | `/api/auth/me` | ✅ | Current user |
| PATCH | `/api/auth/me` | ✅ | Update name / budget / currency |
| GET | `/api/items?month=YYYY-MM&kind=` | ✅ | List own transactions |
| GET | `/api/items/summary?month=` | ✅ | Totals, category split, daily spend |
| POST | `/api/items` | ✅ | Create a transaction |
| PATCH | `/api/items/:id` | ✅ | Update own transaction |
| DELETE | `/api/items/:id` | ✅ | Delete own transaction |
| POST | `/api/ai/generate` | ✅ | `{ task, prompt, month }` → AI answer |
| POST | `/api/ai/note` | ✅ | Short AI note for one transaction |
| GET | `/api/health` | – | Database + AI status |

## Database

Created automatically by `npm run migrate`:

- **profiles** — `id` (uuid pk), `email` (unique), `password_hash`, `full_name`, `monthly_budget`, `currency`, `created_at`
- **items** — `id` (uuid pk), `user_id` (fk → profiles, cascade), `title`, `description`, `amount`, `category`, `kind`, `ai_summary`, `created_at`, `updated_at`
- Row Level Security on both tables with "own rows only" policies.
