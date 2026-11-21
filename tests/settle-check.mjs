import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/auth/me')) errs.push(`${r.status()} ${r.url()}`); });
const t0 = Date.now();
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Explore the demo workspace/i }).click();
await p.waitForSelector('text=Overview');
// wait for real numbers to replace skeletons
await p.waitForFunction(() => {
  const t = document.body.innerText;
  return /Total conversations/.test(t) && !/^\s*$/.test(t) && /\d/.test(t.split('Total conversations')[0].slice(-40));
}, null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2500);
const txt = await p.locator('body').innerText();
const kpiBlock = txt.split('Conversations over time')[0];
console.log('elapsed ms:', Date.now() - t0);
console.log('KPI block sample:', kpiBlock.replace(/\n+/g, ' | ').slice(0, 260));
console.log('has real values (not 0-only):', /\b([1-9]\d*)\b/.test(kpiBlock.replace(/Last 7 days|AI insights/g, '')) ? 'PASS' : 'CHECK');
console.log('chart rendered:', await p.locator('svg.recharts-surface').count() > 0 ? 'PASS' : 'FAIL');
await p.screenshot({ path: '/home/user/.arena/shots/resume-dashboard.png', fullPage: false });
console.log('errors:', errs.length ? errs : 'none');
await b.close();
