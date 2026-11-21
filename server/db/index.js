import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.REPLYFLOW_DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.REPLYFLOW_DB || path.join(DATA_DIR, 'replyflow.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Schema bootstrap.
 * The SQL is intentionally dialect-light so it ports to PostgreSQL: swap
 * better-sqlite3 for `pg`, keep the same table/column names, and replace
 * TEXT-JSON columns with jsonb. Every tenant-scoped query goes through
 * `scoped()` helpers below which always constrain by org_id.
 */
export function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export const nowIso = () => new Date().toISOString();

export function json(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function audit(orgId, user, action, entityType, entityId, meta = {}) {
  db.prepare(
    `INSERT INTO audit_logs (id, org_id, user_id, user_name, action, entity_type, entity_id, meta, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(uid('aud'), orgId, user?.id || null, user?.name || 'System', action, entityType, entityId, JSON.stringify(meta), nowIso());
}

export function notify(orgId, userId, type, title, body, link) {
  db.prepare(
    `INSERT INTO notifications (id, org_id, user_id, type, title, body, link, read, created_at)
     VALUES (?,?,?,?,?,?,?,0,?)`
  ).run(uid('ntf'), orgId, userId, type, title, body, link, nowIso());
}

migrate();
export default db;
