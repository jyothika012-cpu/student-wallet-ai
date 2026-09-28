/**
 * Creates the Vercel project for the backend API, sets every secret as a Vercel
 * env var, and triggers a production deployment.
 *
 * Run: node scripts/deploy-vercel-api.js
 */
import 'dotenv/config';

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID || 'team_xJQbg0skXmTHxaS55QQjmBUB';
const REPO = 'jyothika012-cpu/student-wallet-ai';
const PROJECT = process.env.VERCEL_API_PROJECT || 'student-wallet-ai-api';

if (!TOKEN) {
  console.error('Set VERCEL_TOKEN in server/.env first.');
  process.exit(1);
}

const E = process.env;

async function v(path, method = 'GET', body, allowFail = false) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    if (allowFail) return null;
    console.error(`\n[${res.status}] ${method} ${path}`);
    console.error(JSON.stringify(json, null, 2).slice(0, 900));
    process.exit(1);
  }
  return json;
}

const env = [
  { key: 'NODE_ENV', value: 'production', type: 'plain' },
  { key: 'JWT_SECRET', value: E.JWT_SECRET, type: 'encrypted' },
  { key: 'SUPABASE_URL', value: E.SUPABASE_URL, type: 'encrypted' },
  { key: 'SUPABASE_ANON_KEY', value: E.SUPABASE_ANON_KEY, type: 'encrypted' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: E.SUPABASE_SERVICE_ROLE_KEY, type: 'encrypted' },
  { key: 'GEMINI_API_KEY', value: E.GEMINI_API_KEY || '', type: 'encrypted' },
  { key: 'GEMINI_MODEL', value: E.GEMINI_MODEL || 'gemini-2.0-flash', type: 'plain' },
  { key: 'CLIENT_URL', value: E.CLIENT_URL || '', type: 'plain' },
];

console.log('1. project');
const existing = await v(`/v9/projects/${PROJECT}?teamId=${TEAM}`, 'GET', undefined, true);
let projectId;
if (existing?.id) {
  projectId = existing.id;
  console.log(`   project ${PROJECT} already exists (${projectId})`);
} else {
  try {
    const p = await v('/v10/projects?teamId=' + TEAM, 'POST', {
      name: PROJECT,
      rootDirectory: 'server',
      gitRepository: { type: 'github', repo: REPO },
      installCommand: 'npm install',
    });
    projectId = p.id;
    console.log(`   created project ${p.name} (${projectId})`);
  } catch {
    process.exit(1);
  }
}

console.log('2. env vars');
for (const e of env) {
  const safePreview = e.key === 'GEMINI_API_KEY' && !e.value;
  await v(`/v10/projects/${projectId}/env?teamId=${TEAM}&upsert=true`, 'POST', {
    ...e,
    target: safePreview ? ['preview'] : ['production', 'preview', 'development'],
  });
  console.log(`   ${safePreview ? '~' : '✓'} ${e.key}${safePreview ? ' (empty - not set yet)' : ''}`);
}

console.log('3. production deployment');
const dep = await v(`/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1`, 'POST', {
  name: PROJECT,
  project: projectId,
  target: 'production',
  gitSource: { type: 'github', repo: REPO, ref: 'master' },
});
console.log(`   deployment queued: ${dep.url || dep.uid}`);

let state = dep.readyState;
const url = dep.url;
for (let i = 0; i < 60; i += 1) {
  await new Promise((r) => setTimeout(r, 5000));
  const cur = await v(`/v13/deployments/${dep.uid}?teamId=${TEAM}`);
  if (cur.readyState !== state) {
    state = cur.readyState;
    console.log(`   ... ${state}`);
  }
  if (state === 'READY' || state === 'ERROR' || state === 'CANCELED') break;
}

console.log(`\nstate: ${state}`);
if (state === 'ERROR') {
  const logs = await v(`/v2/deployments/${dep.uid}/events?teamId=${TEAM}&size=40`);
  for (const ev of (logs || []).slice(-12)) {
    console.log(`  [${ev.type}] ${String(ev.text || ev.payload?.text || '').slice(0, 300)}`);
  }
  process.exit(1);
}

const final = url?.startsWith('http') ? url : `https://${url}`;
console.log(`\nBackend live at: ${final}`);
console.log(`Health check   : ${final}/api/health`);
