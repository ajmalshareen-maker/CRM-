import express from 'express';
import { db, uid, nowIso, json, audit, notify } from './db/index.js';

const router = express.Router();

/** Public widget bootstrap: returns branding + availability for the org slug. */
router.get('/config/:slug', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE slug=?').get(req.params.slug);
  if (!org) return res.status(404).json({ error: 'Workspace not found' });
  const w = db.prepare('SELECT * FROM widget_settings WHERE org_id=?').get(org.id);
  const hours = db.prepare('SELECT * FROM business_hours WHERE org_id=? ORDER BY day').all(org.id);
  const day = new Date().getDay();
  const today = hours.find((h) => h.day === day);
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const withinHours = !today?.closed && hhmm >= today?.open_time && hhmm <= today?.close_time;
  const agentsOnline = db.prepare("SELECT COUNT(*) c FROM users WHERE org_id=? AND status='online'").get(org.id).c;
  res.json({
    org: { name: org.name, slug: org.slug, brandColor: org.brand_color, initials: w?.avatar_initials || org.logo_initials },
    widget: {
      name: w?.name || org.name, welcomeMessage: w?.welcome_message, offlineMessage: w?.offline_message,
      primaryColor: w?.primary_color || org.brand_color, position: w?.position || 'bottom-right',
      bubbleStyle: w?.bubble_style || 'round', avatarInitials: w?.avatar_initials || org.logo_initials,
      prechatEnabled: !!w?.prechat_enabled, prechatFields: json(w?.prechat_fields, []),
      businessHoursOnly: !!w?.business_hours_only,
    },
    availability: {
      online: (w?.business_hours_only ? withinHours : true) && agentsOnline > 0,
      agentsOnline, withinBusinessHours: withinHours,
      hours: hours.map((h) => ({ day: h.day, open: h.open_time, close: h.close_time, closed: !!h.closed })),
    },
  });
});

/** Visitor starts a chat: creates/reuses the customer, conversation and first message. */
router.post('/start/:slug', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE slug=?').get(req.params.slug);
  if (!org) return res.status(404).json({ error: 'Workspace not found' });
  const { name, email, message, pageUrl, browser, location } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  let customer = db.prepare('SELECT * FROM customers WHERE org_id=? AND lower(email)=lower(?)').get(org.id, email);
  if (!customer) {
    const id = uid('cus');
    db.prepare(`INSERT INTO customers (id,org_id,name,email,avatar_color,tags,ltv,lifetime_conversations,last_seen_at,created_at,is_demo)
      VALUES (?,?,?,?,?,?,0,0,?,?,0)`).run(id, org.id, name || email.split('@')[0], email, '#21B8A6', '["Website chat"]', nowIso(), nowIso());
    customer = db.prepare('SELECT * FROM customers WHERE id=?').get(id);
  } else {
    db.prepare('UPDATE customers SET last_seen_at=? WHERE id=?').run(nowIso(), customer.id);
  }

  const channel = db.prepare("SELECT * FROM channels WHERE org_id=? AND type='chat'").get(org.id);
  const convId = uid('cnv');
  const count = db.prepare('SELECT COUNT(*) c FROM conversations WHERE org_id=?').get(org.id).c;
  db.prepare(`INSERT INTO conversations (id,org_id,ref,subject,customer_id,channel_id,channel_type,team_id,assignee_id,status,priority,tags,unread_count,is_starred,last_message_at,sla_due_at,sla_state,sentiment,intent,is_demo,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?,?,?,?,0,?)`)
    .run(convId, org.id, `RF-${2100 + count}`, message ? String(message).slice(0, 80) : 'Website chat enquiry', customer.id,
      channel?.id || null, 'chat', 'team_chat', null, 'new', 'normal', '["Website chat"]', nowIso(),
      new Date(Date.now() + 60 * 60000).toISOString(), 'on_track', 'neutral', 'Live chat enquiry', nowIso());

  if (message) {
    db.prepare(`INSERT INTO messages (id,org_id,conversation_id,direction,author_type,author_customer_id,author_name,body,channel_type,status,is_internal,attachments_json,meta_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,'[]',?,?)`)
      .run(uid('msg'), org.id, convId, 'inbound', 'customer', customer.id, customer.name, String(message), 'chat', 'delivered',
        JSON.stringify({ pageUrl, browser, location }), nowIso());
  }
  db.prepare('INSERT INTO chat_visitors (id,org_id,name,email,page_url,location,browser,conversation_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid('vis'), org.id, customer.name, email, pageUrl || null, location || null, browser || null, convId, nowIso());

  const agents = db.prepare("SELECT id FROM users WHERE org_id=? AND status='online' AND role IN ('agent','team_manager','admin')").all(org.id);
  notify(org.id, null, 'info', 'New website chat', `${customer.name}: ${String(message || '').slice(0, 70)}`, `/inbox?c=${convId}`);
  res.status(201).json({ conversationId: convId, customer: { name: customer.name, email: customer.email }, agentsOnline: agents.length });
});

/** Visitor sends a follow-up message. */
router.post('/message/:conversationId', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const { body, email } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Message body is required' });
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(conv.customer_id);
  if (email && customer.email && email.toLowerCase() !== customer.email.toLowerCase()) {
    return res.status(403).json({ error: 'Visitor identity does not match this conversation' });
  }
  const id = uid('msg');
  db.prepare(`INSERT INTO messages (id,org_id,conversation_id,direction,author_type,author_customer_id,author_name,body,channel_type,status,is_internal,attachments_json,meta_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,'[]','{}',?)`)
    .run(id, conv.org_id, conv.id, 'inbound', 'customer', customer.id, customer.name, String(body), 'chat', 'delivered', nowIso());
  db.prepare(`UPDATE conversations SET last_message_at=?, unread_count=unread_count+1,
      status=CASE WHEN status IN ('resolved','closed') THEN 'open' ELSE status END WHERE id=?`)
    .run(nowIso(), conv.id);
  const message = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
  res.status(201).json({ message: { id, body: message.body, createdAt: message.created_at, direction: 'inbound' } });
});

/** Visitor polls this conversation's messages (long-poll fallback when WS is blocked). */
router.get('/messages/:conversationId', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const rows = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND is_internal=0 ORDER BY created_at ASC').all(conv.id);
  res.json({
    messages: rows.map((m) => ({ id: m.id, body: m.body, direction: m.direction, authorName: m.author_name, createdAt: m.created_at, status: m.status })),
    status: conv.status,
  });
});

router.post('/offline/:slug', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE slug=?').get(req.params.slug);
  if (!org) return res.status(404).json({ error: 'Workspace not found' });
  const { name, email, message } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  notify(org.id, null, 'info', 'Offline contact form', `${name || email} — ${String(message || '').slice(0, 80)}`, '/inbox');
  res.status(201).json({ ok: true, note: 'Captured and queued — the team will follow up by email.' });
});

/** The embeddable loader script served at /widget.js */
export function widgetScript() {
  return `/*! ReplyFlow live chat widget — load with: <script src="https://YOUR_HOST/widget.js" data-replyflow="northwind" defer></script> */
(function () {
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var slug = (script && script.getAttribute('data-replyflow')) || 'northwind';
  var base = (script && script.src ? new URL(script.src).origin : window.location.origin);
  var state = { open: false, conversationId: null, config: null, messages: [], visitor: {} };

  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif";
  function css() {
    return ''
      + '.rfw-launcher{position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;'
      + 'background:var(--rfw-accent);box-shadow:0 10px 30px rgba(20,45,70,.28);display:flex;align-items:center;justify-content:center;z-index:2147483000;transition:transform .18s ease}'
      + '.rfw-launcher:hover{transform:scale(1.06)}'
      + '.rfw-panel{position:fixed;bottom:92px;right:22px;width:372px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 130px);'
      + 'background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(20,45,70,.28);display:none;flex-direction:column;overflow:hidden;'
      + 'font-family:' + font + ';z-index:2147483000;border:1px solid rgba(20,45,70,.08)}'
      + '.rfw-panel.open{display:flex;animation:rfw-in .22s ease}'
      + '@keyframes rfw-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
      + '.rfw-head{background:var(--rfw-accent);color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px}'
      + '.rfw-avatar{width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}'
      + '.rfw-title{font-weight:650;font-size:14px;line-height:1.2}.rfw-sub{font-size:11.5px;opacity:.85;display:flex;align-items:center;gap:5px}'
      + '.rfw-dot{width:7px;height:7px;border-radius:50%;background:#7ef0c5;display:inline-block}'
      + '.rfw-body{flex:1;overflow-y:auto;padding:16px;background:#f7f9fc;display:flex;flex-direction:column;gap:10px}'
      + '.rfw-msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}'
      + '.rfw-in{background:#fff;color:#172b4d;border:1px solid rgba(20,45,70,.07);align-self:flex-start;border-bottom-left-radius:5px}'
      + '.rfw-out{background:var(--rfw-accent);color:#fff;align-self:flex-end;border-bottom-right-radius:5px}'
      + '.rfw-meta{font-size:10.5px;color:#93a0b4;align-self:flex-start;margin-top:-6px}'
      + '.rfw-form{padding:12px;border-top:1px solid #edf1f7;display:flex;gap:8px;background:#fff}'
      + '.rfw-input{flex:1;border:1px solid #dfe6ef;border-radius:11px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;resize:none;max-height:88px}'
      + '.rfw-input:focus{border-color:var(--rfw-accent);box-shadow:0 0 0 3px rgba(33,184,166,.15)}'
      + '.rfw-send{border:0;background:var(--rfw-accent);color:#fff;border-radius:11px;width:42px;cursor:pointer;font-size:15px}'
      + '.rfw-field{width:100%;border:1px solid #dfe6ef;border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;margin-bottom:8px;box-sizing:border-box}'
      + '.rfw-typing{align-self:flex-start;font-size:11px;color:#718096;padding:2px 4px}'
      + '.rfw-brand{text-align:center;font-size:10px;color:#93a0b4;padding:6px 0 10px;background:#fff}';
  }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function mount() {
    fetch(base + '/api/widget/config/' + slug).then(function (r) { return r.json(); }).then(function (cfg) {
      state.config = cfg;
      var style = el('style'); style.textContent = css(); document.head.appendChild(style);
      document.documentElement.style.setProperty('--rfw-accent', cfg.widget.primaryColor);

      var launcher = el('button', 'rfw-launcher');
      launcher.setAttribute('aria-label', 'Open support chat');
      launcher.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
      document.body.appendChild(launcher);

      var panel = el('div', 'rfw-panel');
      var head = el('div', 'rfw-head');
      head.innerHTML = '<div class="rfw-avatar">' + (cfg.widget.avatarInitials || 'RF') + '</div>'
        + '<div><div class="rfw-title">' + cfg.widget.name + '</div><div class="rfw-sub"><span class="rfw-dot" style="background:'
        + (cfg.availability.online ? '#7ef0c5' : '#ffd9a1') + '"></span>'
        + (cfg.availability.online ? 'Online — typical reply in a few minutes' : 'Away — we reply by email') + '</div></div>';
      panel.appendChild(head);
      var body = el('div', 'rfw-body'); panel.appendChild(body);
      var form = el('div', 'rfw-form');
      form.innerHTML = '<textarea class="rfw-input" rows="1" placeholder="Write a message…"></textarea><button class="rfw-send" aria-label="Send">➤</button>';
      panel.appendChild(form);
      panel.appendChild(el('div', 'rfw-brand', 'Powered by <b>ReplyFlow</b>'));
      document.body.appendChild(panel);

      function render() {
        body.innerHTML = '';
        if (!state.conversationId) {
          var intro = el('div', 'rfw-msg rfw-in', cfg.widget.welcomeMessage);
          body.appendChild(intro);
          if (cfg.widget.prechatEnabled) {
            var card = el('div');
            card.style.cssText = 'background:#fff;border:1px solid rgba(20,45,70,.08);border-radius:14px;padding:14px';
            card.innerHTML = '<div style="font-size:12.5px;font-weight:600;color:#172b4d;margin-bottom:10px">Tell us who you are</div>';
            var SKIP = { message: 1, topic: 1 };
            cfg.widget.prechatFields.forEach(function (f) {
              if (SKIP[f.key]) return; // the free-text question box below covers these
              var input = el('input', 'rfw-field');
              input.placeholder = f.label + (f.required ? ' *' : '');
              input.dataset.key = f.key; input.dataset.required = f.required ? '1' : '';
              card.appendChild(input);
            });
            var msg = el('textarea', 'rfw-field'); msg.placeholder = 'How can we help?'; msg.rows = 3; msg.dataset.key = 'message';
            card.appendChild(msg);
            var start = el('button', 'rfw-send'); start.style.cssText = 'width:100%;height:40px;border-radius:11px;background:var(--rfw-accent);color:#fff;border:0;cursor:pointer;font-weight:600;font-size:13px';
            start.textContent = 'Start chat';
            start.onclick = function () {
              var payload = {}; var missing = false;
              card.querySelectorAll('[data-key]').forEach(function (i) { payload[i.dataset.key] = i.value.trim(); if (i.dataset.required && !i.value.trim()) missing = true; });
              if (missing || !payload.email) { alert('Please complete the required fields.'); return; }
              payload.pageUrl = window.location.href; payload.browser = navigator.userAgent; payload.location = Intl.DateTimeFormat().resolvedOptions().timeZone;
              fetch(base + '/api/widget/start/' + slug, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                .then(function (r) { return r.json(); }).then(function (d) {
                  state.conversationId = d.conversationId; state.visitor.email = payload.email;
                  poll(); render();
                });
            };
            card.appendChild(start);
            body.appendChild(card);
            return;
          }
        } else {
          state.messages.forEach(function (m) {
            if (m.direction === 'inbound') body.appendChild(el('div', 'rfw-msg rfw-in', escapeHtml(m.body)));
            else { body.appendChild(el('div', 'rfw-msg rfw-out', escapeHtml(m.body))); body.appendChild(el('div', 'rfw-meta', 'Support · ' + new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))); }
          });
        }
        body.scrollTop = body.scrollHeight;
      }

      function poll() {
        if (!state.conversationId) return;
        fetch(base + '/api/widget/messages/' + state.conversationId).then(function (r) { return r.json(); }).then(function (d) {
          state.messages = d.messages || []; render(); setTimeout(poll, 4000);
        }).catch(function () { setTimeout(poll, 8000); });
      }

      launcher.onclick = function () { state.open = !state.open; panel.classList.toggle('open', state.open); if (state.open) { render(); if (state.conversationId) poll(); } };
      form.querySelector('.rfw-send').onclick = function () {
        var input = form.querySelector('.rfw-input'); var text = input.value.trim();
        if (!text || !state.conversationId) return;
        input.value = '';
        state.messages.push({ id: 'tmp' + Date.now(), body: text, direction: 'inbound', createdAt: new Date().toISOString() });
        render();
        fetch(base + '/api/widget/message/' + state.conversationId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text, email: state.visitor.email }) });
      };
      render();
    }).catch(function (e) { console.warn('[ReplyFlow] widget unavailable', e); });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();`;
}

export default router;
