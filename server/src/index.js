import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, isSupabaseConfigured, db } from './lib/db.js';
import { isGeminiConfigured } from './lib/ai.js';
import { notFound, errorHandler } from './middleware.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import aiRoutes from './routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

/* ---------------------------------------------------------------- CORS ---- */
const allowedOrigins = new Set(
  (process.env.CLIENT_URL || config.clientUrl || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
);
allowedOrigins.add('http://localhost:5173');
allowedOrigins.add('http://127.0.0.1:5173');

function corsOk(origin) {
  if (!origin) return true; // curl / same-origin / native apps
  const clean = origin.replace(/\/+$/, '');
  if (allowedOrigins.has(clean)) return true;
  // Allow any Vercel/Render preview + custom domain of the deployed client.
  if (/\.vercel\.app$/i.test(clean) || /\.onrender\.com$/i.test(clean)) return true;
  return process.env.NODE_ENV !== 'production';
}

app.use(
  cors({
    origin(origin, cb) {
      if (corsOk(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.options(/.*/, cors());

/* -------------------------------------------------------- rate limiting --- */
const hits = new Map();
function rateLimit({ windowMs = 60_000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
    }
    return next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > 300_000) hits.delete(k);
}, 300_000).unref();

/* ------------------------------------------------------------- routes ---- */
app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (isSupabaseConfigured()) {
    try {
      await db.ping();
      database = 'connected';
    } catch (err) {
      database = `error: ${err.message}`;
    }
  }
  res.json({
    ok: true,
    service: 'student-wallet-ai',
    time: new Date().toISOString(),
    database,
    ai: isGeminiConfigured() ? 'connected' : 'not_configured',
  });
});

app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 40 }), authRoutes);
app.use('/api/items', rateLimit({ windowMs: 60_000, max: 240 }), itemRoutes);
app.use('/api/ai', rateLimit({ windowMs: 60_000, max: 60 }), aiRoutes);

// Serve the built frontend if it lives next to the server (optional convenience).
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => (err ? next() : undefined));
});

app.use('/api', notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Student Wallet AI API listening on http://0.0.0.0:${PORT}`);
  console.log(`  database: ${isSupabaseConfigured() ? 'configured' : 'NOT CONFIGURED'}`);
  console.log(`  ai:       ${isGeminiConfigured() ? 'configured' : 'NOT CONFIGURED'}`);
});
