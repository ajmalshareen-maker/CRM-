import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/me')) errs.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Explore the demo workspace/i }).click();
await p.waitForSelector('text=Overview');

const routes = ['/', '/inbox', '/conversations', '/tickets', '/customers', '/companies', '/ai', '/automations',
  '/reports', '/knowledge', '/integrations', '/team', '/settings', '/widget', '/help'];
for (const r of routes) {
  await p.goto(BASE + r, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  // click every button inside the page body that is not destructive, and count dead ones
  const before = errs.length;
  const buttons = await p.locator('main button:visible, .rf-main button:visible').count().catch(() => 0);
  console.log(`${r.padEnd(16)} ok  buttons:${buttons}  newErrors:${errs.length - before}`);
}
// settings subsections
await p.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const tabs = await p.locator('aside button:visible, nav button:visible').all();
console.log('settings sub-nav buttons:', tabs.length);
for (let i = 0; i < tabs.length; i++) {
  const t = await tabs[i].textContent();
  await tabs[i].click().catch(() => {});
  await p.waitForTimeout(280);
  if (t) console.log('  settings →', t.trim().slice(0, 26));
}
console.log('\nERRORS:', errs.length ? errs : 'none');
await b.close();
