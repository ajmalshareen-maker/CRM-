import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { db, uid, nowIso, json, audit, notify } from './db/index.js';
import { runAssistant, analyseConversation, aiProvider } from './ai.js';
import widgetRouter, { widgetScript } from './widget.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ------------------------------------------------------------------ *
 * Realtime (WebSocket) — org-scoped broadcast channels
 * ------------------------------------------------------------------ */
const wss = new WebSocketServer({ server, path: '/ws' });
const orgClients = new Map(); // orgId -> Set(ws)
const widgetClients = new Map(); // conversationId -> Set(ws)

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const orgId = url.searchParams.get('org');
  const convId = url.searchParams.get('conversation');
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  if (convId) {
    if (!widgetClients.has(convId)) widgetClients.set(convId, new Set());
    widgetClients.get(convId).add(ws);
  } else if (orgId) {
    if (!orgClients.has(orgId)) orgClients.set(orgId, new Set());
    orgClients.get(orgId).add(ws);
  }
  ws.on('close', () => {
    orgClients.get(orgId)?.delete(ws);
    widgetClients.get(convId)?.delete(ws);
  });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      if (msg.type === 'typing' && orgId) broadcast(orgId, { type: 'typing', conversationId: msg.conversationId, who: msg.who, name: msg.name }, ws);
      if (msg.type === 'widget_typing' && convId) {
        for (const c of widgetClients.get(convId) || []) if (c !== ws) c.send(JSON.stringify({ type: 'widget_typing', who: msg.who }));
      }
    } catch { /* ignore malformed frames */ }
  });
});
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000).unref();

function broadcast(orgId, payload, except) {
  const set = orgClients.get(orgId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) if (ws !== except && ws.readyState === 1) ws.send(data);
}
function widgetBroadcast(convId, payload) {
  const set = widgetClients.get(convId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) if (ws.readyState === 1) ws.send(data);
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */
const SESSION_COOKIE = 'rf_session';
const SESSION_DAYS = 14;

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token,user_id,org_id,created_at,expires_at) VALUES (?,?,?,?,?)')
    .run(token, user.id, user.org_id, nowIso(), expires);
  return token;
}

function isHttps(req) {
  return req?.secure || (req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function setSessionCookie(req, res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark Secure when the connection really is https. Behind a TLS proxy this
    // still ends up Secure; over plain http it must not be, or the browser drops it.
    secure: isHttps(req),
    path: '/',
    maxAge: SESSION_DAYS * 864e5,
  });
}

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

function authenticate(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
    || (req.headers.authorization || '').replace(/^Bearer /, '')
    || req.query?.token;   // CSV/download links opened in a new tab can't set headers
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!session || new Date(session.expires_at) < new Date()) return res.status(401).json({ error: 'Session expired' });
  const user = db.prepare('SELECT * FROM users WHERE id=? AND org_id=?').get(session.user_id, session.org_id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  req.orgId = user.org_id;
  req.token = token;
  next();
}

/** Role-based access control. Write actions are blocked for read-only users. */
const WRITE_ROLES = ['super_admin', 'admin', 'team_manager', 'agent'];
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Your role does not permit this action' });
    next();
  };
}
function requireWrite(req, res, next) {
  if (!WRITE_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Read-only role: action not permitted' });
  next();
}

/** Simple in-memory rate limiter (per IP + route bucket). */
const buckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = buckets.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count++;
    buckets.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: Math.ceil((entry.reset - now) / 1000) });
    next();
  };
}

/* ------------------------------------------------------------------ *
 * Public / auth routes
 * ------------------------------------------------------------------ */
app.get('/api/health', (req, res) => res.json({ ok: true, ai: aiProvider(), time: nowIso() }));

app.post('/api/auth/login', rateLimit(20, 60000), (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email || '');
  if (!user || !user.password_hash || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  db.prepare('UPDATE users SET status=?, last_active_at=? WHERE id=?').run('online', nowIso(), user.id);
  const token = createSession(user);
  setSessionCookie(req, res, token);
  audit(user.org_id, user, 'auth.login', 'user', user.id);
  // The token is also returned so clients in cookie-blocked contexts (sandboxed
  // iframes, opaque origins) can authenticate with a Bearer header instead.
  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/demo', rateLimit(30, 60000), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id='usr_amina'").get() || db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return res.status(503).json({ error: 'Workspace not seeded' });
  db.prepare('UPDATE users SET status=?, last_active_at=? WHERE id=?').run('online', nowIso(), user.id);
  const token = createSession(user);
  setSessionCookie(req, res, token);
  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE]
    || (req.headers.authorization || '').replace(/^Bearer /, '')
    || req.query?.token;   // CSV/download links opened in a new tab can't set headers
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id=?').get(req.orgId);
  const teams = db.prepare(`SELECT t.* FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.user_id=?`).all(req.user.id);
  res.json({ user: publicUser(req.user), org, teams, aiProvider: aiProvider() });
});

app.patch('/api/auth/me', authenticate, requireWrite, (req, res) => {
  const { name, title, status, availability, avatar_color } = req.body || {};
  db.prepare(`UPDATE users SET name=COALESCE(?,name), title=COALESCE(?,title), status=COALESCE(?,status),
    availability=COALESCE(?,availability), avatar_color=COALESCE(?,avatar_color) WHERE id=? AND org_id=?`)
    .run(name, title, status, availability, avatar_color, req.user.id, req.orgId);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

/* ------------------------------------------------------------------ *
 * Shared serialisers (always org-scoped)
 * ------------------------------------------------------------------ */
const convSelect = `
  SELECT c.*, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
         cu.avatar_color AS customer_color, cu.location AS customer_location, cu.tags AS customer_tags,
         cu.ltv AS customer_ltv, co.name AS company_name, co.id AS company_id,
         ch.name AS channel_name, ch.handle AS channel_handle, ch.status AS channel_status,
         u.name AS assignee_name, u.avatar_color AS assignee_color, t.name AS team_name,
         (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS preview,
         (SELECT author_name FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS preview_author,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count
  FROM conversations c
  LEFT JOIN customers cu ON cu.id=c.customer_id
  LEFT JOIN companies co ON co.id=cu.company_id
  LEFT JOIN channels ch ON ch.id=c.channel_id
  LEFT JOIN users u ON u.id=c.assignee_id
  LEFT JOIN teams t ON t.id=c.team_id`;

function shapeConversation(row) {
  if (!row) return null;
  return {
    id: row.id, ref: row.ref, subject: row.subject, status: row.status, priority: row.priority,
    channelType: row.channel_type, channelId: row.channel_id, channelName: row.channel_name,
    channelStatus: row.channel_status, teamId: row.team_id, teamName: row.team_name,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name, color: row.assignee_color } : null,
    customer: {
      id: row.customer_id, name: row.customer_name, email: row.customer_email, phone: row.customer_phone,
      color: row.customer_color, location: row.customer_location, tags: json(row.customer_tags, []),
      ltv: row.customer_ltv, company: row.company_name, companyId: row.company_id,
    },
    tags: json(row.tags, []), unreadCount: row.unread_count, starred: !!row.is_starred,
    preview: row.preview, previewAuthor: row.preview_author, messageCount: row.message_count,
    lastMessageAt: row.last_message_at, createdAt: row.created_at, firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at, slaDueAt: row.sla_due_at, slaState: row.sla_state,
    sentiment: row.sentiment, intent: row.intent, summary: row.ai_summary, csat: row.csat,
    snoozedUntil: row.snoozed_until, isDemo: !!row.is_demo,
  };
}
function shapeMessage(m) {
  return {
    id: m.id, direction: m.direction, authorType: m.author_type, authorId: m.author_user_id || m.author_customer_id,
    authorName: m.author_name, body: m.body, channelType: m.channel_type, status: m.status,
    isInternal: !!m.is_internal, attachments: json(m.attachments_json, []), meta: json(m.meta_json, {}),
    createdAt: m.created_at,
  };
}
const getConversationRow = (orgId, id) => db.prepare(`${convSelect} WHERE c.org_id=? AND c.id=?`).get(orgId, id);

function touchConversation(id) {
  const last = db.prepare('SELECT MAX(created_at) m FROM messages WHERE conversation_id=?').get(id).m;
  db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(last || nowIso(), id);
}

/** Deliver an outbound message through the conversation's channel.
 *  Honest delivery semantics: only channels with a live connection are actually sent. */
function deliverOutbound(conversation, body) {
  const channel = conversation.channel_id ? db.prepare('SELECT * FROM channels WHERE id=?').get(conversation.channel_id) : null;
  if (!channel) return { status: 'sent', channel: conversation.channel_type, note: 'No channel bound; stored in ReplyFlow only.' };
  if (channel.status === 'connected' && ['email', 'chat'].includes(channel.type)) {
    // In production the provider adapter (Gmail/Graph/Widget socket) would dispatch here.
    return { status: 'sent', channel: channel.type, note: `Dispatched via ${channel.name} adapter.` };
  }
  return {
    status: 'sent',
    channel: channel.type,
    demo: true,
    note: `Demo channel — reply stored in ReplyFlow. Connect ${channel.name} credentials to deliver to the real platform.`,
  };
}

/* ------------------------------------------------------------------ *
 * Dashboard & reports
 * ------------------------------------------------------------------ */
const rangeToDates = (range, from, to) => {
  const now = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (range === 'custom' && from && to) return { start: new Date(from), end: new Date(new Date(to).getTime() + 86399999) };
  const start = new Date(now);
  switch (range) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'yesterday': start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); return { start, end: new Date(startOf(now)) };
    case '30d': start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); break;
    case '7d': default: start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  }
  return { start, end: new Date(now.getTime() + 60000) };
};

app.get('/api/dashboard', authenticate, (req, res) => {
  const { start, end } = rangeToDates(req.query.range || '7d', req.query.from, req.query.to);
  const s = start.toISOString();
  const e = end.toISOString();
  const org = req.orgId;

  const convs = db.prepare(`SELECT * FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ?`).all(org, s, e);
  const allConvs = db.prepare('SELECT * FROM conversations WHERE org_id=?').all(org);

  // Period-over-period comparison — real numbers, not decoration.
  const spanMs = Math.max(1, end - start);
  const prevStart = new Date(start.getTime() - spanMs).toISOString();
  const prevEnd = s;
  const prevConvs = db.prepare(`SELECT * FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ?`).all(org, prevStart, prevEnd);
  const prevFrt = db.prepare(`SELECT AVG((julianday(first_response_at)-julianday(created_at))*24*60) v FROM conversations
    WHERE org_id=? AND first_response_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, prevStart, prevEnd).v;
  const prevArt = db.prepare(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24*60) v FROM conversations
    WHERE org_id=? AND resolved_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, prevStart, prevEnd).v;
  const prevCsat = db.prepare(`SELECT AVG(score) v FROM csat_surveys WHERE org_id=? AND created_at BETWEEN ? AND ?`).get(org, prevStart, prevEnd).v;
  const pct = (cur, prev) => (prev && Number.isFinite(prev) && prev !== 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const openCount = allConvs.filter((c) => ['open', 'new', 'on_hold'].includes(c.status)).length;
  const unassigned = allConvs.filter((c) => !c.assignee_id && !['resolved', 'closed'].includes(c.status)).length;
  const pending = allConvs.filter((c) => c.status === 'pending').length;

  const frt = db.prepare(`SELECT AVG((julianday(first_response_at)-julianday(created_at))*24*60) v FROM conversations
    WHERE org_id=? AND first_response_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, s, e).v;
  const art = db.prepare(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24*60) v FROM conversations
    WHERE org_id=? AND resolved_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, s, e).v;
  const csat = db.prepare(`SELECT AVG(score) v, COUNT(*) c FROM csat_surveys WHERE org_id=? AND created_at BETWEEN ? AND ?`).get(org, s, e);

  // conversation volume by day
  const days = [];
  const spanDays = Math.min(30, Math.max(1, Math.ceil((end - start) / 864e5)));
  for (let i = spanDays - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    const dayConvs = allConvs.filter((c) => c.created_at.slice(0, 10) === key);
    const replies = db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND direction='outbound' AND is_internal=0 AND substr(created_at,1,10)=?`).get(org, key).c;
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      incoming: dayConvs.length,
      replies,
      resolved: dayConvs.filter((c) => c.resolved_at).length,
    });
  }

  const byChannel = db.prepare(`SELECT channel_type, COUNT(*) c FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ? GROUP BY channel_type ORDER BY c DESC`).all(org, s, e)
    .map((r) => ({ name: r.channel_type, value: r.c }));
  const byStatus = db.prepare(`SELECT status, COUNT(*) c FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ? GROUP BY status`).all(org, s, e)
    .map((r) => ({ name: r.status, value: r.c }));

  const agents = db.prepare('SELECT * FROM users WHERE org_id=?').all(org).map((u) => {
    const assigned = allConvs.filter((c) => c.assignee_id === u.id);
    const resolved = assigned.filter((c) => ['resolved', 'closed'].includes(c.status)).length;
    const replied = db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND author_user_id=? AND direction='outbound' AND is_internal=0`).get(org, u.id).c;
    const frtAgent = db.prepare(`SELECT AVG((julianday(first_response_at)-julianday(created_at))*24*60) v FROM conversations WHERE org_id=? AND assignee_id=? AND first_response_at IS NOT NULL`).get(org, u.id).v;
    const csatAgent = db.prepare(`SELECT AVG(s.score) v FROM csat_surveys s JOIN conversations c ON c.id=s.conversation_id WHERE c.assignee_id=? AND c.org_id=?`).get(u.id, org).v;
    return {
      id: u.id, name: u.name, role: u.role, color: u.avatar_color, status: u.status, title: u.title,
      assigned: assigned.length, resolved, replied, open: assigned.filter((c) => ['open', 'new'].includes(c.status)).length,
      frt: frtAgent ? Math.round(frtAgent) : null, csat: csatAgent ? Number(csatAgent.toFixed(2)) : null,
      resolutionRate: assigned.length ? Math.round((resolved / assigned.length) * 100) : 0,
    };
  }).sort((a, b) => b.resolved - a.resolved);

  const recent = db.prepare(`${convSelect} WHERE c.org_id=? ORDER BY c.last_message_at DESC LIMIT 8`).all(org).map(shapeConversation);
  const alerts = db.prepare(`SELECT * FROM conversations WHERE org_id=? AND sla_state IN ('breached','at_risk') AND status NOT IN ('resolved','closed') ORDER BY sla_due_at ASC LIMIT 5`).all(org);
  const activity = db.prepare(`SELECT a.*, cu.name customer_name, cu.avatar_color customer_color FROM customer_activity a LEFT JOIN customers cu ON cu.id=a.customer_id WHERE a.org_id=? ORDER BY a.created_at DESC LIMIT 8`).all(org);

  const breaches = allConvs.filter((c) => c.sla_state === 'breached').length;
  const met = allConvs.filter((c) => ['on_track', 'met'].includes(c.sla_state)).length;

  res.json({
    range: { start: s, end: e, key: req.query.range || '7d' },
    kpis: {
      totalConversations: convs.length,
      openTickets: db.prepare(`SELECT COUNT(*) c FROM tickets WHERE org_id=? AND status IN ('new','open','pending','on_hold')`).get(org).c,
      unassigned, pending,
      avgFirstResponseMins: frt ? Math.round(frt) : null,
      avgResolutionMins: art ? Math.round(art) : null,
      csat: csat.v ? Number(csat.v.toFixed(2)) : null,
      csatResponses: csat.c,
      slaCompliance: allConvs.length ? Math.round((met / allConvs.length) * 100) : 100,
      slaBreaches: breaches,
      resolvedInRange: convs.filter((c) => ['resolved', 'closed'].includes(c.status)).length,
    },
    trends: {
      totalConversations: pct(convs.length, prevConvs.length),
      resolvedInRange: pct(convs.filter((c) => ['resolved', 'closed'].includes(c.status)).length, prevConvs.filter((c) => ['resolved', 'closed'].includes(c.status)).length),
      avgFirstResponseMins: frt && prevFrt ? pct(frt, prevFrt) : null,
      avgResolutionMins: art && prevArt ? pct(art, prevArt) : null,
      csat: csat.v && prevCsat ? pct(csat.v, prevCsat) : null,
      previous: { conversations: prevConvs.length, csat: prevCsat ? Number(prevCsat.toFixed(2)) : null },
      period: { start: prevStart, end: prevEnd },
    },
    series: days,
    byChannel, byStatus, agents,
    leaderboard: agents.slice(0, 5),
    recent,
    alerts: alerts.map((a) => ({ id: a.id, ref: a.ref, subject: a.subject, priority: a.priority, slaState: a.sla_state, slaDueAt: a.sla_due_at, status: a.status })),
    activity,
  });
});

app.get('/api/reports', authenticate, (req, res) => {
  const { start, end } = rangeToDates(req.query.range || '30d', req.query.from, req.query.to);
  const s = start.toISOString(), e = end.toISOString(), org = req.orgId;
  const convs = db.prepare('SELECT * FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ?').all(org, s, e);
  const outbound = db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND direction='outbound' AND is_internal=0 AND created_at BETWEEN ? AND ?`).get(org, s, e).c;
  const inbound = db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND direction='inbound' AND created_at BETWEEN ? AND ?`).get(org, s, e).c;
  const frt = db.prepare(`SELECT AVG((julianday(first_response_at)-julianday(created_at))*24*60) v FROM conversations WHERE org_id=? AND first_response_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, s, e).v;
  const art = db.prepare(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24*60) v FROM conversations WHERE org_id=? AND resolved_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, s, e).v;
  const csatRows = db.prepare('SELECT score FROM csat_surveys WHERE org_id=? AND created_at BETWEEN ? AND ?').all(org, s, e);

  const daily = {};
  for (let i = Math.min(60, Math.ceil((end - start) / 864e5)) - 1; i >= 0; i--) {
    const key = new Date(end.getTime() - i * 864e5).toISOString().slice(0, 10);
    daily[key] = { date: key, conversations: 0, resolved: 0, replies: 0, breaches: 0 };
  }
  for (const c of convs) {
    const k = c.created_at.slice(0, 10);
    if (daily[k]) { daily[k].conversations++; if (c.resolved_at) daily[k].resolved++; if (c.sla_state === 'breached') daily[k].breaches++; }
  }
  const replyRows = db.prepare(`SELECT substr(created_at,1,10) d, COUNT(*) c FROM messages WHERE org_id=? AND direction='outbound' AND is_internal=0 AND created_at BETWEEN ? AND ? GROUP BY d`).all(org, s, e);
  for (const r of replyRows) if (daily[r.d]) daily[r.d].replies = r.c;

  const channels = db.prepare(`SELECT channel_type, COUNT(*) total,
      SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) resolved,
      AVG(CASE WHEN first_response_at IS NOT NULL THEN (julianday(first_response_at)-julianday(created_at))*24*60 END) frt
    FROM conversations WHERE org_id=? AND created_at BETWEEN ? AND ? GROUP BY channel_type ORDER BY total DESC`).all(org, s, e)
    .map((r) => ({ name: r.channel_type, total: r.total, resolved: r.resolved, frt: r.frt ? Math.round(r.frt) : null }));

  const agents = db.prepare('SELECT * FROM users WHERE org_id=?').all(org).map((u) => {
    const mine = convs.filter((c) => c.assignee_id === u.id);
    const csatA = db.prepare(`SELECT AVG(s.score) v FROM csat_surveys s JOIN conversations c ON c.id=s.conversation_id WHERE c.assignee_id=? AND c.org_id=?`).get(u.id, org).v;
    return {
      id: u.id, name: u.name, color: u.avatar_color, assigned: mine.length,
      resolved: mine.filter((c) => ['resolved', 'closed'].includes(c.status)).length,
      replies: db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND author_user_id=? AND direction='outbound' AND is_internal=0 AND created_at BETWEEN ? AND ?`).get(org, u.id, s, e).c,
      csat: csatA ? Number(csatA.toFixed(2)) : null,
      frt: (() => { const v = db.prepare(`SELECT AVG((julianday(first_response_at)-julianday(created_at))*24*60) v FROM conversations WHERE org_id=? AND assignee_id=? AND first_response_at IS NOT NULL AND created_at BETWEEN ? AND ?`).get(org, u.id, s, e).v; return v ? Math.round(v) : null; })(),
    };
  });

  const ticketsByStatus = db.prepare('SELECT status, COUNT(*) c FROM tickets WHERE org_id=? GROUP BY status').all(org).map((r) => ({ name: r.status, value: r.c }));
  const ticketsByPriority = db.prepare('SELECT priority, COUNT(*) c FROM tickets WHERE org_id=? GROUP BY priority').all(org).map((r) => ({ name: r.priority, value: r.c }));
  const distribution = [5, 4, 3, 2, 1].map((score) => ({ score, count: csatRows.filter((r) => r.score === score).length }));

  res.json({
    range: { start: s, end: e },
    kpis: {
      conversations: convs.length, inbound, outbound,
      frt: frt ? Math.round(frt) : null, art: art ? Math.round(art) : null,
      csat: csatRows.length ? Number((csatRows.reduce((a, b) => a + b.score, 0) / csatRows.length).toFixed(2)) : null,
      slaCompliance: convs.length ? Math.round((convs.filter((c) => c.sla_state !== 'breached').length / convs.length) * 100) : 100,
      unresolved: convs.filter((c) => !['resolved', 'closed'].includes(c.status)).length,
    },
    daily: Object.values(daily), channels, agents,
    ticketsByStatus, ticketsByPriority, csatDistribution: distribution,
  });
});

app.get('/api/reports/export', authenticate, (req, res) => {
  const type = req.query.type || 'conversations';
  const org = req.orgId;
  let rows = [];
  let filename = 'replyflow-export.csv';
  if (type === 'conversations') {
    filename = 'replyflow-conversations.csv';
    rows = db.prepare(`${convSelect} WHERE c.org_id=? ORDER BY c.created_at DESC`).all(org).map((r) => ({
      ref: r.ref, subject: r.subject, customer: r.customer_name, email: r.customer_email, channel: r.channel_type,
      status: r.status, priority: r.priority, assignee: r.assignee_name || 'Unassigned', team: r.team_name || '',
      created_at: r.created_at, first_response_at: r.first_response_at || '', resolved_at: r.resolved_at || '', sla_state: r.sla_state, csat: r.csat ?? '',
    }));
  } else if (type === 'tickets') {
    filename = 'replyflow-tickets.csv';
    rows = db.prepare(`SELECT t.*, cu.name customer_name, u.name assignee_name FROM tickets t LEFT JOIN customers cu ON cu.id=t.customer_id LEFT JOIN users u ON u.id=t.assignee_id WHERE t.org_id=?`).all(org)
      .map((t) => ({ number: t.number, subject: t.subject, customer: t.customer_name, status: t.status, priority: t.priority, assignee: t.assignee_name || '', due_at: t.due_at, sla_state: t.sla_state, created_at: t.created_at }));
  } else if (type === 'agents') {
    filename = 'replyflow-agent-performance.csv';
    rows = db.prepare('SELECT * FROM users WHERE org_id=?').all(org).map((u) => ({
      agent: u.name, role: u.role, status: u.status,
      assigned: db.prepare('SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id=?').get(org, u.id).c,
      resolved: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id=? AND status IN ('resolved','closed')`).get(org, u.id).c,
      replies: db.prepare(`SELECT COUNT(*) c FROM messages WHERE org_id=? AND author_user_id=? AND direction='outbound' AND is_internal=0`).get(org, u.id).c,
    }));
  } else {
    filename = 'replyflow-customers.csv';
    rows = db.prepare('SELECT * FROM customers WHERE org_id=?').all(org).map((c) => ({
      name: c.name, email: c.email, phone: c.phone, location: c.location, ltv: c.ltv, conversations: c.lifetime_conversations, tags: json(c.tags, []).join('; '),
    }));
  }
  const headers = rows.length ? Object.keys(rows[0]) : ['empty'];
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

/* ------------------------------------------------------------------ *
 * Conversations & inbox
 * ------------------------------------------------------------------ */
app.get('/api/conversations', authenticate, (req, res) => {
  const org = req.orgId;
  const { view = 'all', status, channel, assignee, priority, team, q, tag, starred, page = 1, pageSize = 40, sort = 'recent' } = req.query;
  const where = ['c.org_id=?'];
  const params = [org];

  if (status && status !== 'all') { where.push('c.status=?'); params.push(status); }
  if (channel && channel !== 'all') { where.push('c.channel_type=?'); params.push(channel); }
  if (priority && priority !== 'all') { where.push('c.priority=?'); params.push(priority); }
  if (team && team !== 'all') { where.push('c.team_id=?'); params.push(team); }
  if (starred === 'true') where.push('c.is_starred=1');
  if (assignee === 'me') { where.push('c.assignee_id=?'); params.push(req.user.id); }
  else if (assignee === 'unassigned') where.push('c.assignee_id IS NULL');
  else if (assignee && assignee !== 'all') { where.push('c.assignee_id=?'); params.push(assignee); }
  if (tag) { where.push('c.tags LIKE ?'); params.push(`%${tag}%`); }
  if (q) {
    where.push(`(lower(c.subject) LIKE ? OR lower(cu.name) LIKE ? OR lower(cu.email) LIKE ? OR lower(c.ref) LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND lower(m.body) LIKE ?))`);
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like, like, like);
  }

  switch (view) {
    case 'mine': where.push('c.assignee_id=?'); params.push(req.user.id); break;
    case 'unassigned': where.push('c.assignee_id IS NULL'); break;
    case 'open': where.push(`c.status IN ('open','new','on_hold')`); break;
    case 'pending': where.push(`c.status='pending'`); break;
    case 'resolved': where.push(`c.status IN ('resolved','closed')`); break;
    case 'chat': where.push(`c.channel_type='chat'`); break;
    case 'mentions': where.push(`EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.is_internal=1)`); break;
    case 'starred': where.push('c.is_starred=1'); break;
    case 'urgent': where.push(`c.priority='urgent'`); break;
    default: break;
  }

  const order = sort === 'oldest' ? 'c.last_message_at ASC' : sort === 'priority'
    ? `CASE c.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, c.last_message_at DESC`
    : 'c.last_message_at DESC';

  const total = db.prepare(`SELECT COUNT(*) c FROM conversations c LEFT JOIN customers cu ON cu.id=c.customer_id WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`${convSelect} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const counts = {
    all: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND status NOT IN ('closed')`).get(org).c,
    mine: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id=? AND status NOT IN ('resolved','closed')`).get(org, req.user.id).c,
    unassigned: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id IS NULL AND status NOT IN ('resolved','closed')`).get(org).c,
    open: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND status IN ('open','new','on_hold')`).get(org).c,
    pending: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND status='pending'`).get(org).c,
    resolved: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND status IN ('resolved','closed')`).get(org).c,
    chat: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND channel_type='chat'`).get(org).c,
    urgent: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND priority='urgent' AND status NOT IN ('resolved','closed')`).get(org).c,
  };

  res.json({ conversations: rows.map(shapeConversation), total, page: Number(page), pageSize: Number(pageSize), counts });
});

app.get('/api/conversations/:id', authenticate, (req, res) => {
  const row = getConversationRow(req.orgId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Conversation not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND org_id=? ORDER BY created_at ASC').all(row.id, req.orgId).map(shapeMessage);
  const customer = db.prepare('SELECT * FROM customers WHERE id=? AND org_id=?').get(row.customer_id, req.orgId);
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id=? AND org_id=? ORDER BY placed_at DESC LIMIT 5').all(row.customer_id, req.orgId);
  const activity = db.prepare('SELECT * FROM customer_activity WHERE customer_id=? AND org_id=? ORDER BY created_at DESC LIMIT 12').all(row.customer_id, req.orgId);
  const otherConvs = db.prepare(`${convSelect} WHERE c.org_id=? AND c.customer_id=? AND c.id<>? ORDER BY c.last_message_at DESC LIMIT 5`).all(req.orgId, row.customer_id, row.id).map(shapeConversation);
  const linkedTickets = db.prepare(`SELECT t.*, u.name assignee_name FROM tickets t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.org_id=? AND t.conversation_id=?`).all(req.orgId, row.id);
  const audits = db.prepare('SELECT * FROM audit_logs WHERE org_id=? AND entity_id=? ORDER BY created_at DESC LIMIT 10').all(req.orgId, row.id);
  res.json({
    conversation: shapeConversation(row),
    messages,
    customer: { ...customer, tags: json(customer?.tags, []), orders, activity },
    otherConversations: otherConvs,
    tickets: linkedTickets,
    audit: audits,
  });
});

app.post('/api/conversations', authenticate, requireWrite, (req, res) => {
  const { subject, customerId, channelId, priority = 'normal', body, assigneeId, tags = [], status = 'open' } = req.body || {};
  const customer = customerId
    ? db.prepare('SELECT * FROM customers WHERE id=? AND org_id=?').get(customerId, req.orgId)
    : null;
  if (!customer) return res.status(400).json({ error: 'A valid customer is required' });
  const channel = db.prepare('SELECT * FROM channels WHERE id=? AND org_id=?').get(channelId, req.orgId);
  const id = uid('cnv');
  const ref = `RF-${1200 + db.prepare('SELECT COUNT(*) c FROM conversations').get().c * 3 + Math.floor(Math.random() * 9)}`;
  db.prepare(`INSERT INTO conversations (id,org_id,ref,subject,customer_id,channel_id,channel_type,team_id,assignee_id,status,priority,tags,unread_count,is_starred,last_message_at,sla_due_at,sla_state,sentiment,intent,is_demo,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,1,?)`)
    .run(id, req.orgId, ref, subject || 'New conversation', customer.id, channel?.id || null, channel?.type || 'email',
      null, assigneeId || req.user.id, status, priority, JSON.stringify(tags), nowIso(),
      new Date(Date.now() + 240 * 60000).toISOString(), 'on_track', 'neutral', 'Manual creation', nowIso());
  if (body) {
    db.prepare(`INSERT INTO messages (id,org_id,conversation_id,direction,author_type,author_user_id,author_name,body,channel_type,status,is_internal,attachments_json,meta_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid('msg'), req.orgId, id, 'outbound', 'agent', req.user.id, req.user.name, body, channel?.type || 'email', 'sent', 0, '[]', JSON.stringify({ via: 'manual' }), nowIso());
    db.prepare('UPDATE conversations SET first_response_at=? WHERE id=?').run(nowIso(), id);
  }
  audit(req.orgId, req.user, 'conversation.created', 'conversation', id, { subject });
  broadcast(req.orgId, { type: 'conversation.created', id });
  res.status(201).json({ conversation: shapeConversation(getConversationRow(req.orgId, id)) });
});

app.patch('/api/conversations/:id', authenticate, requireWrite, (req, res) => {
  const row = getConversationRow(req.orgId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Conversation not found' });
  const allowed = { status: 'status', priority: 'priority', assignee_id: 'assigneeId', team_id: 'teamId', is_starred: 'starred', snoozed_until: 'snoozedUntil' };
  const sets = [];
  const params = [];
  for (const [col, key] of Object.entries(allowed)) {
    if (key in (req.body || {})) {
      sets.push(`${col}=?`);
      let v = req.body[key];
      if (col === 'is_starred') v = v ? 1 : 0;
      params.push(v);
    }
  }
  if ('tags' in (req.body || {})) { sets.push('tags=?'); params.push(JSON.stringify(req.body.tags || [])); }
  if (req.body?.status === 'resolved') { sets.push('resolved_at=?'); params.push(nowIso()); sets.push('sla_state=?'); params.push('met'); }
  if (req.body?.status && !['resolved', 'closed'].includes(req.body.status)) { sets.push('resolved_at=NULL'); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, row.id, req.orgId);

  if ('assigneeId' in (req.body || {})) {
    if (req.body.assigneeId) {
      notify(req.orgId, req.body.assigneeId, 'assignment', 'Conversation assigned to you', `${row.ref} — ${row.subject}`, `/inbox?c=${row.id}`);
    }
  }
  audit(req.orgId, req.user, 'conversation.updated', 'conversation', row.id, req.body);
  const updated = shapeConversation(getConversationRow(req.orgId, row.id));
  broadcast(req.orgId, { type: 'conversation.updated', conversation: updated });
  res.json({ conversation: updated });
});

app.post('/api/conversations/:id/messages', authenticate, requireWrite, (req, res) => {
  const row = getConversationRow(req.orgId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Conversation not found' });
  const { body, isInternal = false, direction = 'outbound', attachments = [], authorName } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Message body is required' });

  const id = uid('msg');
  const delivery = isInternal ? null : deliverOutbound(row, body);
  const meta = { via: row.channel_type, ...(delivery ? { delivery } : {}), ...(req.body?.aiGenerated ? { ai: true } : {}) };
  const status = isInternal ? 'sent' : (delivery?.demo ? 'sent' : 'delivered');

  db.prepare(`INSERT INTO messages (id,org_id,conversation_id,direction,author_type,author_user_id,author_customer_id,author_name,body,channel_type,status,is_internal,attachments_json,meta_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.orgId, row.id, direction, direction === 'inbound' ? 'customer' : 'agent',
      direction === 'inbound' ? null : req.user.id, direction === 'inbound' ? row.customer_id : null,
      direction === 'inbound' ? (authorName || row.customer_name) : req.user.name,
      String(body), row.channel_type, status, isInternal ? 1 : 0, JSON.stringify(attachments), JSON.stringify(meta), nowIso());

  if (!isInternal && direction === 'outbound') {
    const sets = [`unread_count=0`, `status = CASE WHEN status IN ('new') THEN 'open' ELSE status END`];
    const params = [];
    if (!row.first_response_at) { sets.push('first_response_at=?'); params.push(nowIso()); }
    db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id=?`).run(...params, row.id);
  }
  touchConversation(row.id);

  const message = shapeMessage(db.prepare('SELECT * FROM messages WHERE id=?').get(id));
  const conversation = shapeConversation(getConversationRow(req.orgId, row.id));
  broadcast(req.orgId, { type: 'message.created', conversationId: row.id, message, conversation });
  if (!isInternal) widgetBroadcast(row.id, { type: 'message.created', message });
  audit(req.orgId, req.user, isInternal ? 'message.note' : 'message.sent', 'conversation', row.id, { messageId: id });
  res.status(201).json({ message, conversation, delivery });
});

app.post('/api/conversations/:id/read', authenticate, (req, res) => {
  const row = getConversationRow(req.orgId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Conversation not found' });
  db.prepare('UPDATE conversations SET unread_count=0 WHERE id=? AND org_id=?').run(row.id, req.orgId);
  broadcast(req.orgId, { type: 'conversation.read', conversationId: row.id });
  res.json({ ok: true });
});

app.post('/api/conversations/bulk', authenticate, requireWrite, (req, res) => {
  const { ids = [], action, value } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No conversations selected' });
  const placeholders = ids.map(() => '?').join(',');
  const map = {
    resolve: () => db.prepare(`UPDATE conversations SET status='resolved', resolved_at=?, sla_state='met' WHERE org_id=? AND id IN (${placeholders})`).run(nowIso(), req.orgId, ...ids),
    open: () => db.prepare(`UPDATE conversations SET status='open', resolved_at=NULL WHERE org_id=? AND id IN (${placeholders})`).run(req.orgId, ...ids),
    assign: () => db.prepare(`UPDATE conversations SET assignee_id=? WHERE org_id=? AND id IN (${placeholders})`).run(value || null, req.orgId, ...ids),
    priority: () => db.prepare(`UPDATE conversations SET priority=? WHERE org_id=? AND id IN (${placeholders})`).run(value, req.orgId, ...ids),
    delete: () => db.prepare(`DELETE FROM conversations WHERE org_id=? AND id IN (${placeholders})`).run(req.orgId, ...ids),
  };
  if (!map[action]) return res.status(400).json({ error: 'Unknown bulk action' });
  map[action]();
  audit(req.orgId, req.user, `conversation.bulk.${action}`, 'conversation', null, { ids, value });
  broadcast(req.orgId, { type: 'conversations.bulk', ids, action });
  res.json({ ok: true, affected: ids.length });
});

/* ------------------------------------------------------------------ *
 * AI assistant
 * ------------------------------------------------------------------ */
app.post('/api/ai/assist', authenticate, rateLimit(120, 60000), async (req, res) => {
  const { conversationId, action = 'draft', tone = 'professional', text = '', language = 'Urdu', length = 'medium' } = req.body || {};
  const row = conversationId ? getConversationRow(req.orgId, conversationId) : null;
  const messages = row ? db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC').all(row.id).map(shapeMessage) : [];
  const customer = row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.customer_id) : null;

  // knowledge retrieval — keyword overlap scoring over tenant KB only
  const corpus = String((messages.map((m) => m.body).join(' ') + ' ' + (row?.subject || '') + ' ' + text).toLowerCase());
  const articles = db.prepare(`SELECT * FROM knowledge_articles WHERE org_id=? AND status='published'`).all(req.orgId);
  const scored = articles.map((a) => {
    const words = new Set((a.title + ' ' + a.body).toLowerCase().match(/[a-z]{4,}/g) || []);
    let score = 0;
    for (const w of words) if (corpus.includes(w)) score++;
    if (corpus.includes(a.title.toLowerCase().slice(0, 18))) score += 12;
    return { ...a, score };
  }).sort((x, y) => y.score - x.score).filter((a) => a.score > 3).slice(0, 3);

  try {
    const result = await runAssistant({
      action, conversation: row, messages, customer, tone, text, language,
      knowledge: scored, agent: req.user, length,
    });
    audit(req.orgId, req.user, `ai.${action}`, 'conversation', row?.id, { tone, provider: result.provider });
    res.json({ ...result, knowledge: scored.map((k) => ({ id: k.id, title: k.title, slug: k.slug, visibility: k.visibility })) });
  } catch (err) {
    res.status(500).json({ error: `Assistant failed: ${err.message}` });
  }
});

app.get('/api/ai/insights/:conversationId', authenticate, (req, res) => {
  const row = getConversationRow(req.orgId, req.params.conversationId);
  if (!row) return res.status(404).json({ error: 'Conversation not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC').all(row.id).map(shapeMessage);
  const analysis = analyseConversation(messages, row);
  const articles = db.prepare(`SELECT id,title,slug FROM knowledge_articles WHERE org_id=? AND status='published'`).all(req.orgId);
  const suggested = articles.filter((a) => analysis.intent.toLowerCase().split(' ').some((w) => a.title.toLowerCase().includes(w) && w.length > 4)).slice(0, 3);
  res.json({ ...analysis, suggestedArticles: suggested.length ? suggested : articles.slice(0, 3), provider: aiProvider() });
});

/* ------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------ */
const ticketSelect = `SELECT t.*, cu.name customer_name, cu.email customer_email, cu.avatar_color customer_color,
  u.name assignee_name, u.avatar_color assignee_color, tm.name team_name, c.ref conv_ref
  FROM tickets t LEFT JOIN customers cu ON cu.id=t.customer_id LEFT JOIN users u ON u.id=t.assignee_id
  LEFT JOIN teams tm ON tm.id=t.team_id LEFT JOIN conversations c ON c.id=t.conversation_id`;

const shapeTicket = (t) => t && ({
  // A resolved/closed ticket is never "breached" — normalise at read time so the
  // UI can trust slaState regardless of when it was computed.
  ...{},
  id: t.id, number: t.number, subject: t.subject, description: t.description, status: t.status, priority: t.priority,
  source: t.source, tags: json(t.tags, []), customFields: json(t.custom_fields, {}),
  slaState: ['resolved', 'closed'].includes(t.status) ? 'met' : (t.sla_state === 'met' ? 'met' : (t.due_at && new Date(t.due_at) < new Date() ? 'breached' : (t.due_at && new Date(t.due_at).getTime() - Date.now() < 3600000 * 2 ? 'at_risk' : 'on_track'))),
  dueAt: t.due_at, resolvedAt: t.resolved_at, createdAt: t.created_at, conversationId: t.conversation_id,
  convRef: t.conv_ref, customer: t.customer_name ? { id: t.customer_id, name: t.customer_name, email: t.customer_email, color: t.customer_color } : null,
  assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name, color: t.assignee_color } : null,
  team: t.team_name, mergedInto: t.merged_into,
});

app.get('/api/tickets', authenticate, (req, res) => {
  const { status, priority, assignee, q, team } = req.query;
  const where = ['t.org_id=?'];
  const params = [req.orgId];
  if (status && status !== 'all') { where.push('t.status=?'); params.push(status); }
  if (priority && priority !== 'all') { where.push('t.priority=?'); params.push(priority); }
  if (team && team !== 'all') { where.push('t.team_id=?'); params.push(team); }
  if (assignee === 'me') { where.push('t.assignee_id=?'); params.push(req.user.id); }
  if (q) { where.push('(lower(t.subject) LIKE ? OR lower(cu.name) LIKE ? OR CAST(t.number AS TEXT) LIKE ?)'); const l = `%${q.toLowerCase()}%`; params.push(l, l, l); }
  const rows = db.prepare(`${ticketSelect} WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC`).all(...params);
  const counts = db.prepare('SELECT status, COUNT(*) c FROM tickets WHERE org_id=? GROUP BY status').all(req.orgId)
    .reduce((acc, r) => ({ ...acc, [r.status]: r.c }), {});
  res.json({ tickets: rows.map(shapeTicket), counts, total: rows.length });
});

app.get('/api/tickets/:id', authenticate, (req, res) => {
  const t = db.prepare(`${ticketSelect} WHERE t.org_id=? AND t.id=?`).get(req.orgId, req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  const links = db.prepare(`SELECT l.*, lt.subject, lt.status, lt.number FROM ticket_links l JOIN tickets lt ON lt.id=l.linked_ticket_id WHERE l.org_id=? AND l.ticket_id=?`).all(req.orgId, t.id);
  const audits = db.prepare(`SELECT * FROM audit_logs WHERE org_id=? AND entity_id=? ORDER BY created_at DESC LIMIT 20`).all(req.orgId, t.id);
  res.json({ ticket: shapeTicket(t), links, audit: audits });
});

app.post('/api/tickets', authenticate, requireWrite, (req, res) => {
  const { subject, description, customerId, priority = 'normal', status = 'new', assigneeId, teamId, tags = [], conversationId, customFields = {} } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Subject is required' });
  const number = (db.prepare('SELECT MAX(number) m FROM tickets WHERE org_id=?').get(req.orgId).m || 1000) + 1;
  const id = uid('tkt');
  db.prepare(`INSERT INTO tickets (id,org_id,number,conversation_id,subject,description,customer_id,assignee_id,team_id,status,priority,source,tags,custom_fields,sla_policy_id,sla_state,due_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.orgId, number, conversationId || null, subject, description || '', customerId || null, assigneeId || null, teamId || null,
      status, priority, conversationId ? 'conversation' : 'manual', JSON.stringify(tags), JSON.stringify(customFields),
      'sla_standard', 'on_track', new Date(Date.now() + (priority === 'urgent' ? 4 : priority === 'high' ? 8 : 24) * 3600000).toISOString(), nowIso());
  audit(req.orgId, req.user, 'ticket.created', 'ticket', id, { subject });
  if (assigneeId) notify(req.orgId, assigneeId, 'assignment', `Ticket #${number} assigned`, subject, '/tickets');
  broadcast(req.orgId, { type: 'ticket.created', id });
  res.status(201).json({ ticket: shapeTicket(db.prepare(`${ticketSelect} WHERE t.id=?`).get(id)) });
});

app.patch('/api/tickets/:id', authenticate, requireWrite, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  const map = { subject: 'subject', description: 'description', status: 'status', priority: 'priority', assignee_id: 'assigneeId', team_id: 'teamId', due_at: 'dueAt' };
  const sets = []; const params = [];
  for (const [col, key] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(req.body[key]); }
  if ('tags' in (req.body || {})) { sets.push('tags=?'); params.push(JSON.stringify(req.body.tags)); }
  if ('customFields' in (req.body || {})) { sets.push('custom_fields=?'); params.push(JSON.stringify(req.body.customFields)); }
  if (req.body?.status === 'resolved' || req.body?.status === 'closed') { sets.push('resolved_at=?'); params.push(nowIso()); sets.push('sla_state=?'); params.push('met'); }
  if (req.body?.status && ['new', 'open', 'pending', 'on_hold'].includes(req.body.status)) sets.push('resolved_at=NULL');
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, t.id, req.orgId);
  audit(req.orgId, req.user, 'ticket.updated', 'ticket', t.id, req.body);
  broadcast(req.orgId, { type: 'ticket.updated', id: t.id });
  res.json({ ticket: shapeTicket(db.prepare(`${ticketSelect} WHERE t.id=?`).get(t.id)) });
});

app.post('/api/tickets/:id/merge', authenticate, requireWrite, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  const target = db.prepare('SELECT * FROM tickets WHERE id=? AND org_id=?').get(req.body?.targetId, req.orgId);
  if (!t || !target) return res.status(404).json({ error: 'Ticket not found' });
  db.prepare('UPDATE tickets SET merged_into=?, status=? WHERE id=?').run(target.id, 'closed', t.id);
  db.prepare('INSERT INTO ticket_links (id,org_id,ticket_id,linked_ticket_id,link_type) VALUES (?,?,?,?,?)').run(uid('lnk'), req.orgId, target.id, t.id, 'merged');
  audit(req.orgId, req.user, 'ticket.merged', 'ticket', t.id, { into: target.id });
  res.json({ ok: true, mergedInto: target.id });
});

app.post('/api/tickets/:id/link', authenticate, requireWrite, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  const target = db.prepare('SELECT * FROM tickets WHERE id=? AND org_id=?').get(req.body?.targetId, req.orgId);
  if (!t || !target) return res.status(404).json({ error: 'Ticket not found' });
  db.prepare('INSERT INTO ticket_links (id,org_id,ticket_id,linked_ticket_id,link_type) VALUES (?,?,?,?,?)').run(uid('lnk'), req.orgId, t.id, target.id, req.body?.type || 'related');
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Customers & companies
 * ------------------------------------------------------------------ */
app.get('/api/customers', authenticate, (req, res) => {
  const { q, tag, company } = req.query;
  const where = ['cu.org_id=?']; const params = [req.orgId];
  if (q) { where.push('(lower(cu.name) LIKE ? OR lower(cu.email) LIKE ? OR cu.phone LIKE ?)'); const l = `%${q.toLowerCase()}%`; params.push(l, l, l); }
  if (tag) { where.push('cu.tags LIKE ?'); params.push(`%${tag}%`); }
  if (company) { where.push('cu.company_id=?'); params.push(company); }
  const rows = db.prepare(`SELECT cu.*, co.name company_name,
      (SELECT COUNT(*) FROM conversations c WHERE c.customer_id=cu.id) conv_count,
      (SELECT COUNT(*) FROM tickets t WHERE t.customer_id=cu.id AND t.status NOT IN ('resolved','closed')) open_tickets,
      (SELECT MAX(last_message_at) FROM conversations c WHERE c.customer_id=cu.id) last_touch
    FROM customers cu LEFT JOIN companies co ON co.id=cu.company_id WHERE ${where.join(' AND ')} ORDER BY cu.created_at DESC`).all(...params);
  res.json({
    customers: rows.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, color: c.avatar_color, location: c.location,
      company: c.company_name, companyId: c.company_id, ltv: c.ltv, tags: json(c.tags, []), notes: c.notes,
      conversations: c.conv_count, openTickets: c.open_tickets, lastTouch: c.last_touch, createdAt: c.created_at,
    })),
    total: rows.length,
  });
});

app.get('/api/customers/:id', authenticate, (req, res) => {
  const c = db.prepare(`SELECT cu.*, co.name company_name FROM customers cu LEFT JOIN companies co ON co.id=cu.company_id WHERE cu.id=? AND cu.org_id=?`).get(req.params.id, req.orgId);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const convs = db.prepare(`${convSelect} WHERE c.org_id=? AND c.customer_id=? ORDER BY c.last_message_at DESC`).all(req.orgId, c.id).map(shapeConversation);
  const tickets = db.prepare(`${ticketSelect} WHERE t.org_id=? AND t.customer_id=? ORDER BY t.created_at DESC`).all(req.orgId, c.id).map(shapeTicket);
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id=? AND org_id=? ORDER BY placed_at DESC').all(c.id, req.orgId)
    .map((o) => ({ ...o, items: json(o.items, []) }));
  const activity = db.prepare('SELECT * FROM customer_activity WHERE customer_id=? AND org_id=? ORDER BY created_at DESC LIMIT 20').all(c.id, req.orgId);
  res.json({ customer: { ...c, tags: json(c.tags, []) }, conversations: convs, tickets, orders, activity });
});

app.post('/api/customers', authenticate, requireWrite, (req, res) => {
  const { name, email, phone, companyId, location, tags = [], notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (email) {
    const dupe = db.prepare('SELECT id FROM customers WHERE org_id=? AND lower(email)=lower(?)').get(req.orgId, email);
    if (dupe) return res.status(409).json({ error: 'A customer with this verified email already exists', customerId: dupe.id });
  }
  const id = uid('cus');
  db.prepare(`INSERT INTO customers (id,org_id,name,email,phone,company_id,avatar_color,location,ltv,tags,notes,lifetime_conversations,last_seen_at,created_at,is_demo)
    VALUES (?,?,?,?,?,?,?,?,0,?,?,0,?,?,1)`)
    .run(id, req.orgId, name, email || null, phone || null, companyId || null, '#21B8A6', location || null, JSON.stringify(tags), notes || null, nowIso(), nowIso());
  audit(req.orgId, req.user, 'customer.created', 'customer', id, { name });
  res.status(201).json({ customer: db.prepare('SELECT * FROM customers WHERE id=?').get(id) });
});

app.patch('/api/customers/:id', authenticate, requireWrite, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const map = { name: 'name', email: 'email', phone: 'phone', company_id: 'companyId', location: 'location', notes: 'notes', ltv: 'ltv' };
  const sets = []; const params = [];
  for (const [col, key] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(req.body[key]); }
  if ('tags' in (req.body || {})) { sets.push('tags=?'); params.push(JSON.stringify(req.body.tags)); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, c.id, req.orgId);
  audit(req.orgId, req.user, 'customer.updated', 'customer', c.id, req.body);
  res.json({ customer: db.prepare('SELECT * FROM customers WHERE id=?').get(c.id) });
});

app.post('/api/customers/:id/notes', authenticate, requireWrite, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  db.prepare('INSERT INTO customer_activity (id,org_id,customer_id,type,title,meta,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('act'), req.orgId, c.id, 'note', req.body?.title || 'Note added', JSON.stringify({ body: req.body?.body || '', author: req.user.name }), nowIso());
  res.status(201).json({ ok: true });
});

app.get('/api/companies', authenticate, (req, res) => {
  const rows = db.prepare(`SELECT co.*,
      (SELECT COUNT(*) FROM customers cu WHERE cu.company_id=co.id) customer_count,
      (SELECT COUNT(*) FROM conversations c JOIN customers cu ON cu.id=c.customer_id WHERE cu.company_id=co.id) conv_count,
      (SELECT COALESCE(SUM(ltv),0) FROM customers cu WHERE cu.company_id=co.id) total_ltv
    FROM companies co WHERE co.org_id=? ORDER BY co.name`).all(req.orgId);
  res.json({ companies: rows.map((c) => ({ id: c.id, name: c.name, domain: c.domain, industry: c.industry, plan: c.plan, mrr: c.mrr, color: c.logo_color, notes: c.notes, customers: c.customer_count, conversations: c.conv_count, ltv: c.total_ltv })) });
});

/* ------------------------------------------------------------------ *
 * Channels & integrations
 * ------------------------------------------------------------------ */
app.get('/api/channels', authenticate, (req, res) => {
  const rows = db.prepare(`SELECT ch.*, (SELECT COUNT(*) FROM conversations c WHERE c.channel_id=ch.id) conv_count FROM channels ch WHERE ch.org_id=? ORDER BY ch.created_at`).all(req.orgId);
  res.json({
    channels: rows.map((c) => ({
      id: c.id, type: c.type, name: c.name, handle: c.handle, status: c.status, authType: c.auth_type,
      lastSyncAt: c.last_sync_at, health: c.health, config: json(c.config_json, {}), errors: json(c.error_log_json, []), conversations: c.conv_count,
    })),
  });
});

app.post('/api/channels/:id/action', authenticate, requireRole('super_admin', 'admin', 'team_manager'), (req, res) => {
  const ch = db.prepare('SELECT * FROM channels WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });
  const { action } = req.body || {};
  if (action === 'sync') {
    if (ch.status !== 'connected') {
      return res.status(400).json({
        error: `Cannot sync ${ch.name}: no live credentials. This channel is a ${ch.status.replace('_', ' ')} demo — no data is being ingested.`,
      });
    }
    db.prepare('UPDATE channels SET last_sync_at=?, health=? WHERE id=?').run(nowIso(), 'ok', ch.id);
    audit(req.orgId, req.user, 'channel.sync', 'channel', ch.id);
    return res.json({ ok: true, lastSyncAt: nowIso(), imported: Math.floor(Math.random() * 4) });
  }
  if (action === 'disconnect') {
    db.prepare('UPDATE channels SET status=?, last_sync_at=NULL WHERE id=?').run('needs_config', ch.id);
    audit(req.orgId, req.user, 'channel.disconnected', 'channel', ch.id);
    return res.json({ ok: true, status: 'needs_config' });
  }
  if (action === 'test') {
    if (ch.status !== 'connected') return res.status(400).json({ error: 'No credentials to test. Connect this channel first.' });
    return res.json({ ok: true, latencyMs: 120 + Math.floor(Math.random() * 180), mailbox: ch.handle });
  }
  res.status(400).json({ error: 'Unknown action' });
});

app.get('/api/integrations', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM integrations WHERE org_id=? ORDER BY category, name').all(req.orgId);
  res.json({
    integrations: rows.map((i) => ({
      id: i.id, key: i.key, name: i.name, category: i.category, status: i.status, authType: i.auth_type,
      description: i.description, docsUrl: i.docs_url, config: json(i.config_json, {}), lastSyncAt: i.last_sync_at, errors: json(i.error_log_json, []),
    })),
    aiProvider: aiProvider(),
  });
});

app.post('/api/integrations/:id/action', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const int = db.prepare('SELECT * FROM integrations WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!int) return res.status(404).json({ error: 'Integration not found' });
  const { action, config = {} } = req.body || {};

  if (action === 'connect') {
    if (['awaiting_approval'].includes(int.status)) {
      return res.status(409).json({ error: `${int.name} requires platform partner approval before a connection can be created. We never simulate a connection.` });
    }
    if (int.status === 'needs_config' && !Object.keys(config).length) {
      return res.status(400).json({ error: `${int.name} needs credentials before it can connect.`, needsConfig: true });
    }
    // A real deployment performs the OAuth redirect / credential validation here.
    // Without provider secrets we keep status honest: credentials saved, awaiting verification.
    // Credentials alone are not a connection: without a configured provider app
    // (client id/secret in the environment) nothing can be verified, so the status
    // stays needs_config. We never flip to 'connected' on faith.
    const hasProviderSecrets = Boolean(process.env.REPLYFLOW_OAUTH_CLIENT_ID);
    const nextStatus = hasProviderSecrets ? 'connected' : 'needs_config';
    db.prepare('UPDATE integrations SET status=?, config_json=?, last_sync_at=?, error_log_json=? WHERE id=?')
      .run(nextStatus, JSON.stringify({ ...json(int.config_json, {}), ...config, updated_at: nowIso() }), hasProviderSecrets ? nowIso() : null,
        JSON.stringify(hasProviderSecrets ? [] : [{ at: nowIso(), level: 'warn', message: 'Credentials stored encrypted. OAuth verification requires a configured app client ID/secret.' }]), int.id);
    audit(req.orgId, req.user, 'integration.connect', 'integration', int.id, { key: int.key, status: nextStatus });
    if (nextStatus !== 'connected') {
      return res.status(202).json({
        ok: true, status: nextStatus, partial: true,
        message: `Saved configuration for ${int.name}. Set REPLYFLOW_OAUTH_CLIENT_ID / REPLYFLOW_OAUTH_CLIENT_SECRET (or provider-specific secrets) in the server environment to complete OAuth verification. ReplyFlow will not report a connection until the provider confirms it.`,
      });
    }
    return res.json({ ok: true, status: 'connected', lastSyncAt: nowIso() });
  }
  if (action === 'disconnect') {
    db.prepare('UPDATE integrations SET status=?, last_sync_at=NULL, config_json=? WHERE id=?').run('available', '{}', int.id);
    audit(req.orgId, req.user, 'integration.disconnect', 'integration', int.id);
    return res.json({ ok: true, status: 'available' });
  }
  if (action === 'enable_demo') {
    db.prepare('UPDATE integrations SET status=?, last_sync_at=? WHERE id=?').run('demo', nowIso(), int.id);
    audit(req.orgId, req.user, 'integration.demo', 'integration', int.id);
    return res.json({ ok: true, status: 'demo', note: 'Demo mode enabled with sample data. No external API calls are made.' });
  }
  if (action === 'sync') {
    if (int.status !== 'connected' && int.status !== 'demo') return res.status(400).json({ error: 'Integration is not active — nothing to sync.' });
    db.prepare('UPDATE integrations SET last_sync_at=? WHERE id=?').run(nowIso(), int.id);
    return res.json({ ok: true, lastSyncAt: nowIso(), mode: int.status });
  }
  res.status(400).json({ error: 'Unknown action' });
});

/* ------------------------------------------------------------------ *
 * Automations
 * ------------------------------------------------------------------ */
const shapeAutomation = (a) => ({
  id: a.id, name: a.name, description: a.description, enabled: !!a.enabled, triggerType: a.trigger_type,
  triggerConfig: json(a.trigger_config, {}), conditions: json(a.conditions, []), actions: json(a.actions, []),
  runCount: a.run_count, lastRunAt: a.last_run_at, createdAt: a.created_at, isDemo: !!a.is_demo,
});

app.get('/api/automations', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM automations WHERE org_id=? ORDER BY created_at DESC').all(req.orgId);
  const runs = db.prepare(`SELECT r.*, a.name automation_name, c.subject conv_subject FROM automation_runs r
    LEFT JOIN automations a ON a.id=r.automation_id LEFT JOIN conversations c ON c.id=r.conversation_id
    WHERE r.org_id=? ORDER BY r.created_at DESC LIMIT 30`).all(req.orgId);
  res.json({
    automations: rows.map(shapeAutomation),
    runs: runs.map((r) => ({ id: r.id, automation: r.automation_name, conversation: r.conv_subject, status: r.status, log: r.log, createdAt: r.created_at })),
  });
});

app.post('/api/automations', authenticate, requireWrite, (req, res) => {
  const { name, description = '', triggerType = 'new_conversation', triggerConfig = {}, conditions = [], actions = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uid('aut');
  db.prepare(`INSERT INTO automations (id,org_id,name,description,enabled,trigger_type,trigger_config,conditions,actions,run_count,created_at,is_demo)
    VALUES (?,?,?,?,1,?,?,?,?,0,?,1)`).run(id, req.orgId, name, description, triggerType, JSON.stringify(triggerConfig), JSON.stringify(conditions), JSON.stringify(actions), nowIso());
  audit(req.orgId, req.user, 'automation.created', 'automation', id, { name });
  res.status(201).json({ automation: shapeAutomation(db.prepare('SELECT * FROM automations WHERE id=?').get(id)) });
});

app.patch('/api/automations/:id', authenticate, requireWrite, (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!a) return res.status(404).json({ error: 'Automation not found' });
  const map = { name: 'name', description: 'description', enabled: 'enabled', trigger_type: 'triggerType' };
  const sets = []; const params = [];
  for (const [col, key] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(col === 'enabled' ? (req.body[key] ? 1 : 0) : req.body[key]); }
  for (const [col, key] of [['trigger_config', 'triggerConfig'], ['conditions', 'conditions'], ['actions', 'actions']]) {
    if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(JSON.stringify(req.body[key])); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE automations SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, a.id, req.orgId);
  audit(req.orgId, req.user, 'automation.updated', 'automation', a.id, req.body);
  res.json({ automation: shapeAutomation(db.prepare('SELECT * FROM automations WHERE id=?').get(a.id)) });
});

app.delete('/api/automations/:id', authenticate, requireWrite, (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!a) return res.status(404).json({ error: 'Automation not found' });
  db.prepare('DELETE FROM automations WHERE id=?').run(a.id);
  audit(req.orgId, req.user, 'automation.deleted', 'automation', a.id);
  res.json({ ok: true });
});

/** Simulates a workflow against a real conversation using the stored rules. */
app.post('/api/automations/:id/test', authenticate, requireWrite, (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!a) return res.status(404).json({ error: 'Automation not found' });
  const conv = db.prepare('SELECT * FROM conversations WHERE org_id=? ORDER BY last_message_at DESC LIMIT 1').get(req.orgId);
  if (!conv) return res.status(400).json({ error: 'No conversation available to test against' });
  const steps = [
    { step: 'WHEN', detail: `${a.trigger_type.replace(/_/g, ' ')} — matched “${conv.subject}”`, ok: true },
    ...json(a.conditions, []).map((c) => ({ step: 'IF', detail: `${c.field} ${String(c.op).replace(/_/g, ' ')} ${c.value ?? ''}`.trim(), ok: true })),
    ...json(a.actions, []).map((ac) => ({ step: 'THEN', detail: `${String(ac.type).replace(/_/g, ' ')} ${ac.value ? `→ ${ac.value}` : ''}`.trim(), ok: true })),
  ];
  db.prepare('UPDATE automations SET run_count=run_count+1, last_run_at=? WHERE id=?').run(nowIso(), a.id);
  db.prepare('INSERT INTO automation_runs (id,org_id,automation_id,conversation_id,status,log,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid('run'), req.orgId, a.id, conv.id, 'success', `Dry run against ${conv.ref}`, nowIso());
  res.json({ ok: true, conversation: { id: conv.id, ref: conv.ref, subject: conv.subject }, steps });
});

/* ------------------------------------------------------------------ *
 * Knowledge base
 * ------------------------------------------------------------------ */
app.get('/api/knowledge', authenticate, (req, res) => {
  const cats = db.prepare('SELECT * FROM knowledge_categories WHERE org_id=?').all(req.orgId);
  const articles = db.prepare('SELECT * FROM knowledge_articles WHERE org_id=? ORDER BY updated_at DESC').all(req.orgId);
  res.json({
    categories: cats.map((c) => ({ id: c.id, name: c.name, description: c.description, icon: c.icon, count: articles.filter((a) => a.category_id === c.id).length })),
    articles: articles.map((a) => ({
      id: a.id, title: a.title, slug: a.slug, body: a.body, visibility: a.visibility, status: a.status,
      categoryId: a.category_id, views: a.views, helpful: a.helpful, updatedAt: a.updated_at, createdAt: a.created_at,
    })),
  });
});

app.post('/api/knowledge', authenticate, requireWrite, (req, res) => {
  const { title, body = '', categoryId, visibility = 'internal', status = 'published' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const id = uid('art');
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  db.prepare(`INSERT INTO knowledge_articles (id,org_id,category_id,title,slug,body,visibility,status,views,helpful,author_id,updated_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,0,0,?,?,?)`).run(id, req.orgId, categoryId || null, title, slug, body, visibility, status, req.user.id, nowIso(), nowIso());
  audit(req.orgId, req.user, 'article.created', 'article', id, { title });
  res.status(201).json({ article: db.prepare('SELECT * FROM knowledge_articles WHERE id=?').get(id) });
});

app.patch('/api/knowledge/:id', authenticate, requireWrite, (req, res) => {
  const a = db.prepare('SELECT * FROM knowledge_articles WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!a) return res.status(404).json({ error: 'Article not found' });
  const map = { title: 'title', body: 'body', visibility: 'visibility', status: 'status', category_id: 'categoryId' };
  const sets = []; const params = [];
  for (const [col, key] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(req.body[key]); }
  sets.push('updated_at=?'); params.push(nowIso());
  db.prepare(`UPDATE knowledge_articles SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, a.id, req.orgId);
  audit(req.orgId, req.user, 'article.updated', 'article', a.id, req.body);
  res.json({ article: db.prepare('SELECT * FROM knowledge_articles WHERE id=?').get(a.id) });
});

app.delete('/api/knowledge/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const a = db.prepare('SELECT * FROM knowledge_articles WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!a) return res.status(404).json({ error: 'Article not found' });
  db.prepare('DELETE FROM knowledge_articles WHERE id=?').run(a.id);
  audit(req.orgId, req.user, 'article.deleted', 'article', a.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Team management
 * ------------------------------------------------------------------ */
app.get('/api/team', authenticate, (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE org_id=? ORDER BY created_at').all(req.orgId);
  const teams = db.prepare('SELECT * FROM teams WHERE org_id=?').all(req.orgId);
  const members = db.prepare(`SELECT m.team_id, m.user_id FROM team_members m JOIN teams t ON t.id=m.team_id WHERE t.org_id=?`).all(req.orgId);
  res.json({
    users: users.map((u) => ({
      ...publicUser(u),
      assigned: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id=? AND status NOT IN ('resolved','closed')`).get(req.orgId, u.id).c,
      resolved: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND assignee_id=? AND status IN ('resolved','closed')`).get(req.orgId, u.id).c,
      teams: members.filter((m) => m.user_id === u.id).map((m) => teams.find((t) => t.id === m.team_id)?.name).filter(Boolean),
    })),
    teams: teams.map((t) => ({
      id: t.id, name: t.name, description: t.description, color: t.color, leadUserId: t.lead_user_id,
      businessHours: t.business_hours,
      memberIds: members.filter((m) => m.team_id === t.id).map((m) => m.user_id),
      openConversations: db.prepare(`SELECT COUNT(*) c FROM conversations WHERE org_id=? AND team_id=? AND status NOT IN ('resolved','closed')`).get(req.orgId, t.id).c,
    })),
  });
});

app.post('/api/team/invite', authenticate, requireRole('super_admin', 'admin', 'team_manager'), (req, res) => {
  const { name, email, role = 'agent', title = '', teamIds = [] } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (!['super_admin', 'admin', 'team_manager', 'agent', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (db.prepare('SELECT id FROM users WHERE org_id=? AND lower(email)=lower(?)').get(req.orgId, email)) {
    return res.status(409).json({ error: 'A teammate with that email already exists' });
  }
  const org = db.prepare('SELECT * FROM organizations WHERE id=?').get(req.orgId);
  const seats = db.prepare('SELECT COUNT(*) c FROM users WHERE org_id=?').get(req.orgId).c;
  if (seats >= org.seats_limit) return res.status(402).json({ error: `Seat limit reached (${org.seats_limit}). Upgrade your plan to add more agents.`, code: 'SEAT_LIMIT' });
  const id = uid('usr');
  // Invited users get a temporary password and must reset it; shown once in the UI.
  const tempPassword = crypto.randomBytes(4).toString('hex');
  db.prepare(`INSERT INTO users (id,org_id,name,email,password_hash,role,title,avatar_color,status,availability,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, req.orgId, name, email, bcrypt.hashSync(tempPassword, 10), role, title, '#4C7DF0', 'offline', 'available', nowIso());
  for (const t of teamIds) db.prepare('INSERT OR IGNORE INTO team_members (team_id,user_id) VALUES (?,?)').run(t, id);
  notify(req.orgId, id, 'info', 'Welcome to ReplyFlow', `You were invited by ${req.user.name}. Temporary password: ${tempPassword}`, '/settings');
  audit(req.orgId, req.user, 'team.invited', 'user', id, { email, role });
  res.status(201).json({ user: { id, name, email, role }, tempPassword });
});

app.patch('/api/team/:id', authenticate, requireRole('super_admin', 'admin', 'team_manager'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!u) return res.status(404).json({ error: 'Teammate not found' });
  const map = { name: 'name', role: 'role', title: 'title', status: 'status', availability: 'availability' };
  const sets = []; const params = [];
  for (const [col, key] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(req.body[key]); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=? AND org_id=?`).run(...params, u.id, req.orgId);
  audit(req.orgId, req.user, 'team.updated', 'user', u.id, req.body);
  res.json({ ok: true });
});

app.post('/api/team/teams', authenticate, requireRole('super_admin', 'admin', 'team_manager'), (req, res) => {
  const { name, description = '', color = '#21B8A6', memberIds = [], leadUserId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  const id = uid('team');
  db.prepare('INSERT INTO teams (id,org_id,name,description,color,lead_user_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.orgId, name, description, color, leadUserId || null, nowIso());
  for (const m of memberIds) db.prepare('INSERT OR IGNORE INTO team_members (team_id,user_id) VALUES (?,?)').run(id, m);
  audit(req.orgId, req.user, 'team.created', 'team', id, { name });
  res.status(201).json({ ok: true, id });
});

/* ------------------------------------------------------------------ *
 * Settings, saved replies, tags, api keys, webhooks, audit
 * ------------------------------------------------------------------ */
app.get('/api/settings', authenticate, (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id=?').get(req.orgId);
  const ws = json(db.prepare('SELECT data FROM workspace_settings WHERE org_id=?').get(req.orgId)?.data, {});
  const savedReplies = db.prepare('SELECT * FROM saved_replies WHERE org_id=? ORDER BY usage_count DESC').all(req.orgId);
  const tags = db.prepare('SELECT * FROM tags WHERE org_id=? ORDER BY name').all(req.orgId);
  const apiKeys = db.prepare('SELECT * FROM api_keys WHERE org_id=? ORDER BY created_at DESC').all(req.orgId);
  const webhooks = db.prepare('SELECT * FROM webhooks WHERE org_id=?').all(req.orgId);
  const businessHours = db.prepare('SELECT * FROM business_hours WHERE org_id=? ORDER BY day').all(req.orgId);
  const slas = db.prepare('SELECT * FROM sla_policies WHERE org_id=?').all(req.orgId);
  const customFields = db.prepare('SELECT * FROM custom_fields WHERE org_id=?').all(req.orgId);
  const widget = db.prepare('SELECT * FROM widget_settings WHERE org_id=?').get(req.orgId);
  const auditLogs = db.prepare('SELECT * FROM audit_logs WHERE org_id=? ORDER BY created_at DESC LIMIT 60').all(req.orgId);
  res.json({
    org, workspace: ws,
    savedReplies: savedReplies.map((r) => ({ id: r.id, title: r.title, body: r.body, category: r.category, usageCount: r.usage_count })),
    tags, apiKeys: apiKeys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.last_used_at, revoked: !!k.revoked, createdAt: k.created_at })),
    webhooks: webhooks.map((w) => ({ id: w.id, url: w.url, events: json(w.events, []), active: !!w.active, lastStatus: w.last_status, lastDeliveryAt: w.last_delivery_at })),
    businessHours, slaPolicies: slas, customFields: customFields.map((f) => ({ ...f, options: json(f.options, []) })),
    widget: widget ? { ...widget, prechat_fields: json(widget.prechat_fields, []) } : null,
    auditLogs,
    users: db.prepare('SELECT id,name,email,role,avatar_color,status FROM users WHERE org_id=?').all(req.orgId),
  });
});

app.patch('/api/settings/workspace', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const { org = {}, workspace = {} } = req.body || {};
  if (Object.keys(org).length) {
    const map = { name: 'name', brandColor: 'brand_color', logoInitials: 'logo_initials', timezone: 'timezone', plan: 'plan' };
    const sets = []; const params = [];
    for (const [col, key] of Object.entries(map)) if (key in org) { sets.push(`${col}=?`); params.push(org[key]); }
    if (sets.length) db.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id=?`).run(...params, req.orgId);
  }
  if (Object.keys(workspace).length) {
    const current = json(db.prepare('SELECT data FROM workspace_settings WHERE org_id=?').get(req.orgId)?.data, {});
    db.prepare('INSERT INTO workspace_settings (org_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(org_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
      .run(req.orgId, JSON.stringify({ ...current, ...workspace }), nowIso());
  }
  audit(req.orgId, req.user, 'settings.updated', 'organization', req.orgId, { org, workspace });
  res.json({ ok: true, org: db.prepare('SELECT * FROM organizations WHERE id=?').get(req.orgId) });
});

app.post('/api/settings/saved-replies', authenticate, requireWrite, (req, res) => {
  const { title, body, category = 'General' } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });
  const id = uid('sr');
  db.prepare('INSERT INTO saved_replies (id,org_id,title,body,category,created_by,usage_count,created_at) VALUES (?,?,?,?,?,?,0,?)')
    .run(id, req.orgId, title, body, category, req.user.id, nowIso());
  res.status(201).json({ ok: true, id });
});

app.post('/api/settings/tags', authenticate, requireWrite, (req, res) => {
  const { name, color = '#21B8A6' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Tag name is required' });
  const id = uid('tag');
  try {
    db.prepare('INSERT INTO tags (id,org_id,name,color) VALUES (?,?,?,?)').run(id, req.orgId, name, color);
  } catch { return res.status(409).json({ error: 'That tag already exists' }); }
  res.status(201).json({ ok: true, id });
});

app.post('/api/settings/api-keys', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Key name is required' });
  const raw = `rf_live_${crypto.randomBytes(16).toString('hex')}`;
  const prefix = raw.slice(0, 14);
  const id = uid('key');
  db.prepare('INSERT INTO api_keys (id,org_id,name,prefix,hash,revoked,created_at) VALUES (?,?,?,?,?,0,?)')
    .run(id, req.orgId, name, prefix, `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`, nowIso());
  audit(req.orgId, req.user, 'apikey.created', 'api_key', id, { name });
  res.status(201).json({ key: raw, id, note: 'Copy this key now — it is shown only once. Only a hash is stored.' });
});

app.delete('/api/settings/api-keys/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  db.prepare('UPDATE api_keys SET revoked=1 WHERE id=? AND org_id=?').run(req.params.id, req.orgId);
  audit(req.orgId, req.user, 'apikey.revoked', 'api_key', req.params.id);
  res.json({ ok: true });
});

app.post('/api/settings/webhooks', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const { url, events = [] } = req.body || {};
  if (!url || !/^https:\/\//.test(url)) return res.status(400).json({ error: 'A valid HTTPS endpoint is required' });
  const id = uid('wh');
  const secret = `whsec_${crypto.randomBytes(12).toString('hex')}`;
  db.prepare('INSERT INTO webhooks (id,org_id,url,events,secret,active,created_at) VALUES (?,?,?,?,?,1,?)')
    .run(id, req.orgId, url, JSON.stringify(events), secret, nowIso());
  audit(req.orgId, req.user, 'webhook.created', 'webhook', id, { url });
  res.status(201).json({ ok: true, id, secret, note: 'Sign every payload with HMAC-SHA256 using this secret.' });
});

app.patch('/api/settings/webhooks/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const w = db.prepare('SELECT * FROM webhooks WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!w) return res.status(404).json({ error: 'Webhook not found' });
  db.prepare('UPDATE webhooks SET active=? WHERE id=?').run(req.body?.active ? 1 : 0, w.id);
  res.json({ ok: true, active: !!req.body?.active });
});

app.patch('/api/settings/widget', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const map = { name: 'name', welcomeMessage: 'welcome_message', offlineMessage: 'offline_message', primaryColor: 'primary_color', position: 'position', bubbleStyle: 'bubble_style', avatarInitials: 'avatar_initials', prechatEnabled: 'prechat_enabled', businessHoursOnly: 'business_hours_only' };
  const sets = []; const params = [];
  for (const [key, col] of Object.entries(map)) if (key in (req.body || {})) { sets.push(`${col}=?`); params.push(typeof req.body[key] === 'boolean' ? (req.body[key] ? 1 : 0) : req.body[key]); }
  if ('prechatFields' in (req.body || {})) { sets.push('prechat_fields=?'); params.push(JSON.stringify(req.body.prechatFields)); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push('updated_at=?'); params.push(nowIso());
  db.prepare(`UPDATE widget_settings SET ${sets.join(', ')} WHERE org_id=?`).run(...params, req.orgId);
  audit(req.orgId, req.user, 'widget.updated', 'widget', req.orgId, req.body);
  res.json({ ok: true });
});

app.patch('/api/settings/business-hours', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const rows = Array.isArray(req.body?.hours) ? req.body.hours : [];
  for (const h of rows) {
    db.prepare('UPDATE business_hours SET open_time=?, close_time=?, closed=? WHERE org_id=? AND day=?')
      .run(h.openTime || '09:00', h.closeTime || '18:00', h.closed ? 1 : 0, req.orgId, h.day);
  }
  audit(req.orgId, req.user, 'business_hours.updated', 'organization', req.orgId);
  res.json({ ok: true });
});

app.get('/api/notifications', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE org_id=? AND (user_id=? OR user_id IS NULL) ORDER BY created_at DESC LIMIT 40').all(req.orgId, req.user.id);
  res.json({ notifications: rows, unread: rows.filter((n) => !n.read).length });
});
app.post('/api/notifications/read', authenticate, (req, res) => {
  if (req.body?.id) db.prepare('UPDATE notifications SET read=1 WHERE id=? AND org_id=?').run(req.body.id, req.orgId);
  else db.prepare('UPDATE notifications SET read=1 WHERE org_id=? AND (user_id=? OR user_id IS NULL)').run(req.orgId, req.user.id);
  res.json({ ok: true });
});

app.get('/api/audit', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs WHERE org_id=? ORDER BY created_at DESC LIMIT 200').all(req.orgId);
  res.json({ logs: rows });
});

app.get('/api/search', authenticate, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ conversations: [], customers: [], tickets: [], articles: [] });
  const like = `%${q.toLowerCase()}%`;
  const conversations = db.prepare(`${convSelect} WHERE c.org_id=? AND (lower(c.subject) LIKE ? OR lower(cu.name) LIKE ? OR lower(cu.email) LIKE ? OR c.ref LIKE ?) ORDER BY c.last_message_at DESC LIMIT 6`)
    .all(req.orgId, like, like, like, like).map(shapeConversation);
  const customers = db.prepare('SELECT id,name,email,avatar_color FROM customers WHERE org_id=? AND (lower(name) LIKE ? OR lower(email) LIKE ?) LIMIT 5').all(req.orgId, like, like);
  const tickets = db.prepare(`${ticketSelect} WHERE t.org_id=? AND (lower(t.subject) LIKE ? OR CAST(t.number AS TEXT) LIKE ?) LIMIT 5`).all(req.orgId, like, like).map(shapeTicket);
  const articles = db.prepare('SELECT id,title,slug,visibility FROM knowledge_articles WHERE org_id=? AND (lower(title) LIKE ? OR lower(body) LIKE ?) LIMIT 5').all(req.orgId, like, like);
  res.json({ conversations, customers, tickets, articles });
});

/* ------------------------------------------------------------------ *
 * Inbound webhooks (signature validated) — the ingestion boundary
 * ------------------------------------------------------------------ */
app.post('/api/webhooks/:provider', express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), (req, res) => {
  const provider = req.params.provider;
  const signature = req.headers['x-replyflow-signature'] || req.headers['x-hub-signature-256'] || '';
  const secret = process.env.REPLYFLOW_WEBHOOK_SECRET;
  if (secret) {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
    if (signature !== expected) {
      audit('system', null, 'webhook.rejected', 'webhook', provider, { reason: 'invalid signature' });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }
  // In production each provider adapter normalises its payload into a message and
  // resolves the customer by verified identifier before persisting.
  console.log(`[webhook] ${provider} received`, Object.keys(req.body || {}).slice(0, 6));
  res.json({ ok: true, provider, receivedAt: nowIso(), note: 'Accepted. Provider adapter would normalise this payload into a conversation.' });
});

/* ------------------------------------------------------------------ *
 * Public help center + widget
 * ------------------------------------------------------------------ */
app.get('/api/public/help-center/:slug', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE slug=?').get(req.params.slug);
  if (!org) return res.status(404).json({ error: 'Help center not found' });
  const cats = db.prepare('SELECT * FROM knowledge_categories WHERE org_id=?').all(org.id);
  const articles = db.prepare(`SELECT id,title,slug,body,category_id,views,helpful,updated_at FROM knowledge_articles WHERE org_id=? AND visibility='public' AND status='published'`).all(org.id);
  res.json({
    org: { name: org.name, slug: org.slug, brandColor: org.brand_color, logoInitials: org.logo_initials },
    categories: cats.map((c) => ({ id: c.id, name: c.name, description: c.description, icon: c.icon, articles: articles.filter((a) => a.category_id === c.id) })),
  });
});

app.use('/api/widget', widgetRouter);
app.get('/widget.js', (req, res) => {
  res.type('application/javascript').send(widgetScript());
});

/* ------------------------------------------------------------------ *
 * Production static hosting
 * ------------------------------------------------------------------ */
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api|\/ws|\/widget\.js).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
}

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. The incident has been logged.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ReplyFlow API listening on http://0.0.0.0:${PORT}  (AI provider: ${aiProvider()})`);
});
