import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const OUT = '/home/user/.arena/shots';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Explore the demo workspace/i }).click();
await p.waitForSelector('text=Overview');
const pages = [['dashboard', '/'], ['inbox', `/inbox`], ['tickets', '/tickets'], ['integrations', '/integrations'], ['reports', '/reports'], ['automations', '/automations'], ['knowledge', '/knowledge'], ['team', '/team'], ['ai', '/ai'], ['companies', '/companies']];
for (const [name, path] of pages) {
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${OUT}/final-${name}.png` });
}
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /toggle theme/i }).click().catch(() => {});
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/final-dark.png` });
await p.getByRole('button', { name: /toggle theme/i }).click().catch(() => {});
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/final-mobile-inbox.png` });
await b.close();
console.log('shots done');
