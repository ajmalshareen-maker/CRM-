import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

export function timeAgo(input?: string | null) {
  if (!input) return '—';
  const d = new Date(input).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(input).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDate(input?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!input) return '—';
  return new Date(input).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(input?: string | null) {
  if (!input) return '—';
  return new Date(input).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function clock(input?: string | null) {
  if (!input) return '';
  return new Date(input).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function duration(mins?: number | null) {
  if (mins == null) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function money(n?: number | null, currency = 'USD') {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function compact(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export const statusMeta: Record<string, { label: string; tone: 'teal' | 'blue' | 'amber' | 'slate' | 'green' | 'red' | 'violet' }> = {
  new: { label: 'New', tone: 'blue' },
  open: { label: 'Open', tone: 'teal' },
  pending: { label: 'Pending', tone: 'amber' },
  on_hold: { label: 'On hold', tone: 'violet' },
  resolved: { label: 'Resolved', tone: 'green' },
  closed: { label: 'Closed', tone: 'slate' },
};

export const priorityMeta: Record<string, { label: string; tone: 'slate' | 'blue' | 'amber' | 'red' }> = {
  low: { label: 'Low', tone: 'slate' },
  normal: { label: 'Normal', tone: 'blue' },
  high: { label: 'High', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
};

export const channelLabels: Record<string, string> = {
  email: 'Email', chat: 'Live chat', whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  telegram: 'Telegram', slack: 'Slack', amazon: 'Amazon', ebay: 'eBay', etsy: 'Etsy', walmart: 'Walmart',
  shopify: 'Shopify', woocommerce: 'WooCommerce', tiktok: 'TikTok Shop', aliexpress: 'AliExpress',
};

export const integrationStatusMeta: Record<string, { label: string; tone: 'green' | 'teal' | 'amber' | 'slate' | 'red'; hint: string }> = {
  connected: { label: 'Connected', tone: 'green', hint: 'Live API connection — data is syncing.' },
  demo: { label: 'Demo', tone: 'teal', hint: 'Sample data only. No external API calls are made.' },
  available: { label: 'Available', tone: 'slate', hint: 'Ready to connect — credentials required.' },
  needs_config: { label: 'Needs setup', tone: 'amber', hint: 'Add credentials to finish the connection.' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'amber', hint: 'Platform partner approval pending. Nothing is ingested.' },
  error: { label: 'Error', tone: 'red', hint: 'Connection failed. Check the error log and reconnect.' },
};

export const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', team_manager: 'Team Manager', agent: 'Support Agent', readonly: 'Read-only',
};

export const toneClasses = {
  teal: 'bg-teal/12 text-teal ring-teal/25',
  blue: 'bg-info/12 text-info ring-info/25',
  amber: 'bg-warning/14 text-warning ring-warning/30',
  slate: 'bg-muted/12 text-muted ring-muted/25',
  green: 'bg-success/12 text-success ring-success/25',
  red: 'bg-danger/12 text-danger ring-danger/25',
  violet: 'bg-violet/14 text-violet ring-violet/25',
} as const;

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 250) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function relativeDue(input?: string | null) {
  if (!input) return { label: '—', tone: 'slate' as const };
  const diff = new Date(input).getTime() - Date.now();
  const mins = Math.round(Math.abs(diff) / 60000);
  const amount = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  if (diff < 0) return { label: `${amount} overdue`, tone: 'red' as const };
  if (mins < 60) return { label: `due in ${amount}`, tone: 'amber' as const };
  return { label: `due in ${amount}`, tone: 'slate' as const };
}
