import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const b = await chromium.launch();
const log = (...a) => console.log('•', ...a);

// ---------- A: normal top-level load, real cookie kept ----------
const ctxA = await b.newContext({ viewport: { width: 1280, height: 900 } });
const pA = await ctxA.newPage();
const errsA = [];
pA.on('pageerror', e => errsA.push('PAGEERROR ' + e.message));
pA.on('response', r => { if (r.status() >= 400) errsA.push(`${r.status()} ${r.url()}`); });
await pA.goto(BASE + '/', { waitUntil: 'networkidle' });
log('A: login screen rendered:', await pA.getByRole('button', { name: /Explore the demo workspace/i }).isVisible() ? 'PASS' : 'FAIL');
await pA.getByRole('button', { name: /Explore the demo workspace/i }).click();
await pA.waitForSelector('text=Overview', { timeout: 20000 });
log('A: demo login reaches dashboard:', 'PASS');
await pA.screenshot({ path: '/home/user/.arena/shots/fix-A-dashboard.png' });
// reload: session must persist
await pA.reload({ waitUntil: 'networkidle' });
await pA.waitForTimeout(1500);
log('A: session survives reload:', await pA.locator('text=Overview').first().isVisible() ? 'PASS' : 'FAIL');
log('A: cookies in jar:', (await ctxA.cookies()).filter(c => c.name === 'rf_session').length);
log('A: errors:', errsA.length ? errsA : 'none');

// ---------- B: password sign-in ----------
const ctxB = await b.newContext({ viewport: { width: 1280, height: 900 } });
const pB = await ctxB.newPage();
await pB.goto(BASE + '/', { waitUntil: 'networkidle' });
await pB.getByRole('button', { name: 'Sign in', exact: true }).click();
await pB.waitForSelector('text=Overview', { timeout: 20000 });
log('B: password sign-in (amina/replyflow):', 'PASS');

// wrong password must show a real message, not silently bounce
const ctxC = await b.newContext();
const pC = await ctxC.newPage();
await pC.goto(BASE + '/', { waitUntil: 'networkidle' });
await pC.locator('input[type=password]').fill('wrongpass');
await pC.getByRole('button', { name: 'Sign in', exact: true }).click();
await pC.waitForTimeout(1200);
log('C: wrong password shows error:', await pC.getByText(/Incorrect email or password/i).isVisible() ? 'PASS' : 'FAIL');

// ---------- D: SANDBOXED IFRAME, cookies blocked (the real preview condition) ----------
const ctxD = await b.newContext({ viewport: { width: 1280, height: 900 } });
const pD = await ctxD.newPage();
// Block Set-Cookie storage entirely to emulate an opaque-origin sandbox
await ctxD.route('**/api/**', async (route) => {
  const res = await route.fetch();
  const headers = { ...res.headers() };
  delete headers['set-cookie'];
  await route.fulfill({ response: res, headers });
});
await pD.goto(BASE + '/', { waitUntil: 'networkidle' });
await pD.getByRole('button', { name: /Explore the demo workspace/i }).click();
await pD.waitForSelector('text=Overview', { timeout: 20000 });
log('D (cookies blocked): login still reaches dashboard:', 'PASS');
log('D: token persisted in storage:', await pD.evaluate(() => !!localStorage.getItem('rf_token')) ? 'PASS' : 'FAIL');
await pD.reload({ waitUntil: 'networkidle' });
await pD.waitForTimeout(1500);
log('D (cookies blocked): session survives reload:', await pD.locator('text=Overview').first().isVisible() ? 'PASS' : 'FAIL');
// and real data loads, not just the shell
await pD.goto(BASE + '/inbox', { waitUntil: 'networkidle' });
await pD.waitForTimeout(1800);
const rows = await pD.locator('div[class*="divide-y"] > div').count();
log('D (cookies blocked): inbox data loads:', rows > 0 ? `PASS (${rows} rows)` : 'FAIL');
await pD.screenshot({ path: '/home/user/.arena/shots/fix-D-sandboxed.png' });

await b.close();
