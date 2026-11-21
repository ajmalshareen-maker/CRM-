import { chromium } from 'playwright';
const BASE = 'http://localhost:4000';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
// serve the app shell but make every API call fail like a dead backend
await p.route('**/api/**', r => r.abort('connectionrefused'));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const txt = await p.locator('body').innerText();
console.log('shows connection problem:', /Connection problem/i.test(txt) ? 'PASS' : 'FAIL');
console.log('shows retry button:', /Retry connection/i.test(txt) ? 'PASS' : 'FAIL');
console.log('message:', (txt.match(/Cannot reach the ReplyFlow server[^\n]*/) || ['(none)'])[0]);
await p.screenshot({ path: '/home/user/.arena/shots/fix-offline.png' });
await b.close();
