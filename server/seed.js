import bcrypt from 'bcryptjs';
import { db, migrate, uid, nowIso } from './db/index.js';

migrate();

const force = process.argv.includes('--force');
const existing = db.prepare('SELECT COUNT(*) c FROM organizations').get().c;
if (existing > 0 && !force) {
  console.log('[seed] database already seeded — use `npm run seed` to reset');
  process.exit(0);
}
if (force) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  db.pragma('foreign_keys = OFF');
  for (const t of tables) db.prepare(`DELETE FROM ${t.name}`).run();
  db.pragma('foreign_keys = ON');
}

const iso = (d) => new Date(d).toISOString();
const ago = (mins) => iso(Date.now() - mins * 60000);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const ORG = 'org_replyflow';

db.prepare(`INSERT INTO organizations (id,name,slug,plan,brand_color,logo_initials,timezone,seats_limit,created_at)
  VALUES (?,?,?,?,?,?,?,?,?)`).run(ORG, 'Northwind Support Co.', 'northwind', 'growth', '#21B8A6', 'NS', 'Asia/Karachi', 25, ago(60 * 24 * 420));

/* ---------------- Users ---------------- */
const password = bcrypt.hashSync('replyflow', 10);
const users = [
  ['usr_amina', 'Amina Rauf', 'amina@northwind.io', 'admin', 'Head of Support', '#21B8A6', 'online'],
  ['usr_daniel', 'Daniel Okafor', 'daniel@northwind.io', 'agent', 'Senior Support Agent', '#4C7DF0', 'online'],
  ['usr_priya', 'Priya Nair', 'priya@northwind.io', 'agent', 'Support Agent', '#B07CE8', 'away'],
  ['usr_marco', 'Marco Alves', 'marco@northwind.io', 'team_manager', 'Marketplace Team Lead', '#F0A43C', 'online'],
  ['usr_lena', 'Lena Fischer', 'lena@northwind.io', 'agent', 'Chat Specialist', '#16A673', 'offline'],
  ['usr_sam', 'Sam Whitfield', 'sam@northwind.io', 'readonly', 'Ops Analyst', '#718096', 'offline'],
  ['usr_hana', 'Hana Yilmaz', 'hana@northwind.io', 'agent', 'Support Agent', '#E45B65', 'online'],
];
for (const [id, name, email, role, title, color, status] of users) {
  db.prepare(`INSERT INTO users (id,org_id,name,email,password_hash,role,title,avatar_color,status,availability,last_active_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, ORG, name, email, password, role, title, color, status, status === 'online' ? 'available' : 'away', ago(rnd(1, 200)), ago(60 * 24 * 300));
}

/* ---------------- Teams ---------------- */
const teams = [
  ['team_email', 'Email Support', 'Owns inbound email across all shared inboxes', '#4C7DF0', 'usr_amina'],
  ['team_market', 'Marketplace Desk', 'Amazon, eBay, Etsy and Walmart buyer messages', '#F0A43C', 'usr_marco'],
  ['team_chat', 'Live Chat Crew', 'Realtime website chat and pre-sales questions', '#21B8A6', 'usr_lena'],
  ['team_billing', 'Billing & Returns', 'Refunds, invoices and chargeback workflows', '#E45B65', 'usr_daniel'],
];
for (const t of teams) {
  db.prepare(`INSERT INTO teams (id,org_id,name,description,color,lead_user_id,business_hours,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(t[0], ORG, t[1], t[2], t[3], t[4], 'Mon–Fri, 09:00–18:00 (PKT)', ago(60 * 24 * 400));
}
const memberships = [
  ['team_email', 'usr_amina'], ['team_email', 'usr_daniel'], ['team_email', 'usr_priya'], ['team_email', 'usr_hana'],
  ['team_market', 'usr_marco'], ['team_market', 'usr_hana'],
  ['team_chat', 'usr_lena'], ['team_chat', 'usr_priya'], ['team_chat', 'usr_daniel'],
  ['team_billing', 'usr_daniel'], ['team_billing', 'usr_amina'],
];
for (const [t, u] of memberships) db.prepare('INSERT OR IGNORE INTO team_members (team_id,user_id) VALUES (?,?)').run(t, u);

/* ---------------- Companies ---------------- */
const companies = [
  ['cmp_lumen', 'Lumen Retail Group', 'lumenretail.com', 'Retail', 'Enterprise', 4200, '#4C7DF0'],
  ['cmp_kite', 'Kite & Co.', 'kiteandco.com', 'Consumer Goods', 'Growth', 1450, '#21B8A6'],
  ['cmp_vertex', 'Vertex Labs', 'vertexlabs.dev', 'SaaS', 'Scale', 6100, '#B07CE8'],
  ['cmp_harbor', 'Harbor Supply', 'harborsupply.co', 'Wholesale', 'Growth', 2300, '#F0A43C'],
  ['cmp_nova', 'Nova Home', 'novahome.com', 'Home & Living', 'Starter', 640, '#16A673'],
  ['cmp_brew', 'Brewline Coffee', 'brewline.coffee', 'Food & Beverage', 'Growth', 970, '#E45B65'],
];
for (const c of companies) {
  db.prepare(`INSERT INTO companies (id,org_id,name,domain,industry,plan,mrr,logo_color,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(c[0], ORG, c[1], c[2], c[3], c[4], c[5], c[6], `${c[1]} is a ${c[4].toLowerCase()} account on the ${c[4]} plan.`, ago(60 * 24 * 300));
}

/* ---------------- Channels ---------------- */
const channels = [
  ['chn_email_support', 'email', 'support@northwind.io', 'support@northwind.io', 'connected', 'oauth', 4],
  ['chn_email_billing', 'email', 'billing@northwind.io', 'billing@northwind.io', 'connected', 'oauth', 12],
  ['chn_chat', 'chat', 'Website Live Chat', 'northwind.io', 'connected', 'widget', 1],
  ['chn_whatsapp', 'whatsapp', 'WhatsApp Business', '+92 300 111 2233', 'demo', 'api_key', 26],
  ['chn_instagram', 'instagram', '@northwind', '@northwind', 'demo', 'oauth', 41],
  ['chn_messenger', 'messenger', 'Northwind on Messenger', 'northwind', 'demo', 'oauth', 55],
  ['chn_telegram', 'telegram', 'Northwind Support Bot', '@northwind_support', 'demo', 'bot_token', 70],
  ['chn_amazon', 'amazon', 'Amazon Seller Central', 'Northwind Store', 'demo', 'oauth', 33],
  ['chn_ebay', 'ebay', 'eBay Messages', 'northwind_store', 'demo', 'oauth', 88],
  ['chn_etsy', 'etsy', 'Etsy Shop', 'NorthwindHome', 'demo', 'oauth', 120],
  ['chn_shopify', 'shopify', 'Shopify — northwind.myshopify.com', 'northwind.myshopify.com', 'needs_config', 'api_key', null],
  ['chn_woocommerce', 'woocommerce', 'WooCommerce Store', 'shop.northwind.io', 'needs_config', 'api_key', null],
  ['chn_walmart', 'walmart', 'Walmart Marketplace', 'Northwind', 'awaiting_approval', 'api_key', null],
  ['chn_tiktok', 'tiktok', 'TikTok Shop', '@northwind', 'awaiting_approval', 'oauth', null],
  ['chn_aliexpress', 'aliexpress', 'AliExpress Store', 'Northwind Global', 'awaiting_approval', 'oauth', null],
];
for (const [id, type, name, handle, status, auth, syncMins] of channels) {
  db.prepare(`INSERT INTO channels (id,org_id,type,name,handle,status,auth_type,last_sync_at,health,config_json,error_log_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ORG, type, name, handle, status, auth, syncMins == null ? null : ago(syncMins), status === 'connected' ? 'ok' : 'unknown',
      JSON.stringify(status === 'connected' ? { mailbox: handle, signature: '— Northwind Support' } : {}),
      JSON.stringify(status === 'connected' ? [] : [{ at: ago(600), level: 'info', message: 'Demo channel — sample data only, no live API credentials stored.' }]),
      ago(60 * 24 * 180));
}

/* ---------------- Integrations catalog ---------------- */
const integrations = [
  ['gmail', 'Gmail', 'Email', 'connected', 'oauth', 'Two-way email sync, threading, labels and signatures via Google Workspace OAuth.'],
  ['outlook', 'Microsoft Outlook', 'Email', 'connected', 'oauth', 'Microsoft 365 shared mailboxes with Graph API mail sync.'],
  ['imap', 'Custom IMAP / SMTP', 'Email', 'needs_config', 'credentials', 'Bring your own mail server. Requires host, port, TLS and app password.'],
  ['whatsapp', 'WhatsApp Business Cloud', 'Messaging', 'demo', 'api_key', 'Meta Cloud API phone number ID plus webhook verification token.'],
  ['instagram', 'Instagram Messaging', 'Messaging', 'demo', 'oauth', 'Instagram professional accounts via Meta Graph API messaging permissions.'],
  ['messenger', 'Facebook Messenger', 'Messaging', 'demo', 'oauth', 'Page messaging with webhook signature validation.'],
  ['telegram', 'Telegram', 'Messaging', 'demo', 'bot_token', 'Bot API long polling or webhook ingestion.'],
  ['slack', 'Slack', 'Messaging', 'demo', 'oauth', 'Mirror urgent conversations into a Slack channel via bot token.'],
  ['amazon', 'Amazon Seller Central', 'Marketplace', 'demo', 'oauth', 'SP-API messaging for buyer–seller messages (requires approved app).'],
  ['ebay', 'eBay', 'Marketplace', 'demo', 'oauth', 'eBay Trading API member messages.'],
  ['etsy', 'Etsy', 'Marketplace', 'demo', 'oauth', 'Etsy Open API v3 conversations endpoint.'],
  ['walmart', 'Walmart Marketplace', 'Marketplace', 'awaiting_approval', 'api_key', 'Requires approved Walmart developer credentials.'],
  ['shopify', 'Shopify', 'eCommerce', 'needs_config', 'api_key', 'Order history sync plus customer context enrichment.'],
  ['woocommerce', 'WooCommerce', 'eCommerce', 'needs_config', 'api_key', 'REST API key + secret for orders and customers.'],
  ['tiktok', 'TikTok Shop', 'Marketplace', 'awaiting_approval', 'oauth', 'Partner Center approval required before message ingestion.'],
  ['aliexpress', 'AliExpress', 'Marketplace', 'awaiting_approval', 'oauth', 'Available where approved API access is granted.'],
  ['stripe', 'Stripe', 'Payments', 'available', 'api_key', 'Surface subscription and invoice context inside billing conversations.'],
  ['zapier', 'Zapier', 'Automation', 'available', 'oauth', 'Trigger Zapier workflows from ReplyFlow events.'],
  ['hubspot', 'HubSpot', 'CRM', 'available', 'oauth', 'Sync contacts and deals bidirectionally.'],
  ['jira', 'Jira', 'Engineering', 'available', 'oauth', 'Escalate bugs into engineering with linked tickets.'],
  ['linear', 'Linear', 'Engineering', 'available', 'oauth', 'Create issues from conversation context.'],
  ['segment', 'Segment', 'Analytics', 'available', 'api_key', 'Stream support events to your warehouse.'],
];
for (const [key, name, category, status, auth, description] of integrations) {
  db.prepare(`INSERT INTO integrations (id,org_id,key,name,category,status,auth_type,description,docs_url,config_json,last_sync_at,error_log_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid('int'), ORG, key, name, category, status, auth, description, `https://docs.replyflow.app/integrations/${key}`,
      JSON.stringify(status === 'connected' ? { connected_at: ago(60 * 24 * 90) } : {}),
      ['connected', 'demo'].includes(status) ? ago(rnd(2, 40)) : null,
      JSON.stringify(status === 'needs_config' ? [{ at: ago(120), level: 'warn', message: 'Credentials missing. Add API key to finish setup.' }]
        : status === 'awaiting_approval' ? [{ at: ago(1440), level: 'info', message: 'Platform partner approval pending. No data is being ingested.' }]
        : []));
}

/* ---------------- Customers ---------------- */
const firstNames = ['Sofia', 'James', 'Aisha', 'Lucas', 'Mei', 'Noah', 'Fatima', 'Ethan', 'Camila', 'Omar', 'Elena', 'Ravi', 'Grace', 'Tariq', 'Nina', 'Hugo', 'Zara', 'Ben', 'Ingrid', 'Kofi', 'Marta', 'Yusuf', 'Chloe', 'Diego'];
const lastNames = ['Alvarez', 'Carter', 'Khan', 'Moreau', 'Chen', 'Bennett', 'Ali', 'Walker', 'Reyes', 'Haddad', 'Petrova', 'Sharma', 'Osei', 'Rahman', 'Novak', 'Silva', 'Ahmed', 'Foster', 'Larsen', 'Mensah', 'Kowalski', 'Demir', 'Dubois', 'Fernandez'];
const cities = ['Austin, US', 'London, UK', 'Karachi, PK', 'Paris, FR', 'Singapore, SG', 'Toronto, CA', 'Dubai, AE', 'Berlin, DE', 'Sydney, AU', 'Madrid, ES', 'Lagos, NG', 'Mumbai, IN', 'Chicago, US', 'Amsterdam, NL'];
const colors = ['#21B8A6', '#4C7DF0', '#B07CE8', '#F0A43C', '#16A673', '#E45B65', '#142D46'];
const tagPool = ['VIP', 'Repeat buyer', 'Wholesale', 'At risk', 'Beta user', 'Enterprise', 'Newsletter', 'Refund pending'];

const customers = [];
for (let i = 0; i < 24; i++) {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 7) % lastNames.length];
  const name = `${fn} ${ln}`;
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@${pick(['gmail.com', 'outlook.com', 'proton.me', 'company.co', 'mail.io'])}`;
  const id = `cus_${i + 1}`;
  const cmp = pick(companies)[0];
  const tags = [pick(tagPool)];
  if (i % 5 === 0) tags.push(pick(tagPool));
  db.prepare(`INSERT INTO customers (id,org_id,name,email,phone,company_id,external_id,avatar_color,location,ltv,tags,notes,lifetime_conversations,last_seen_at,created_at,is_demo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(id, ORG, name, email, `+1 555 0${rnd(100, 999)} ${rnd(1000, 9999)}`, cmp, `ext_${rnd(100000, 999999)}`, colors[i % colors.length], pick(cities),
      rnd(120, 18400), JSON.stringify([...new Set(tags)]), i % 4 === 0 ? 'Prefers replies before 14:00 UTC.' : null,
      rnd(1, 22), ago(rnd(5, 9000)), ago(60 * 24 * rnd(20, 400)));
  customers.push({ id, name, email, company_id: cmp });
}

/* ---------------- Conversations + messages ---------------- */
const threads = [
  {
    subject: 'Order #48213 arrived damaged',
    channel: 'chn_email_support', channelType: 'email', priority: 'high', tags: ['Refund pending', 'At risk'],
    scenario: 'damage',
    lines: [
      ['inbound', "Hi Northwind team,\n\nMy order #48213 arrived this morning and the outer box was crushed. Two of the four ceramic mugs inside are broken and the packaging insert is soaked.\n\nCould you arrange a replacement or refund? I need them for a gift this Saturday.\n\nThanks,\nSofia"],
      ['outbound', "Hi Sofia,\n\nI'm really sorry about that — a crushed parcel is the last thing you want before a gift deadline.\n\nI've filed a damage claim with the carrier and I'm sending a replacement set today on express delivery, so it should land by Friday. You'll keep the unbroken mugs as well; no need to return anything.\n\nI'll follow up with tracking within the hour.\n\nWarmly,\nDaniel"],
      ['inbound', "That's incredibly quick, thank you! Friday works perfectly. Appreciate you not asking me to ship the broken ones back."],
      ['outbound', "Of course — tracking is now live: NW-9931-4402. Enjoy the celebration on Saturday!\n\n— Daniel"],
    ],
  },
  {
    subject: 'Pre-sales: does the studio plan include SSO?',
    channel: 'chn_chat', channelType: 'chat', priority: 'normal', tags: ['Enterprise'],
    scenario: 'presales',
    lines: [
      ['inbound', "Hey! Evaluating you for a 40-person team. Does the Studio plan include SAML SSO and SCIM provisioning?"],
      ['outbound', "Great question — SAML SSO is included on Studio and above, and SCIM is available as an add-on. Happy to walk you through an admin-level demo this week if useful?"],
      ['inbound', "A demo would be perfect. Thursday afternoon?"],
    ],
  },
  {
    subject: 'Amazon buyer message — wrong size shipped',
    channel: 'chn_amazon', channelType: 'amazon', priority: 'urgent', tags: ['VIP'],
    scenario: 'marketplace',
    lines: [
      ['inbound', "I ordered a size M linen shirt and received an S. I have a wedding in three days. Amazon says contact the seller. Please help."],
      ['outbound', "Hello Lucas — I'm Marco from Northwind. I've already booked a replacement in size M with one-day shipping and raised a return label for the incorrect item. You'll have it tomorrow by noon."],
      ['inbound', "You saved me. Thank you Marco!"],
    ],
  },
  {
    subject: 'Billing question — duplicate charge on invoice INV-2291',
    channel: 'chn_email_billing', channelType: 'email', priority: 'high', tags: ['Refund pending'],
    scenario: 'billing',
    lines: [
      ['inbound', "We appear to have been charged twice for October — invoice INV-2291 shows two line items for the same seat count. Can you check?"],
      ['outbound', "Hi Aisha,\n\nYou're right, and I'm sorry. A proration job ran twice on 3 October. I've issued a credit of $248.00 to the card ending 4417, which should appear in 3–5 business days. I've also added a note to your account so this doesn't recur.\n\nBest,\nPriya"],
    ],
  },
  {
    subject: 'How do I export my data before cancelling?',
    channel: 'chn_email_support', channelType: 'email', priority: 'low', tags: ['At risk'],
    scenario: 'churn',
    lines: [
      ['inbound', "We're considering moving to another tool. Before we decide, can I get a full export of conversations and contacts?"],
      ['outbound', "Absolutely — Settings → Data & exports produces a ZIP with CSVs for conversations, messages, customers and tickets. It's ready within about 10 minutes.\n\nBefore you go, would a 15-minute call help? I'd love to understand what's missing."],
    ],
  },
  {
    subject: 'WhatsApp: delivery window for order 77-C',
    channel: 'chn_whatsapp', channelType: 'whatsapp', priority: 'normal', tags: [],
    scenario: 'delivery',
    lines: [
      ['inbound', "Hi, any update on order 77-C? The tracking hasn't moved in two days."],
      ['outbound', "Hi Mei! The courier scanned it in Karachi hub this morning — it's out for delivery tomorrow between 10:00 and 14:00. I'll ping you if that changes."],
      ['inbound', "Perfect, thanks!"],
    ],
  },
  {
    subject: 'Instagram DM — sizing chart for the linen range',
    channel: 'chn_instagram', channelType: 'instagram', priority: 'low', tags: [],
    scenario: 'presales',
    lines: [
      ['inbound', "hiii do you have a size chart for the linen range? the site one is blurry on mobile"],
      ['outbound', "Hey! Sending a clearer chart now — if you're between sizes we usually recommend sizing up in linen since it relaxes after the first wash."],
    ],
  },
  {
    subject: 'Feature request: scheduled replies for different business hours',
    channel: 'chn_email_support', channelType: 'email', priority: 'normal', tags: ['Beta user'],
    scenario: 'feature',
    lines: [
      ['inbound', "Our team spans three time zones. Could scheduled replies follow the recipient's business hours instead of the workspace default?"],
      ['outbound', "That's a great request and it's on our roadmap for Q1. I've logged it as RF-511 and added you to the beta group so you'll get early access."],
    ],
  },
  {
    subject: 'Telegram: refund status for subscription',
    channel: 'chn_telegram', channelType: 'telegram', priority: 'normal', tags: [],
    scenario: 'billing',
    lines: [
      ['inbound', "I cancelled 5 days ago and still don't see the refund. Order 5512."],
      ['outbound', "Thanks for your patience — the refund was approved on our side and is with your bank. Most issuers post it in 5–10 business days; I'll keep this open and check again on Thursday."],
    ],
  },
  {
    subject: 'Etsy order 3311 — personalised engraving typo',
    channel: 'chn_etsy', channelType: 'etsy', priority: 'high', tags: ['Repeat buyer'],
    scenario: 'marketplace',
    lines: [
      ['inbound', "The engraving reads 'Aniversary' instead of 'Anniversary'. Can this be fixed before it ships?"],
      ['outbound', "Caught it just in time — production hasn't started. I've corrected the file and flagged it to the engraving team. Thank you for flagging so quickly!"],
    ],
  },
  {
    subject: 'Chat: checkout button unresponsive on Safari',
    channel: 'chn_chat', channelType: 'chat', priority: 'urgent', tags: ['At risk'],
    scenario: 'bug',
    lines: [
      ['inbound', "The 'Complete order' button does nothing on Safari 17. Tried twice, now worried I've been charged twice."],
      ['outbound', "Thanks for reporting — we've reproduced it and engineering is shipping a fix within the hour. I've checked your account: both attempts failed at the payment step, so no duplicate charge. I'll confirm once the fix is live."],
      ['inbound', "Great, that's a relief."],
    ],
  },
  {
    subject: 'Wholesale pricing for 500 units',
    channel: 'chn_email_support', channelType: 'email', priority: 'high', tags: ['Wholesale'],
    scenario: 'wholesale',
    lines: [
      ['inbound', "We're a hotel group in Dubai looking at 500 units of your stoneware range. Do you offer tiered wholesale pricing and lead times to the UAE?"],
      ['outbound', "Hello Omar — thanks for reaching out. At 500 units we can offer 22% off list with a 3-week lead time to Jebel Ali, DDP. I'll send the full rate card and a sample request form now."],
    ],
  },
  {
    subject: 'Messenger: return label not received',
    channel: 'chn_messenger', channelType: 'messenger', priority: 'normal', tags: [],
    scenario: 'returns',
    lines: [
      ['inbound', "I requested a return label 3 days ago but nothing arrived in my email."],
      ['outbound', "Looks like it went to an old address on file. I've re-sent it to the correct inbox — check spam if it's not there in 5 minutes, and I can also share a direct download link."],
    ],
  },
  {
    subject: 'eBay message — item not as described',
    channel: 'chn_ebay', channelType: 'ebay', priority: 'high', tags: [],
    scenario: 'marketplace',
    lines: [
      ['inbound', "The listing said solid oak, the base is clearly veneer. I'd like a partial refund or a return."],
      ['outbound', "You're right, and the listing copy was wrong — I've corrected it. Choose whichever you prefer: a full return with prepaid label, or a 35% partial refund to keep it. Both are fine with us."],
    ],
  },
  {
    subject: 'API rate limits on the bulk endpoint',
    channel: 'chn_email_support', channelType: 'email', priority: 'normal', tags: ['Enterprise', 'Beta user'],
    scenario: 'technical',
    lines: [
      ['inbound', "We're hitting 429s on /v1/conversations/bulk at around 40 requests/minute. What's the documented ceiling and is a higher tier possible?"],
      ['outbound', "The default is 60 req/min per workspace with bursts to 100. For enterprise accounts we can raise it to 600 — I've enabled 300 on your workspace today and will confirm the permanent limit with engineering."],
    ],
  },
  {
    subject: 'Chat: can I change my delivery address after ordering?',
    channel: 'chn_chat', channelType: 'chat', priority: 'normal', tags: [],
    scenario: 'delivery',
    lines: [
      ['inbound', "I just ordered 20 minutes ago and moved flats last week — can I update the shipping address?"],
      ['outbound', "Yes — it hasn't been picked yet. Send me the new address and I'll update it on the order right away."],
    ],
  },
  {
    subject: 'VIP escalation: quarterly review deck for Harbour Supply',
    channel: 'chn_email_billing', channelType: 'email', priority: 'urgent', tags: ['VIP', 'Enterprise'],
    scenario: 'vip',
    lines: [
      ['inbound', "Our COO wants the Q3 support review before Thursday's board meeting. Is that possible this week?"],
      ['outbound', "Absolutely — I've asked Amina to prepare it and you'll have the deck Wednesday 09:00 GST. I'll include resolution time trends and the open defect list."],
    ],
  },
  {
    subject: 'Feedback: your help centre search is excellent',
    channel: 'chn_email_support', channelType: 'email', priority: 'low', tags: [],
    scenario: 'praise',
    lines: [
      ['inbound', "Just wanted to say the new help centre search found my answer in one query. Whoever shipped that, thank them."],
      ['outbound', "That made our week — passing it straight to the team. Thanks for taking the time, Grace!"],
    ],
  },
  {
    subject: 'TikTok Shop — bundle missing an item',
    channel: 'chn_tiktok', channelType: 'tiktok', priority: 'normal', tags: [],
    scenario: 'marketplace',
    lines: [
      ['inbound', "My bundle should have 3 items and only 2 arrived — the candle is missing."],
      ['outbound', "Sorry about that! I've dispatched the missing candle on its own tracking number and it should reach you in 3–5 days."],
    ],
  },
  {
    subject: 'Dark mode contrast issue in the agent app',
    channel: 'chn_email_support', channelType: 'email', priority: 'low', tags: ['Beta user'],
    scenario: 'bug',
    lines: [
      ['inbound', "In dark mode the secondary text on the ticket cards is nearly unreadable (contrast looks under 3:1)."],
      ['outbound', "Thanks — that's a real accessibility bug. I've filed it and we're bringing secondary text up to at least 4.5:1 in the next release."],
    ],
  },
];

const statuses = ['open', 'open', 'open', 'pending', 'pending', 'resolved', 'resolved', 'closed', 'new', 'on_hold'];
const agents = ['usr_daniel', 'usr_priya', 'usr_marco', 'usr_lena', 'usr_hana', 'usr_amina'];
const teamForChannel = { email: 'team_email', chat: 'team_chat', amazon: 'team_market', ebay: 'team_market', etsy: 'team_market', walmart: 'team_market', tiktok: 'team_market', whatsapp: 'team_email', instagram: 'team_chat', messenger: 'team_chat', telegram: 'team_email', shopify: 'team_email', woocommerce: 'team_email', aliexpress: 'team_market' };

const insertConv = db.prepare(`INSERT INTO conversations (id,org_id,ref,subject,customer_id,channel_id,channel_type,team_id,assignee_id,status,priority,tags,unread_count,is_starred,first_response_at,resolved_at,last_message_at,sla_due_at,sla_state,sentiment,intent,ai_summary,csat,is_demo,created_at)
  VALUES (@id,@org,@ref,@subject,@customer,@channel,@ctype,@team,@assignee,@status,@priority,@tags,@unread,@star,@fr,@resolved,@last,@sla,@slaState,@sentiment,@intent,@summary,@csat,1,@created)`);
const insertMsg = db.prepare(`INSERT INTO messages (id,org_id,conversation_id,direction,author_type,author_user_id,author_customer_id,author_name,body,channel_type,status,is_internal,attachments_json,meta_json,created_at)
  VALUES (@id,@org,@conv,@direction,@authorType,@userId,@customerId,@authorName,@body,@ctype,@status,@internal,@attachments,@meta,@created)`);

let convIndex = 0;
for (const t of threads) {
  // each thread becomes 1-3 conversations to reach realistic volume
  const copies = [1, 1, 2, 1, 2, 1, 3][convIndex % 7];
  for (let c = 0; c < copies; c++) {
    const cust = customers[(convIndex * 3 + c) % customers.length];
    const id = `cnv_${convIndex + 1}_${c}`;
    const status = c === 0 ? pick(statuses) : 'open';
    const created = Date.now() - Math.floor(Math.pow(Math.random(), 1.9) * 60 * 24 * 26 + 25) * 60000;
    const assignee = Math.random() < 0.18 ? null : pick(agents);
    const msgCount = t.lines.length;
    const firstInbound = created;
    const firstReplyMins = rnd(3, 140);
    let lastAt = created;
    let csat = null;
    if (status === 'resolved' || status === 'closed') csat = pick([5, 5, 4, 5, 4, 3, 2]);
    const slaDue = created + (t.priority === 'urgent' ? 60 : t.priority === 'high' ? 240 : 480) * 60000;
    const overdue = Date.now() > slaDue && !['resolved', 'closed'].includes(status);
    const roll = Math.random();
    const slaState = ['resolved', 'closed'].includes(status) ? 'met'
      : overdue ? (roll < 0.35 ? 'breached' : roll < 0.75 ? 'at_risk' : 'on_track') : 'on_track';

    insertConv.run({
      id, org: ORG, ref: `RF-${1200 + convIndex * 3 + c}`, subject: t.subject, customer: cust.id,
      channel: t.channel, ctype: t.channelType, team: teamForChannel[t.channelType] || 'team_email',
      assignee, status, priority: t.priority, tags: JSON.stringify(t.tags),
      unread: status === 'new' ? rnd(1, 2) : (Math.random() < 0.35 && !['resolved', 'closed'].includes(status) ? 1 : 0),
      star: Math.random() < 0.12 ? 1 : 0,
      fr: ['new'].includes(status) ? null : iso(firstInbound + firstReplyMins * 60000),
      resolved: ['resolved', 'closed'].includes(status) ? iso(created + rnd(60, 2800) * 60000) : null,
      last: iso(lastAt), sla: iso(slaDue), slaState,
      sentiment: pick(['positive', 'neutral', 'neutral', 'negative']),
      intent: pick(['Refund request', 'Delivery status', 'Pre-sales question', 'Technical issue', 'Order change', 'Billing query', 'Feature request', 'Praise']),
      summary: `Customer ${t.subject.toLowerCase()}. ${t.lines.length} messages across ${t.channelType}.`,
      csat, created: iso(created),
    });

    let cursor = created;
    t.lines.forEach((ln, i) => {
      const [direction, body] = ln;
      cursor += (i === 0 ? 0 : rnd(8, 220)) * 60000;
      lastAt = Math.max(lastAt, cursor);
      insertMsg.run({
        id: uid('msg'), org: ORG, conv: id, direction,
        authorType: direction === 'inbound' ? 'customer' : 'agent',
        userId: direction === 'inbound' ? null : (assignee || 'usr_daniel'),
        customerId: direction === 'inbound' ? cust.id : null,
        authorName: direction === 'inbound' ? cust.name : (users.find((u) => u[0] === (assignee || 'usr_daniel'))?.[1] || 'Daniel Okafor'),
        body, ctype: t.channelType,
        status: direction === 'outbound' ? 'delivered' : 'delivered',
        internal: 0, attachments: '[]',
        meta: JSON.stringify(direction === 'outbound' ? { via: t.channelType } : { via: t.channelType, deliveredAt: iso(cursor) }),
        created: iso(cursor),
      });
    });
    // an internal note on some threads
    if (convIndex % 5 === 0) {
      insertMsg.run({
        id: uid('msg'), org: ORG, conv: id, direction: 'outbound', authorType: 'agent',
        userId: assignee || 'usr_amina', customerId: null, authorName: 'Amina Rauf',
        body: 'Internal: checked the carrier claim, replacement approved. If they push for a full refund instead, escalate to me.',
        ctype: t.channelType, status: 'sent', internal: 1, attachments: '[]', meta: '{}',
        created: iso(cursor + 30000),
      });
    }
    db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(iso(lastAt), id);
    convIndex++;
  }
}
const allConvs = db.prepare('SELECT id, subject, customer_id, channel_type, status, priority, assignee_id, created_at FROM conversations').all();

/* ---------------- Customer activity ---------------- */
for (const conv of allConvs.slice(0, 40)) {
  db.prepare('INSERT INTO customer_activity (id,org_id,customer_id,type,title,meta,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('act'), ORG, conv.customer_id, 'conversation', `Started conversation “${conv.subject}”`, JSON.stringify({ channel: conv.channel_type }), conv.created_at);
}

/* ---------------- Orders ---------------- */
const products = ['Ceramic mug set of 4', 'Linen shirt — sand', 'Stoneware dinner plates', 'Cold brew concentrate', 'Oak side table', 'Soy candle 220g'];
for (let i = 0; i < 26; i++) {
  const cust = customers[i % customers.length];
  db.prepare(`INSERT INTO orders (id,org_id,customer_id,channel_key,number,total,currency,status,items,placed_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(uid('ord'), ORG, cust.id, pick(['shopify', 'amazon', 'etsy', 'ebay']), `#${rnd(40000, 49999)}`, rnd(28, 940), 'USD',
      pick(['fulfilled', 'fulfilled', 'shipped', 'processing', 'refunded']),
      JSON.stringify([{ name: pick(products), qty: rnd(1, 3) }]), ago(rnd(60, 60 * 24 * 90)));
  db.prepare('INSERT INTO customer_activity (id,org_id,customer_id,type,title,meta,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('act'), ORG, cust.id, 'order', 'Placed an order', JSON.stringify({ total: rnd(28, 940) }), ago(rnd(60, 60 * 24 * 90)));
}

/* ---------------- Tickets ---------------- */
const ticketTitles = [
  ['Damaged shipment — replacement approved', 'high', 'open', 'email'],
  ['Duplicate invoice charge INV-2291', 'urgent', 'pending', 'email'],
  ['Safari checkout button unresponsive', 'urgent', 'open', 'chat'],
  ['Wrong size dispatched (Amazon)', 'high', 'resolved', 'amazon'],
  ['Return label never delivered', 'normal', 'pending', 'messenger'],
  ['Bulk API rate limit increase', 'normal', 'on_hold', 'email'],
  ['Engraving typo correction', 'high', 'resolved', 'etsy'],
  ['Wholesale rate card request — UAE', 'high', 'open', 'email'],
  ['Help centre contrast accessibility bug', 'low', 'open', 'email'],
  ['Subscription refund not received', 'normal', 'pending', 'telegram'],
  ['Address change after order placed', 'normal', 'closed', 'chat'],
  ['TikTok bundle missing candle', 'normal', 'new', 'tiktok'],
  ['SSO / SCIM evaluation questions', 'normal', 'open', 'chat'],
  ['Data export before migration decision', 'low', 'on_hold', 'email'],
  ['Q3 board review deck for Harbour Supply', 'urgent', 'open', 'email'],
  ['eBay item not as described', 'high', 'pending', 'ebay'],
  ['Feature request: per-timezone scheduled replies', 'low', 'open', 'email'],
  ['Delivery window for order 77-C', 'normal', 'resolved', 'whatsapp'],
  ['Sizing chart request (Instagram)', 'low', 'closed', 'instagram'],
  ['Positive feedback — help centre search', 'low', 'closed', 'email'],
];
ticketTitles.forEach(([subject, priority, status, source], i) => {
  const conv = allConvs[i % allConvs.length];
  const created = ago(rnd(60, 60 * 24 * 20));
  const resolved = ['resolved', 'closed'].includes(status) ? ago(rnd(30, 2000)) : null;
  const dueBase = new Date(created).getTime() + (priority === 'urgent' ? 4 : priority === 'high' ? 8 : 24) * 3600000;
  // Resolved tickets must have been resolved before their SLA clock ran out.
  const ticketId = uid('tkt');
  const due = iso(new Date(resolved ? Math.max(dueBase, new Date(resolved).getTime() + 3600000) : dueBase));
  db.prepare(`INSERT INTO tickets (id,org_id,number,conversation_id,subject,description,customer_id,assignee_id,team_id,status,priority,source,tags,custom_fields,sla_policy_id,sla_state,due_at,first_response_at,resolved_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ticketId, ORG, 1001 + i, conv.id, subject, 'Auto-created from the linked conversation. See thread for full context.',
      conv.customer_id, pick(agents), teamForChannel[source] || 'team_email', status, priority, source,
      JSON.stringify([priority === 'urgent' ? 'escalated' : 'support']), JSON.stringify({ environment: 'production', plan: pick(['Starter', 'Growth', 'Enterprise']) }),
      'sla_standard', Date.now() > new Date(due).getTime() && !resolved ? 'breached' : 'on_track',
      due, resolved ? ago(rnd(1, 100)) : null, resolved, created);

  // Audit trail — every ticket carries the events that produced its current state.
  const actor = pick(agents);
  const events = [['ticket.created', conv.customer_id, created]];
  if (status !== 'new') events.push(['ticket.status_changed', actor, ago(rnd(60, 60 * 12))]);
  if (priority === 'urgent' || priority === 'high') events.push(['ticket.priority_changed', actor, ago(rnd(60, 60 * 30))]);
  if (resolved) events.push(['ticket.resolved', actor, resolved]);
  events.forEach(([action, actor, at]) => {
    db.prepare(`INSERT INTO audit_logs (id,org_id,user_id,user_name,action,entity_type,entity_id,meta,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid('aud'), ORG, actor, (users.find((u) => u[0] === actor) || [])[1] || 'System', action, 'ticket', ticketId, JSON.stringify({ number: 1001 + i }), at);
  });
});

/* ---------------- SLA policies ---------------- */
[
  ['sla_standard', 'Standard support', 'Default policy for all inbound conversations.', 240, 1440, 'all', 1, null],
  ['sla_priority', 'Priority & VIP', 'Applies to High and Urgent priority conversations.', 60, 480, 'priority', 1, 'high'],
  ['sla_marketplace', 'Marketplace buyers', 'Amazon, eBay, Etsy and Walmart require faster replies.', 120, 720, 'channel', 1, null],
].forEach(([id, name, description, fr, res, applies, active, priority]) => {
  db.prepare(`INSERT INTO sla_policies (id,org_id,name,description,first_response_mins,resolution_mins,applies_to,business_hours_only,priority,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ORG, name, description, fr, res, applies, 1, priority, active, ago(60 * 24 * 200));
});

/* ---------------- Tags ---------------- */
for (const [name, color] of [['VIP', '#F0A43C'], ['Refund pending', '#E45B65'], ['Wholesale', '#4C7DF0'], ['At risk', '#E45B65'], ['Beta user', '#B07CE8'], ['Repeat buyer', '#16A673'], ['Enterprise', '#142D46'], ['Bug', '#E45B65'], ['Billing', '#21B8A6'], ['Delivery', '#4C7DF0']]) {
  db.prepare('INSERT INTO tags (id,org_id,name,color) VALUES (?,?,?,?)').run(uid('tag'), ORG, name, color);
}

/* ---------------- Saved replies ---------------- */
[
  ['Damaged item — replacement', 'Refund', "Hi {{customer.first_name}},\n\nI'm so sorry your order arrived damaged. I've filed a carrier claim and a replacement is on its way with express shipping — tracking will follow shortly. There's no need to return the damaged item.\n\nWarmly,\n{{agent.first_name}}"],
  ['Refund approved', 'Billing', "Hi {{customer.first_name}},\n\nYour refund of {{refund.amount}} has been approved and sent back to your original payment method. Most banks post it within 3–5 business days.\n\nBest,\n{{agent.first_name}}"],
  ['Order status update', 'Delivery', "Hi {{customer.first_name}},\n\nQuick update on order {{order.number}}: it's currently {{order.status}} and expected to arrive by {{order.eta}}. I'll let you know the moment anything changes.\n\n— {{agent.first_name}}"],
  ['Ask for more details', 'General', "Hi {{customer.first_name}},\n\nThanks for reaching out. Could you share a screenshot and the email address on your account so I can locate this quickly? Once I have those I'll take it from here.\n\n— {{agent.first_name}}"],
  ['Closing a resolved ticket', 'General', "Hi {{customer.first_name}},\n\nGlad we could get this sorted. I'm closing the ticket for now — just reply to this thread if anything else comes up and it'll reopen automatically.\n\nAll the best,\n{{agent.first_name}}"],
  ['Marketplace return instructions', 'Marketplace', "Hello {{customer.first_name}},\n\nI've generated a prepaid return label — it's attached to this message. Drop the parcel at any carrier point within 14 days and the refund is issued on first scan.\n\n— {{agent.first_name}}, Northwind Marketplace Desk"],
].forEach(([title, category, body]) => {
  db.prepare('INSERT INTO saved_replies (id,org_id,title,body,category,created_by,usage_count,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(uid('sr'), ORG, title, body, category, 'usr_amina', rnd(4, 120), ago(60 * 24 * rnd(20, 200)));
});

/* ---------------- Knowledge base ---------------- */
const kbCats = [
  ['kbc_orders', 'Orders & Delivery', 'Shipping windows, tracking and delivery issues', 'Package'],
  ['kbc_returns', 'Returns & Refunds', 'Return policy, labels and refund timelines', 'RotateCcw'],
  ['kbc_billing', 'Billing & Plans', 'Invoices, seats, upgrades and payment methods', 'CreditCard'],
  ['kbc_integrations', 'Integrations', 'Connecting channels, marketplaces and email', 'Plug'],
  ['kbc_account', 'Account & Security', 'SSO, permissions, API keys and audit logs', 'ShieldCheck'],
];
for (const c of kbCats) db.prepare('INSERT INTO knowledge_categories (id,org_id,name,description,icon) VALUES (?,?,?,?,?)').run(c[0], ORG, c[1], c[2], c[3]);

const articles = [
  ['kbc_orders', 'Where is my order? Tracking your shipment', 'public', `## Tracking your order

Every Northwind order ships with a carrier tracking number. You'll find it in your dispatch email, or under **Account → Orders → View details**.

### Typical delivery windows

| Region | Standard | Express |
| --- | --- | --- |
| North America | 3–5 business days | 1–2 business days |
| Europe | 4–7 business days | 2–3 business days |
| Middle East & Asia | 5–9 business days | 2–4 business days |

If tracking has not updated for **48 hours**, reply to your dispatch email and our team will open a carrier trace.`],
  ['kbc_orders', 'Changing your delivery address after ordering', 'public', `You can change the shipping address **until the order is picked** (usually within 2 hours of ordering).

1. Open the order in **Account → Orders**.
2. Choose **Edit shipping**.
3. If the button is greyed out, the parcel is already with the carrier — contact support and we will attempt a redirect.

Address changes after dispatch may incur a carrier fee of $6.`],
  ['kbc_returns', 'Our 30-day return policy', 'public', `Items can be returned within **30 days of delivery** in original condition. Personalised and engraved items are excluded unless faulty.

- **Faulty or damaged:** we pay return shipping and send a replacement immediately.
- **Changed your mind:** a prepaid label is provided; $5 is deducted from the refund.
- **Refund timing:** issued on first carrier scan, posted in 3–5 business days.`],
  ['kbc_returns', 'How to get a prepaid return label', 'public', `Open **Account → Orders → Return or replace** and choose a reason. A label is emailed within 5 minutes.

If it does not arrive, check spam, then ask support to re-issue it — we can also generate a direct PDF download.`],
  ['kbc_billing', 'Understanding your invoice', 'internal', `Invoices are issued on the first of each month and include seat count, add-ons and any proration credits.

**Common questions**

- *Duplicate charge:* caused by a proration job re-running. Issue a credit for the duplicate line and note the account.
- *Seat changes mid-cycle:* prorated to the day.
- *VAT / GST:* applied based on billing country, reverse-charge where a valid tax ID exists.`],
  ['kbc_billing', 'Refunds and duplicate charges', 'public', `If you believe you've been charged twice, send us the invoice number and the last four digits of the card. We verify against the payment processor and issue a credit within one business day. Bank posting takes a further 3–5 business days.`],
  ['kbc_integrations', 'Connecting Gmail to ReplyFlow', 'public', `1. Go to **Integrations → Gmail → Connect**.
2. Sign in with the mailbox you want to share (Google Workspace admins may need to approve the OAuth app).
3. Choose which labels become conversations — by default, everything except Spam and Trash.

ReplyFlow requests the \`gmail.modify\` scope only. Tokens are encrypted at rest and never exposed to the browser.`],
  ['kbc_integrations', 'Connecting WhatsApp Business Cloud API', 'internal', `You need a Meta Business account, a verified phone number and a permanent system-user token.

1. Create a WhatsApp app in Meta for Developers.
2. Add the **whatsapp_business_messaging** permission.
3. Paste the Phone Number ID and token into ReplyFlow.
4. Set the webhook callback to \`/api/webhooks/whatsapp\` and subscribe to \`messages\`.

Template messages are required outside the 24-hour customer service window.`],
  ['kbc_integrations', 'Marketplace connection requirements', 'internal', `Each marketplace requires approved developer access:

- **Amazon:** SP-API application approval (2–6 weeks).
- **eBay:** production keyset with OAuth consent.
- **Etsy:** Open API v3 app registration.
- **Walmart:** Developer portal approval.
- **TikTok Shop:** Partner Center review.

Until approval is granted ReplyFlow shows the integration as *Awaiting approval* and ingests **no** data. We never scrape or automate a marketplace UI.`],
  ['kbc_account', 'Setting up SAML SSO', 'internal', `Available on Studio and above.

1. In **Settings → Security**, download the ReplyFlow metadata XML.
2. Create the app in your IdP (Okta, Entra ID, Google Workspace).
3. Paste the IdP metadata URL back into ReplyFlow and test with a pilot group.
4. Enforce SSO once verified — password login is disabled for all non-admin users.`],
  ['kbc_account', 'API keys and rate limits', 'public', `Create keys in **Settings → API & webhooks**. Keys are shown once; only a hash and prefix are stored.

Rate limits: **60 requests/minute** per workspace, bursts to 100. Enterprise workspaces can request 600. Exceeding the limit returns \`429\` with a \`Retry-After\` header.`],
];
articles.forEach(([cat, title, visibility, body], i) => {
  db.prepare(`INSERT INTO knowledge_articles (id,org_id,category_id,title,slug,body,visibility,status,views,helpful,author_id,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid('art'), ORG, cat, title, title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), body, visibility, 'published', rnd(80, 4200), rnd(12, 380), pick(agents), ago(rnd(60, 20000)), ago(60 * 24 * rnd(30, 300)));
});

/* ---------------- Automations ---------------- */
const autos = [
  ['Route marketplace messages', 'Send Amazon, eBay, Etsy and Walmart messages straight to the Marketplace Desk', 'new_conversation',
    { channel_types: ['amazon', 'ebay', 'etsy', 'walmart', 'tiktok'] }, [{ field: 'channel_type', op: 'in', value: 'marketplace' }],
    [{ type: 'assign_team', value: 'team_market' }, { type: 'set_priority', value: 'high' }], 1, 1284],
  ['Urgent keyword escalation', 'Flag refund, legal, chargeback and outage keywords as Urgent and notify the manager', 'new_message',
    { keywords: ['refund', 'chargeback', 'legal', 'outage', 'broken', 'urgent'] }, [{ field: 'body', op: 'contains_keyword', value: 'refund,chargeback,legal,outage' }],
    [{ type: 'set_priority', value: 'urgent' }, { type: 'add_tag', value: 'escalated' }, { type: 'notify_manager', value: 'usr_amina' }], 1, 942],
  ['No-reply reminder after 2 hours', 'Nudge the assignee when a conversation has had no reply for 2 hours', 'sla_risk',
    { minutes: 120 }, [{ field: 'status', op: 'in', value: 'open,new' }],
    [{ type: 'wait', value: '120' }, { type: 'notify_assignee', value: 'No reply in 2 hours' }], 1, 611],
  ['VIP customer concierge', 'Anything from VIP-tagged customers goes to the senior desk and is starred', 'new_conversation',
    {}, [{ field: 'customer_tag', op: 'equals', value: 'VIP' }],
    [{ type: 'assign_user', value: 'usr_amina' }, { type: 'set_priority', value: 'urgent' }, { type: 'star' }], 1, 318],
  ['CSAT survey on resolve', 'Send a one-question CSAT survey when a conversation is resolved', 'status_change',
    { to: 'resolved' }, [], [{ type: 'send_csat', value: '' }, { type: 'wait', value: '10' }], 1, 2205],
  ['Round-robin chat assignment', 'Distribute new website chats evenly across the Live Chat Crew', 'new_conversation',
    { channel_types: ['chat'] }, [{ field: 'assignee', op: 'is_empty' }],
    [{ type: 'assign_round_robin', value: 'team_chat' }], 1, 1760],
  ['SLA breach escalation', 'Escalate to the team lead when an SLA is breached', 'sla_breach',
    {}, [], [{ type: 'set_priority', value: 'urgent' }, { type: 'notify_manager', value: 'usr_marco' }, { type: 'add_tag', value: 'sla-breach' }], 1, 148],
  ['Weekend auto-acknowledgement', 'Acknowledge conversations that arrive outside business hours', 'new_conversation',
    { outside_business_hours: true }, [], [{ type: 'send_auto_reply', value: 'out_of_office' }], 0, 402],
];
for (const [name, description, trigger, tcfg, conditions, actions, enabled, runs] of autos) {
  db.prepare(`INSERT INTO automations (id,org_id,name,description,enabled,trigger_type,trigger_config,conditions,actions,run_count,last_run_at,created_at,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(uid('aut'), ORG, name, description, enabled, trigger, JSON.stringify(tcfg), JSON.stringify(conditions), JSON.stringify(actions), runs, ago(rnd(2, 300)), ago(60 * 24 * rnd(20, 200)));
}
const autoIds = db.prepare('SELECT id FROM automations').all();
for (let i = 0; i < 24; i++) {
  const conv = allConvs[i % allConvs.length];
  db.prepare('INSERT INTO automation_runs (id,org_id,automation_id,conversation_id,status,log,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('run'), ORG, pick(autoIds).id, conv.id, pick(['success', 'success', 'success', 'skipped']),
      'Conditions evaluated; actions executed.', ago(rnd(5, 60 * 24 * 10)));
}

/* ---------------- Notifications ---------------- */
[
  ['sla', 'SLA breach risk', 'RF-1203 has 14 minutes left on its first-response SLA.', '/inbox?status=open', 0],
  ['assignment', 'Assigned to you', 'Amina assigned you “VIP escalation: quarterly review deck”.', '/inbox', 0],
  ['mention', 'Daniel mentioned you', '“Can you approve the refund on the duplicate invoice?”', '/inbox', 0],
  ['info', 'Gmail sync complete', '128 new messages imported from support@northwind.io.', '/integrations', 1],
  ['warning', 'Amazon credentials expiring', 'Your SP-API refresh token expires in 6 days.', '/integrations', 1],
  ['success', 'CSAT target reached', 'This week’s CSAT is 4.7 — above your 4.5 target.', '/reports', 1],
].forEach(([type, title, body, link, read], i) => {
  db.prepare('INSERT INTO notifications (id,org_id,user_id,type,title,body,link,read,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid('ntf'), ORG, 'usr_amina', type, title, body, link, read, ago(15 + i * 47));
});

/* ---------------- CSAT ---------------- */
for (const conv of allConvs) {
  if (['resolved', 'closed'].includes(conv.status) && Math.random() < 0.75) {
    db.prepare('INSERT INTO csat_surveys (id,org_id,conversation_id,customer_id,score,comment,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uid('csat'), ORG, conv.id, conv.customer_id, pick([5, 5, 5, 4, 4, 3, 2]),
        pick([null, 'Super fast, thank you!', 'Took a while but solved.', 'Daniel was excellent.', null]),
        conv.resolved_at || ago(Math.floor(Math.pow(Math.random(), 1.5) * 60 * 24 * 20 + 60)));
  }
}

/* ---------------- Custom fields, API keys, webhooks, business hours, widget ---------------- */
[['ticket', 'environment', 'Environment', 'select', ['production', 'staging', 'sandbox'], 0],
 ['ticket', 'plan', 'Customer plan', 'select', ['Starter', 'Growth', 'Enterprise'], 0],
 ['ticket', 'order_number', 'Related order', 'text', [], 0],
 ['customer', 'account_tier', 'Account tier', 'select', ['Free', 'Pro', 'Enterprise'], 0]
].forEach(([entity, key, label, type, options, req]) => {
  db.prepare('INSERT INTO custom_fields (id,org_id,entity,key,label,type,options,required) VALUES (?,?,?,?,?,?,?,?)')
    .run(uid('cf'), ORG, entity, key, label, type, JSON.stringify(options), req);
});

db.prepare('INSERT INTO api_keys (id,org_id,name,prefix,hash,last_used_at,revoked,created_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(uid('key'), ORG, 'Production server', 'rf_live_9f2a', 'sha256:demo-hash', ago(14), 0, ago(60 * 24 * 64));
db.prepare('INSERT INTO api_keys (id,org_id,name,prefix,hash,last_used_at,revoked,created_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(uid('key'), ORG, 'Staging', 'rf_test_41b7', 'sha256:demo-hash-2', ago(600), 0, ago(60 * 24 * 30));

db.prepare('INSERT INTO webhooks (id,org_id,url,events,secret,active,last_status,last_delivery_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(uid('wh'), ORG, 'https://hooks.northwind.io/replyflow', JSON.stringify(['conversation.created', 'message.created', 'ticket.resolved']), 'whsec_demo', 1, 200, ago(9), ago(60 * 24 * 20));
db.prepare('INSERT INTO webhooks (id,org_id,url,events,secret,active,last_status,last_delivery_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(uid('wh'), ORG, 'https://api.northwind.io/csat-ingest', JSON.stringify(['csat.submitted']), 'whsec_demo2', 0, null, null, ago(60 * 24 * 8));

for (let d = 0; d < 7; d++) {
  db.prepare('INSERT INTO business_hours (id,org_id,day,open_time,close_time,closed) VALUES (?,?,?,?,?,?)')
    .run(uid('bh'), ORG, d, '09:00', '18:00', d === 0 || d === 6 ? 1 : 0);
}

db.prepare('INSERT INTO widget_settings (org_id,name,welcome_message,offline_message,primary_color,position,bubble_style,avatar_initials,prechat_enabled,prechat_fields,business_hours_only,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  .run(ORG, 'Northwind Support', 'Hi there — how can we help you today?', 'We are away right now — leave your email and we’ll get back to you first thing.',
    '#21B8A6', 'bottom-right', 'round', 'NW', 1,
    JSON.stringify([{ key: 'name', label: 'Name', required: true }, { key: 'email', label: 'Email', required: true }, { key: 'topic', label: 'How can we help?', required: false }]),
    0, nowIso());

db.prepare('INSERT INTO workspace_settings (org_id,data,updated_at) VALUES (?,?,?)').run(ORG, JSON.stringify({
  default_signature: '— Northwind Support\nnorthwind.io · Every conversation, one workspace.',
  ai_provider: 'demo',
  ai_model: 'replyflow-assist-v2',
  ai_auto_send: false,
  ai_approval_required: true,
  notifications_email: true,
  notifications_desktop: true,
  notifications_digest: 'daily',
  security_2fa: false,
  security_sso: false,
  security_audit_retention_days: 365,
}), nowIso());

// recompute lifetime conversation counts
db.prepare(`UPDATE customers SET lifetime_conversations = (SELECT COUNT(*) FROM conversations c WHERE c.customer_id = customers.id)`).run();

console.log('[seed] done:', {
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  customers: db.prepare('SELECT COUNT(*) c FROM customers').get().c,
  conversations: db.prepare('SELECT COUNT(*) c FROM conversations').get().c,
  messages: db.prepare('SELECT COUNT(*) c FROM messages').get().c,
  tickets: db.prepare('SELECT COUNT(*) c FROM tickets').get().c,
  automations: db.prepare('SELECT COUNT(*) c FROM automations').get().c,
  articles: db.prepare('SELECT COUNT(*) c FROM knowledge_articles').get().c,
});
