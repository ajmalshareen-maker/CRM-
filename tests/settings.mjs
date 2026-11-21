import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/me')) errs.push(`${r.status()} ${r.url()}`); });
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Explore the demo workspace/i }).click();
await p.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const panel = p.locator('aside').last();
const count = await panel.locator('button').count();
console.log('settings sections:', count);
for (let i = 0; i < count; i++) {
  const btn = panel.locator('button').nth(i);
  const name = (await btn.textContent()).trim();
  await btn.click();
  await p.waitForTimeout(350);
  const text = await p.locator('body').innerText();
  console.log(`${name.padEnd(18)} chars:${text.length}`);
  await p.screenshot({ path: `/home/user/.arena/shots/settings-${String(i).padStart(2,'0')}-${name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png` });
}
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
