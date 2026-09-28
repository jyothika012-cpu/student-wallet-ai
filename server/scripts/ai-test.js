/** Live AI verification: all 5 coach features + the per-transaction AI note. */
const BASE = process.env.TEST_BASE || 'http://localhost:8787';

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

const stamp = Date.now();
const email = `ai.test.${stamp}@student.wallet.test`;

let pass = 0;
let fail = 0;

function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${extra}`);
  }
}

async function run() {
  console.log(`\nAI verification against ${BASE}\n`);

  const health = await call('/health');
  console.log(`  provider: ${health.body?.ai}\n`);
  check('ai reports as connected', String(health.body?.ai || '').includes('gemini'));

  const su = await call('/auth/signup', {
    method: 'POST',
    body: { email, password: 'Str0ngPass!23', fullName: 'AI Test Student' },
  });
  check('test account created', su.status === 201, JSON.stringify(su.body).slice(0, 200));
  const token = su.body?.token;

  await call('/auth/me', { method: 'PATCH', token, body: { monthlyBudget: 6000 } });

  const seed = [
    { title: 'Canteen lunch', amount: 180, category: 'Food & Drinks', kind: 'expense', description: 'veg thali' },
    { title: 'Canteen lunch', amount: 210, category: 'Food & Drinks', kind: 'expense' },
    { title: 'Coffee', amount: 90, category: 'Food & Drinks', kind: 'expense' },
    { title: 'Bus pass', amount: 1200, category: 'Transport', kind: 'expense' },
    { title: 'Textbook - Algorithms', amount: 2400, category: 'Books & Study', kind: 'expense' },
    { title: 'Hostel mess top-up', amount: 3200, category: 'Hostel & Rent', kind: 'expense' },
    { title: 'Freelance tutoring', amount: 4000, category: 'Part-time Income', kind: 'income' },
  ];
  for (const s of seed) await call('/items', { method: 'POST', token, body: s });
  const list = await call('/items', { token });
  check('seeded 7 transactions', (list.body?.items || []).length === 7);

  console.log('\ncoach tasks');
  for (const task of ['summarize', 'tips', 'plan', 'explain']) {
    const r = await call('/ai/generate', { method: 'POST', token, body: { task } });
    const reply = r.body?.reply || '';
    const ok = r.status === 200 && reply.length > 30;
    check(`task "${task}" returns real advice`, ok, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 160)}`);
    if (ok) console.log(`      \x1b[2m${reply.replace(/\n/g, ' ').slice(0, 190)}…\x1b[0m`);
  }

  console.log('\nfree chat');
  const chat = await call('/ai/generate', {
    method: 'POST',
    token,
    body: { task: 'chat', prompt: 'I want to save 1500 this month. What should I cut first?' },
  });
  check('chat answers the question', chat.status === 200 && (chat.body?.reply || '').length > 30, JSON.stringify(chat.body).slice(0, 160));
  console.log(`      \x1b[2m${(chat.body?.reply || '').replace(/\n/g, ' ').slice(0, 190)}…\x1b[0m`);

  const emptyChat = await call('/ai/generate', { method: 'POST', token, body: { task: 'chat', prompt: '   ' } });
  check('empty chat prompt is rejected', emptyChat.status === 400);

  console.log('\nper-transaction ai note');
  const note = await call('/items', {
    method: 'POST',
    token,
    body: { title: 'Cafe study session', amount: 450, category: 'Food & Drinks', kind: 'expense', description: 'coffee and sandwich before the exam', withAi: true },
  });
  const noteText = note.body?.item?.aiSummary || '';
  check('transaction stores an AI note', note.status === 201 && noteText.length > 5, JSON.stringify(note.body).slice(0, 200));
  if (noteText) console.log(`      \x1b[2m"${noteText}"\x1b[0m`);

  console.log('\nsecurity');
  const noAuth = await call('/ai/generate', { method: 'POST', body: { task: 'summarize' } });
  check('ai route still requires auth', noAuth.status === 401);
  const badTask = await call('/ai/generate', { method: 'POST', token, body: { task: 'drop-tables' } });
  check('unknown task rejected', badTask.status === 400);

  console.log(`\n${'-'.repeat(52)}`);
  console.log(`  \x1b[32m${pass} passed\x1b[0m   ${fail ? `\x1b[31m${fail} failed\x1b[0m` : '0 failed'}`);
  console.log(`${'-'.repeat(52)}\n`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error('crashed:', e);
  process.exit(1);
});
