-- ReplyFlow — normalized, multi-tenant schema (SQLite dialect; see server/db/index.js for Postgres notes)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'growth',
  brand_color TEXT NOT NULL DEFAULT '#21B8A6',
  logo_initials TEXT,
  timezone TEXT DEFAULT 'Asia/Karachi',
  seats_limit INTEGER DEFAULT 25,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'agent', -- super_admin | admin | team_manager | agent | readonly
  title TEXT,
  avatar_color TEXT DEFAULT '#21B8A6',
  status TEXT NOT NULL DEFAULT 'offline', -- online | away | offline
  availability TEXT DEFAULT 'available',
  last_active_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(org_id, email)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#21B8A6',
  lead_user_id TEXT,
  business_hours TEXT DEFAULT 'Mon–Fri, 9:00–18:00',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  plan TEXT,
  mrr REAL DEFAULT 0,
  logo_color TEXT DEFAULT '#142D46',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  external_id TEXT,
  avatar_color TEXT DEFAULT '#21B8A6',
  location TEXT,
  ltv REAL DEFAULT 0,
  tags TEXT DEFAULT '[]',
  notes TEXT,
  lifetime_conversations INTEGER DEFAULT 0,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  is_demo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_identity ON customers(org_id, email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- email | chat | whatsapp | instagram | messenger | telegram | slack | amazon | ebay | etsy | walmart | shopify | woocommerce | tiktok | aliexpress
  name TEXT NOT NULL,
  handle TEXT,
  status TEXT NOT NULL DEFAULT 'demo', -- connected | demo | needs_config | awaiting_approval | error
  auth_type TEXT DEFAULT 'oauth',
  last_sync_at TEXT,
  health TEXT DEFAULT 'ok',
  config_json TEXT DEFAULT '{}',
  error_log_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channels_org ON channels(org_id);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- connected | demo | available | awaiting_approval | needs_config | error
  auth_type TEXT DEFAULT 'oauth',
  description TEXT,
  docs_url TEXT,
  config_json TEXT DEFAULT '{}',
  last_sync_at TEXT,
  error_log_json TEXT DEFAULT '[]',
  UNIQUE(org_id, key)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,
  subject TEXT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL DEFAULT 'email',
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- new | open | pending | on_hold | resolved | closed
  priority TEXT NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  tags TEXT DEFAULT '[]',
  unread_count INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  snoozed_until TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  last_message_at TEXT,
  sla_due_at TEXT,
  sla_state TEXT DEFAULT 'on_track', -- on_track | at_risk | breached | met
  sentiment TEXT, -- positive | neutral | negative
  intent TEXT,
  ai_summary TEXT,
  csat INTEGER,
  is_demo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_org_status ON conversations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_assignee ON conversations(assignee_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'inbound', -- inbound | outbound | system
  author_type TEXT NOT NULL DEFAULT 'customer', -- customer | agent | system
  author_user_id TEXT,
  author_customer_id TEXT,
  author_name TEXT,
  body TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'email',
  status TEXT DEFAULT 'delivered', -- pending | sent | delivered | read | failed
  is_internal INTEGER DEFAULT 0,
  attachments_json TEXT DEFAULT '[]',
  meta_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new', -- new | open | pending | on_hold | resolved | closed
  priority TEXT NOT NULL DEFAULT 'normal',
  source TEXT DEFAULT 'email',
  tags TEXT DEFAULT '[]',
  custom_fields TEXT DEFAULT '{}',
  sla_policy_id TEXT,
  sla_state TEXT DEFAULT 'on_track',
  due_at TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  merged_into TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(org_id, number)
);
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(org_id, status);

CREATE TABLE IF NOT EXISTS ticket_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  linked_ticket_id TEXT NOT NULL,
  link_type TEXT DEFAULT 'related'
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  first_response_mins INTEGER NOT NULL,
  resolution_mins INTEGER NOT NULL,
  applies_to TEXT DEFAULT 'all',
  business_hours_only INTEGER DEFAULT 1,
  priority TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#21B8A6',
  UNIQUE(org_id, name)
);

CREATE TABLE IF NOT EXISTS saved_replies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  created_by TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen'
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  category_id TEXT REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'internal', -- public | internal
  status TEXT DEFAULT 'published', -- draft | published
  views INTEGER DEFAULT 0,
  helpful INTEGER DEFAULT 0,
  author_id TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  trigger_type TEXT NOT NULL, -- new_conversation | new_message | sla_breach | status_change | keyword | schedule
  trigger_config TEXT DEFAULT '{}',
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  run_count INTEGER DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  is_demo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  conversation_id TEXT,
  status TEXT DEFAULT 'success', -- success | skipped | failed
  log TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT DEFAULT 'info', -- info | mention | sla | assignment | success | warning
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  meta TEXT DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT 'ticket',
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  options TEXT DEFAULT '[]',
  required INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT,
  last_used_at TEXT,
  revoked INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT DEFAULT '[]',
  secret TEXT,
  active INTEGER DEFAULT 1,
  last_status INTEGER,
  last_delivery_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_activity (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL, -- conversation | order | note | csat | ticket
  title TEXT NOT NULL,
  meta TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  channel_key TEXT DEFAULT 'shopify',
  number TEXT NOT NULL,
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'fulfilled',
  items TEXT DEFAULT '[]',
  placed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS csat_surveys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  conversation_id TEXT,
  customer_id TEXT,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS widget_settings (
  org_id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'ReplyFlow Support',
  welcome_message TEXT DEFAULT 'Hi there 👋 How can we help you today?',
  offline_message TEXT DEFAULT 'We are away right now. Leave your email and we will get back to you.',
  primary_color TEXT DEFAULT '#21B8A6',
  position TEXT DEFAULT 'bottom-right',
  bubble_style TEXT DEFAULT 'round',
  avatar_initials TEXT DEFAULT 'RF',
  prechat_enabled INTEGER DEFAULT 1,
  prechat_fields TEXT DEFAULT '[{"key":"name","label":"Name","required":true},{"key":"email","label":"Email","required":true},{"key":"topic","label":"How can we help?","required":false}]',
  business_hours_only INTEGER DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS business_hours (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  day INTEGER NOT NULL, -- 0=Sunday
  open_time TEXT DEFAULT '09:00',
  close_time TEXT DEFAULT '18:00',
  closed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workspace_settings (
  org_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_visitors (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  page_url TEXT,
  location TEXT,
  browser TEXT,
  conversation_id TEXT,
  created_at TEXT NOT NULL
);
