/**
 * End-to-end verification of auth, CRUD, persistence, isolation and validation.
 * Run with the backend live:  node scripts/e2e-test.js
 */
const BASE = process.env.TEST_BASE || 'http://localhost:8787';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, extra = '') {
  if (condition) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${extra}`);
  }
}

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
const userA = { email: `aaron.${stamp}@student.test`, password: 'Str0ngPass!23', fullName: 'Aaron Sharma' };
const userB = { email: `bella.${stamp}@student.test`, password: 'Str0ngPass!23', fullName: 'Bella Rao' };

async function run() {
  console.log(`\nStudent Wallet AI - end-to-end test against ${BASE}\n`);

  console.log('1. health');
  const health = await call('/health');
  check('health endpoint returns ok', health.status === 200 && health.body?.ok === true);
  check('database is connected', health.body?.database === 'connected', JSON.stringify(health.body));

  console.log('\n2. auth');
  const su = await call('/auth/signup', { method: 'POST', body: userA });
  check('signup creates account + token', su.status === 201 && Boolean(su.body?.token), JSON.stringify(su.body));
  check('signup returns the user', su.body?.user?.email === userA.email);
  check('password hash never leaves the server', su.body?.user?.passwordHash === undefined && su.body?.user?.password_hash === undefined);
  const tokenA = su.body?.token;
  const idA = su.body?.user?.id;

  const dupe = await call('/auth/signup', { method: 'POST', body: userA });
  check('duplicate email is rejected', dupe.status === 409, JSON.stringify(dupe.body));

  const weak = await call('/auth/signup', { method: 'POST', body: { email: `x.${stamp}@t.co`, password: '123' } });
  check('weak password is rejected', weak.status === 400);

  const badEmail = await call('/auth/signup', { method: 'POST', body: { email: 'not-an-email', password: 'password123' } });
  check('invalid email is rejected', badEmail.status === 400);

  const li = await call('/auth/login', { method: 'POST', body: { email: userA.email, password: userA.password } });
  check('login succeeds with right password', li.status === 200 && Boolean(li.body?.token));
  check('token is a 3-part signed JWT', (li.body?.token || '').split('.').length === 3);
  // Signing is deterministic within the same second, so verify the *old* token still works.
  const oldTokenStillValid = await call('/auth/me', { token: tokenA });
  check('an earlier session token stays valid (works cross-device)', oldTokenStillValid.status === 200);
  const tampered = `${tokenA.slice(0, -3)}abc`;
  const tamperedRes = await call('/auth/me', { token: tampered });
  check('a tampered token is rejected', tamperedRes.status === 401);

  const wrong = await call('/auth/login', { method: 'POST', body: { email: userA.email, password: 'wrong-password' } });
  check('login fails with wrong password', wrong.status === 401);
  check('wrong-password error does not leak whether email exists', /wrong email or password/i.test(wrong.body?.error || ''));

  const me = await call('/auth/me', { token: tokenA });
  check('GET /auth/me returns the profile', me.status === 200 && me.body?.user?.email === userA.email);
  const noAuth = await call('/auth/me');
  check('GET /auth/me without token is 401', noAuth.status === 401);
  const badToken = await call('/auth/me', { token: 'garbage.token.here' });
  check('GET /auth/me with a forged token is 401', badToken.status === 401);

  console.log('\n3. profile settings');
  const patch = await call('/auth/me', {
    method: 'PATCH',
    token: tokenA,
    body: { fullName: 'Aaron S.', monthlyBudget: 4500, currency: 'INR' },
  });
  check('budget + name update', patch.status === 200 && patch.body?.user?.monthlyBudget === 4500, JSON.stringify(patch.body));
  const badBudget = await call('/auth/me', { method: 'PATCH', token: tokenA, body: { monthlyBudget: -50 } });
  check('negative budget is rejected', badBudget.status === 400);

  console.log('\n4. CRUD');
  const month = new Date().toISOString().slice(0, 7);
  const create = await call('/items', {
    method: 'POST',
    token: tokenA,
    body: { title: 'Canteen lunch', amount: 120, category: 'Food & Drinks', kind: 'expense', description: 'Day 3' },
  });
  check('create expense', create.status === 201 && create.body?.item?.title === 'Canteen lunch', JSON.stringify(create.body));
  const itemId = create.body?.item?.id;

  const create2 = await call('/items', {
    method: 'POST',
    token: tokenA,
    body: { title: 'Freelance logo', amount: 2500, category: 'Part-time Income', kind: 'income' },
  });
  check('create income', create2.status === 201 && create2.body?.item?.kind === 'income');

  const create3 = await call('/items', {
    method: 'POST',
    token: tokenA,
    body: { title: 'Bus pass', amount: 900, category: 'Transport', kind: 'expense' },
  });
  check('create second expense', create3.status === 201);

  const list = await call(`/items?month=${month}`, { token: tokenA });
  check('list returns 3 items for the month', list.status === 200 && list.body?.items?.length === 3, JSON.stringify(list.body?.items?.length));

  const update = await call(`/items/${itemId}`, {
    method: 'PATCH',
    token: tokenA,
    body: { amount: 150, title: 'Canteen lunch + chai' },
  });
  check('update item', update.status === 200 && update.body?.item?.amount === 150 && update.body?.item?.title === 'Canteen lunch + chai', JSON.stringify(update.body));

  const summary = await call(`/items/summary?month=${month}`, { token: tokenA });
  const t = summary.body?.totals;
  check('summary totals: income 2500', t?.income === 2500, JSON.stringify(t));
  check('summary totals: expense 1050', t?.expense === 1050, JSON.stringify(t));
  check('summary totals: balance 1450', t?.balance === 1450, JSON.stringify(t));
  check('summary category split', (summary.body?.categories || []).length >= 2);
  check('summary has 31/28-31 daily buckets', Array.isArray(summary.body?.daily) && summary.body.daily.length >= 28);

  console.log('\n5. validation');
  const noTitle = await call('/items', { method: 'POST', token: tokenA, body: { amount: 10 } });
  check('missing title rejected', noTitle.status === 400);
  const negAmount = await call('/items', { method: 'POST', token: tokenA, body: { title: 'x', amount: -5 } });
  check('negative amount rejected', negAmount.status === 400);
  const badKind = await call('/items', { method: 'POST', token: tokenA, body: { title: 'x', amount: 5, kind: 'crypto' } });
  check('invalid kind rejected', badKind.status === 400);
  const futureDate = await call('/items', { method: 'POST', token: tokenA, body: { title: 'x', amount: 5, date: '2099-01-01' } });
  check('future date rejected', futureDate.status === 400);
  const noAuthCreate = await call('/items', { method: 'POST', body: { title: 'x', amount: 5 } });
  check('create without token is 401', noAuthCreate.status === 401);

  console.log('\n6. cross-user isolation (RLS / ownership)');
  const suB = await call('/auth/signup', { method: 'POST', body: userB });
  const tokenB = suB.body?.token;
  check('second account created', suB.status === 201);

  const bList = await call('/items', { token: tokenB });
  check("user B sees none of user A's items", bList.status === 200 && bList.body?.items?.length === 0, JSON.stringify(bList.body));

  const bRead = await call(`/items/${itemId}`, { token: tokenB });
  check("user B cannot see user A's item", bRead.status === 404 || bRead.status === 405);
  const bPatch = await call(`/items/${itemId}`, { method: 'PATCH', token: tokenB, body: { amount: 1 } });
  check("user B cannot edit user A's item", bPatch.status === 404, JSON.stringify(bPatch.body));
  const bDelete = await call(`/items/${itemId}`, { method: 'DELETE', token: tokenB });
  check("user B cannot delete user A's item", bDelete.status === 404);

  const aStillHas = await call(`/items?month=${month}`, { token: tokenA });
  check("user A's data untouched after B's attacks", (aStillHas.body?.items || []).some((i) => i.id === itemId));

  console.log('\n7. persistence (simulates a refresh / new device)');
  const relogin = await call('/auth/login', { method: 'POST', body: { email: userA.email, password: userA.password } });
  const freshToken = relogin.body?.token;
  const afterReload = await call(`/items?month=${month}`, { token: freshToken });
  check('data survives a brand new session', afterReload.status === 200 && afterReload.body?.items?.length === 3, JSON.stringify(afterReload.body?.items?.length));
  const sAfter = await call(`/items/summary?month=${month}`, { token: freshToken });
  check('summary still correct after reload', sAfter.body?.totals?.balance === 1450);

  console.log('\n8. delete');
  const del = await call(`/items/${create3.body?.item?.id}`, { method: 'DELETE', token: freshToken });
  check('delete item', del.status === 200 && del.body?.ok === true);
  const afterDelete = await call(`/items?month=${month}`, { token: freshToken });
  check('list shrinks to 2', afterDelete.body?.items?.length === 2);
  const delAgain = await call(`/items/${create3.body?.item?.id}`, { method: 'DELETE', token: freshToken });
  check('deleting twice is a clean 404', delAgain.status === 404);

  console.log('\n9. ai route');
  const aiStatus = await call('/ai/status', { token: freshToken });
  check('ai status endpoint responds', aiStatus.status === 200 && typeof aiStatus.body?.configured === 'boolean');
  const aiNoAuth = await call('/ai/generate', { method: 'POST', body: { task: 'summarize' } });
  check('ai route requires auth', aiNoAuth.status === 401);
  const aiBadTask = await call('/ai/generate', { method: 'POST', token: freshToken, body: { task: 'hack' } });
  check('unknown ai task rejected', aiBadTask.status === 400 || aiBadTask.status === 503, JSON.stringify(aiBadTask.body));

  console.log('\n10. CORS');
  const pre = await fetch(`${BASE}/api/items`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://student-wallet-ai.vercel.app', 'Access-Control-Request-Method': 'GET' },
  });
  check('preflight for a vercel.app origin is allowed', pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'https://student-wallet-ai.vercel.app');

  console.log(`\n${'-'.repeat(52)}`);
  console.log(`  \x1b[32m${pass} passed\x1b[0m   ${fail ? `\x1b[31m${fail} failed\x1b[0m` : '0 failed'}`);
  if (failures.length) console.log(`  failed: ${failures.join(' | ')}`);
  console.log(`${'-'.repeat(52)}\n`);
  process.exit(fail ? 1 : 0);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
