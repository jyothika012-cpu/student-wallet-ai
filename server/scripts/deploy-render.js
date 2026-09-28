/**
 * Creates / updates the Render web service for the backend and syncs all env
 * vars from server/.env. Run:  node scripts/deploy-render.js
 */
import 'dotenv/config';
import fs from 'node:fs';

const RENDER_KEY = process.env.RENDER_API_KEY;
const REPO = 'https://github.com/jyothika012-cpu/student-wallet-ai';
const SERVICE_NAME = 'student-wallet-ai-api';

if (!RENDER_KEY) {
  console.error('Set RENDER_API_KEY in server/.env first.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${RENDER_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const E = process.env;

// Only these ever leave the build machine, and only into Render's env store.
const envVars = [
  { key: 'NODE_ENV', value: 'production' },
  { key: 'JWT_SECRET', value: E.JWT_SECRET, generateValue: false },
  { key: 'SUPABASE_URL', value: E.SUPABASE_URL, generateValue: false },
  { key: 'SUPABASE_ANON_KEY', value: E.SUPABASE_ANON_KEY, generateValue: false },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: E.SUPABASE_SERVICE_ROLE_KEY, generateValue: false },
  { key: 'GEMINI_API_KEY', value: E.GEMINI_API_KEY || '', generateValue: false },
  { key: 'GEMINI_MODEL', value: E.GEMINI_MODEL || 'gemini-2.0-flash', generateValue: false },
  { key: 'CLIENT_URL', value: E.CLIENT_URL || '', generateValue: false },
];

const r = async (url, method, body) => {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
};

const owners = await r('https://api.render.com/v1/owners', 'GET');
if (owners.status !== 200) {
  console.error('Could not read Render owners:', JSON.stringify(owners.json).slice(0, 300));
  process.exit(1);
}
const ownerId = owners.json[0].owner.id;
console.log(`Render workspace: ${owners.json[0].owner.name} (${ownerId})`);

const existing = await r(
  `https://api.render.com/v1/services?ownerId=${ownerId}&limit=50`,
  'GET',
);
const found = (existing.json || []).find((s) => s.service?.name === SERVICE_NAME);
let service;

if (found) {
  console.log(`Service ${SERVICE_NAME} already exists - updating env vars.`);
  service = found.service;
  const patch = await r(
    `https://api.render.com/v1/services/${service.id}/env-vars`,
    'PUT',
    envVars,
  );
  if (patch.status >= 400) {
    console.error('env var sync failed:', JSON.stringify(patch.json).slice(0, 300));
    process.exit(1);
  }
  console.log('  [ok] env vars synced');
  service = (await r(`https://api.render.com/v1/services/${service.id}`, 'GET')).json;
} else {
  const payload = {
    name: SERVICE_NAME,
    ownerId,
    repo: REPO,
    branch: 'master',
    serviceType: 'web_service',
    runtime: 'node',
    plan: 'free',
    region: 'oregon',
    rootDir: 'server',
    buildCommand: 'npm install',
    startCommand: 'npm start',
    healthCheckPath: '/api/health',
    autoDeploy: 'yes',
    envVars,
  };
  const created = await r('https://api.render.com/v1/services', 'POST', payload);
  if (created.status >= 400) {
    console.error('\n[FAIL] Could not create the Render service.\n');
    console.error(JSON.stringify(created.json, null, 2).slice(0, 1200));
    console.error('\nMost common cause: a free web service needs a payment method on file.');
    process.exit(1);
  }
  service = created.json;
  console.log(`  [ok] created service ${service.name}`);
}

const host = service.service?.details?.serviceDetails?.host || service.serviceDetails?.host;
const url = host ? `https://${host}` : null;
console.log(`\nBackend URL: ${url || '(not assigned yet - check the Render dashboard)'}`);
fs.writeFileSync('/tmp/render_url.txt', url || '');
if (url) console.log(`Saved to /tmp/render_url.txt`);
