import { chromium } from 'playwright';
const BASE = process.env.RF_URL || 'http://localhost:4000';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/me')) errs.push(`${r.status()} ${r.url()}`); });
const log = (...a) => console.log('•', ...a);
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Explore the demo workspace/i }).click();
await p.waitForSelector('text=Overview');

// AI workspace: generate reply, summarise, detect intent
await p.goto(BASE + '/ai', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Generate reply/i }).click();
await p.waitForTimeout(1500);
let out = await p.locator('textarea').first().inputValue().catch(() => '');
log('AI generate reply chars:', out.length, out.length > 60 ? 'PASS' : 'FAIL');
await p.getByRole('button', { name: /Summarise/i }).click();
await p.waitForTimeout(1200);
out = await p.locator('textarea').first().inputValue().catch(() => '');
log('AI summary chars:', out.length, out.length > 30 ? 'PASS' : 'FAIL');
await p.getByRole('button', { name: /Detect intent/i }).click();
await p.waitForTimeout(1200);
log('intent panel:', await p.getByText(/Delivery Status|Refund|Return|Pre-sales|Technical|General enquiry/i).first().isVisible() ? 'PASS' : 'FAIL');
await p.screenshot({ path: '/home/user/.arena/shots/final-ai-output.png' });

// translations
await p.locator('select').last().selectOption?.('ur').catch(() => {});
await p.getByRole('button', { name: /Translate/i }).click();
await p.waitForTimeout(1500);
out = await p.locator('textarea').first().inputValue().catch(() => '');
log('translation output (urdu script present):', /[\u0600-\u06FF]/.test(out) ? 'PASS' : 'CHECK(len ' + out.length + ')');

// automations: test run
await p.goto(BASE + '/automations', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.getByRole('button', { name: 'Test' }).first().click();
await p.waitForTimeout(1500);
const testTxt = await p.locator('body').innerText();
log('automation test run feedback:', /test run|matched|would run|conditions/i.test(testTxt) ? 'PASS' : 'CHECK');
await p.screenshot({ path: '/home/user/.arena/shots/final-automation-test.png' });
await p.keyboard.press('Escape');

// knowledge: open an article
await p.goto(BASE + '/knowledge', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.getByText('How to get a prepaid return label').first().click();
await p.waitForTimeout(900);
const artTxt = await p.locator('body').innerText();
log('article opens with markdown body:', artTxt.includes('Return or replace') ? 'PASS' : 'FAIL');
await p.keyboard.press('Escape');

// widget install tab shows the snippet
await p.goto(BASE + '/widget', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Install' }).click();
await p.waitForTimeout(600);
const snip = await p.locator('pre').first().textContent().catch(() => '');
log('install snippet:', /widget\.js/.test(snip || '') ? 'PASS (' + snip.trim().slice(0, 70) + '…)' : 'FAIL');

// public help centre search
await p.goto(BASE + '/help', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const searchBox = p.locator('input').first();
await searchBox.fill('label');
await p.waitForTimeout(700);
log('public help search hits:', (await p.locator('body').innerText()).includes('return label') ? 'PASS' : 'CHECK');

console.log('\nERRORS:', errs.length ? errs : 'none');
await b.close();
