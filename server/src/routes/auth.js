import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, SupabaseError } from '../lib/db.js';
import { requireAuth, signToken, asyncHandler } from '../middleware.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return 'Please enter a valid email address.';
  }
  if (!password || String(password).length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

const publicUser = (p) => ({
  id: p.id,
  email: p.email,
  fullName: p.full_name || '',
  monthlyBudget: Number(p.monthly_budget ?? 0),
  currency: p.currency || 'INR',
  createdAt: p.created_at,
});

/** POST /api/auth/signup */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.fullName || '').trim().slice(0, 80);

    const invalid = validate({ email, password });
    if (invalid) return res.status(400).json({ error: invalid });
    if (password.length > 200) return res.status(400).json({ error: 'Password is too long.' });

    const existing = await db.selectOne('profiles', `email=eq.${encodeURIComponent(email)}`);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const profile = await db.insert('profiles', {
      email,
      password_hash: passwordHash,
      full_name: fullName,
      monthly_budget: 0,
      currency: 'INR',
    });

    return res.status(201).json({ token: signToken(profile), user: publicUser(profile) });
  }),
);

/** POST /api/auth/login */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const profile = await db.selectOne('profiles', `email=eq.${encodeURIComponent(email)}`);
    // Always run a hash comparison so timing does not leak whether the email exists.
    const hash = profile?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
    const ok = await bcrypt.compare(password, hash);

    if (!profile || !profile.password_hash || !ok) {
      return res.status(401).json({ error: 'Wrong email or password.' });
    }

    return res.json({ token: signToken(profile), user: publicUser(profile) });
  }),
);

/** GET /api/auth/me */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await db.selectOne('profiles', `id=eq.${encodeURIComponent(req.user.id)}`);
    if (!profile) return res.status(404).json({ error: 'Account not found.' });
    return res.json({ user: publicUser(profile) });
  }),
);

/** PATCH /api/auth/me - update display name / monthly budget / currency */
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patch = {};
    if (req.body?.fullName !== undefined) {
      patch.full_name = String(req.body.fullName).trim().slice(0, 80);
    }
    if (req.body?.monthlyBudget !== undefined) {
      const n = Number(req.body.monthlyBudget);
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
        return res.status(400).json({ error: 'Monthly budget must be a positive number.' });
      }
      patch.monthly_budget = Math.round(n * 100) / 100;
    }
    if (req.body?.currency !== undefined) {
      const c = String(req.body.currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) return res.status(400).json({ error: 'Currency must be a 3-letter code.' });
      patch.currency = c;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const profile = await db.update('profiles', req.user.id, patch);
    return res.json({ user: publicUser(profile) });
  }),
);

/** POST /api/auth/check-email - friendly duplicate check used by the signup form */
router.post(
  '/check-email',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.json({ available: false, valid: false });
    const existing = await db.selectOne('profiles', `email=eq.${encodeURIComponent(email)}`);
    return res.json({ available: !existing, valid: true });
  }),
);

export default router;
export { publicUser, SupabaseError };
