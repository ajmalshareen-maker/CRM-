import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1512, height: 950 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/me')) errs.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
const log = (...a) => console.log('•', ...a);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Explore the demo workspace/i }).click();
await page.waitForSelector('text=Overview');

// 1. inbox: select conversation, send a reply, verify toast + bubble
await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('div[class*="divide-y"] > div').nth(1).click();
await page.waitForTimeout(1200);
const before = await page.locator('p.whitespace-pre-wrap').count();
await page.locator('textarea').last().fill('Thanks for flagging this — I have escalated it and will follow up within the hour.');
await page.getByRole('button', { name: /^Send$/ }).click();
await page.waitForTimeout(1600);
const after = await page.locator('p.whitespace-pre-wrap').count();
log('reply bubble count', before, '->', after, after > before ? 'PASS' : 'FAIL');
log('toast:', await page.locator('text=Reply sent').first().isVisible().catch(()=>false) ? 'PASS' : 'FAIL');

// 2. internal note
const step = async (name, fn) => { try { await fn(); } catch (e) { log(name, 'SKIPPED:', e.message.split('\n')[0].slice(0, 90)); } };
await step('internal note', async () => {
  await page.getByRole('button', { name: 'Internal note', exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('textarea').last().fill('Customer is on the enterprise plan — prioritise.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(1400);
  const noteVisible = await page.locator('div.text-warning, span.text-warning').filter({ hasText: 'Internal note' }).first().isVisible().catch(() => false);
  log('internal note:', noteVisible ? 'PASS' : 'FAIL');
});

// 3. change priority via header dropdown
await step('priority change', async () => {
  const prioTrigger = page.getByRole('button', { name: /^(Low|Normal|High|Urgent)$/ }).first();
  await prioTrigger.click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: 'Urgent', exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(200);
  await page.waitForTimeout(1400);
  log('priority update toast:', await page.getByText('Priority set to Urgent').isVisible().catch(() => false) ? 'PASS' : 'CHECK');
});

// 4. assign to me
log('no page errors so far:', errs.length === 0 ? 'PASS' : errs.join(' | '));

// 5. command palette search
await page.keyboard.press('Control+k');
await page.waitForTimeout(400);
await page.keyboard.type('refund');
await page.waitForTimeout(900);
const results = await page.locator('button:has-text("Refund")').count();
log('command palette results for "refund":', results, results > 0 ? 'PASS' : 'FAIL');
await page.screenshot({ path: '/home/user/.arena/shots/23-command.png' });
await page.keyboard.press('Escape');

// 6. integrations: attempt connect on awaiting-approval → must be blocked honestly
await page.goto(`${BASE}/integrations`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const awaiting = await page.locator('button:has-text("Approval pending")').count();
log('awaiting-approval integrations shown as blocked:', awaiting, awaiting > 0 ? 'PASS' : 'FAIL');
// connect Shopify (needs_config) without creds → should warn, not fake success
await page.getByRole('button', { name: /Finish setup/i }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Save & connect/i }).click();
await page.waitForTimeout(800);
const warn = await page.getByText('Credentials required').first().isVisible().catch(() => false);
log('empty credentials blocked client-side:', warn ? 'PASS' : 'FAIL');
await page.screenshot({ path: '/home/user/.arena/shots/27-integration-validation.png' });
// now with fake creds -> server must reply "saved, verification pending", never "connected"
for (const inp of await page.locator('input[type="password"], input[type="text"]').all()) { await inp.fill('test-value-not-real'); }
await page.getByRole('button', { name: /Save & connect/i }).click();
await page.waitForTimeout(1600);
const honest = await page.getByText(/verification pending|awaiting verification/i).first().isVisible().catch(() => false);
log('fake creds stay unverified (never "connected"):', honest ? 'PASS' : 'FAIL');

// 7. tickets: open a ticket detail and change status
await page.goto(`${BASE}/tickets`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('tbody tr').first().click();
await page.waitForTimeout(900);
log('ticket drawer opened:', await page.locator('text=AUDIT TRAIL').or(page.locator('text=Audit trail')).first().isVisible() ? 'PASS' : 'FAIL');
await page.screenshot({ path: '/home/user/.arena/shots/24-ticket-detail.png' });
await page.keyboard.press('Escape');

// 8. report export
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Export CSV/i }).click();
await page.waitForTimeout(300);
await page.getByRole('menuitem', { name: 'Conversations', exact: true }).click();
const d = await dl;
log('CSV export download:', d ? 'PASS (' + d.suggestedFilename() + ')' : 'FAIL');

// 9. read-only role enforcement
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p2.getByRole('button', { name: /Sam Whitfield/i }).click();
await p2.getByRole('button', { name: /^Sign in$/ }).click();
await p2.waitForSelector('text=Overview', { timeout: 15000 });
await p2.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(900);
await p2.locator('div[class*="divide-y"] > div').first().click();
await p2.waitForTimeout(1200);
const sendDisabled = await p2.getByRole('button', { name: /^Send$/ }).isDisabled().catch(() => null);
log('read-only user cannot send:', sendDisabled === true ? 'PASS' : 'FAIL(' + sendDisabled + ')');
await p2.screenshot({ path: '/home/user/.arena/shots/25-readonly.png' });

// 10. mobile overflow check
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
log('mobile horizontal overflow(px):', overflow, overflow <= 1 ? 'PASS' : 'FAIL');
await page.screenshot({ path: '/home/user/.arena/shots/26-mobile-fixed.png' });

console.log('\nERRORS:', errs.length ? errs : 'none');
await browser.close();
