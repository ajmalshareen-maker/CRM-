import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Building2, Inbox, LayoutDashboard, Plug, Search, Ticket, User, Users, Workflow, Sparkles, BarChart3, Settings, CornerDownLeft, Loader2 } from 'lucide-react';
import { useCommand, useAuth } from '../lib/store';
import { api, qs } from '../lib/api';
import { cn, statusMeta, timeAgo } from '../lib/utils';
import { ChannelIcon } from './ChannelIcon';
import { Avatar, Kbd } from './ui';

const PAGES = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, keywords: 'dashboard home metrics' },
  { label: 'Unified Inbox', to: '/inbox', icon: Inbox, keywords: 'inbox conversations messages' },
  { label: 'My Inbox', to: '/inbox?view=mine', icon: User, keywords: 'assigned mine' },
  { label: 'Unassigned queue', to: '/inbox?view=unassigned', icon: Users, keywords: 'unassigned triage' },
  { label: 'Tickets', to: '/tickets', icon: Ticket, keywords: 'tickets support issues' },
  { label: 'Customers', to: '/customers', icon: Users, keywords: 'crm contacts people' },
  { label: 'Companies', to: '/companies', icon: Building2, keywords: 'accounts organisations' },
  { label: 'AI Assistant', to: '/ai', icon: Sparkles, keywords: 'ai assist draft summary' },
  { label: 'Automations', to: '/automations', icon: Workflow, keywords: 'workflow rules when if then' },
  { label: 'Reports & Analytics', to: '/reports', icon: BarChart3, keywords: 'reports analytics csat' },
  { label: 'Knowledge Base', to: '/knowledge', icon: BookOpen, keywords: 'articles docs help' },
  { label: 'Integrations', to: '/integrations', icon: Plug, keywords: 'channels gmail whatsapp amazon shopify' },
  { label: 'Settings', to: '/settings', icon: Settings, keywords: 'preferences workspace billing security' },
];

export function CommandPalette() {
  const { open, setOpen } = useCommand();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(''); setResults(null); setActive(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get<any>(`/search${qs({ q: q.trim() })}`).then((d) => { setResults(d); setActive(0); }).catch(() => {}).finally(() => setLoading(false));
    }, 180);
    return () => { clearTimeout(t); setLoading(false); };
  }, [q, open]);

  const pages = useMemo(
    () => PAGES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()) || p.keywords.includes(q.toLowerCase())),
    [q],
  );

  type Row = { key: string; label: string; sub?: string; icon: React.ReactNode; go: () => void; group: string };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (results) {
      (results.conversations || []).forEach((c: any) => out.push({
        key: `c-${c.id}`, group: 'Conversations', label: c.subject, sub: `${c.customer.name} · ${c.ref} · ${timeAgo(c.lastMessageAt)}`,
        icon: <ChannelIcon type={c.channelType} size="xs" />, go: () => navigate(`/inbox?c=${c.id}`),
      }));
      (results.customers || []).forEach((c: any) => out.push({
        key: `cu-${c.id}`, group: 'Customers', label: c.name, sub: c.email,
        icon: <Avatar name={c.name} color={c.avatar_color} size="xs" />, go: () => navigate(`/customers?id=${c.id}`),
      }));
      (results.tickets || []).forEach((t: any) => out.push({
        key: `t-${t.id}`, group: 'Tickets', label: `#${t.number} ${t.subject}`, sub: `${t.status} · ${t.priority}`,
        icon: <Ticket className="h-3.5 w-3.5 text-muted" />, go: () => navigate(`/tickets?id=${t.id}`),
      }));
      (results.articles || []).forEach((a: any) => out.push({
        key: `a-${a.id}`, group: 'Knowledge base', label: a.title, sub: a.visibility,
        icon: <BookOpen className="h-3.5 w-3.5 text-muted" />, go: () => navigate(`/knowledge?article=${a.id}`),
      }));
    }
    pages.forEach((p) => out.push({ key: `p-${p.to}`, group: q ? 'Pages' : 'Jump to', label: p.label, icon: <p.icon className="h-3.5 w-3.5 text-muted" />, go: () => navigate(p.to) }));
    return out;
  }, [results, pages, q, navigate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter' && rows[active]) { e.preventDefault(); rows[active].go(); setOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, active, setOpen]);

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[10vh]">
      <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px] rf-animate-in" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-[620px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift rf-animate-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-teal" /> : <Search className="h-4 w-4 text-faint" />}
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search everything — conversations, customers, tickets, articles…"
            className="h-12 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
          />
          <button onClick={() => setOpen(false)} className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-faint hover:bg-surface2">ESC</button>
        </div>
        <div className="rf-scroll max-h-[52vh] py-1.5">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-[12.5px] text-muted">
              No matches for “{q}”. Try a customer name, ticket number or subject line.
            </div>
          )}
          {rows.map((r, i) => {
            const showGroup = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {showGroup && <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{r.group}</div>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { r.go(); setOpen(false); }}
                  className={cn('flex w-full items-center gap-3 px-4 py-2 text-left transition', active === i ? 'bg-teal/8' : 'hover:bg-surface2')}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{r.label}</span>
                    {r.sub && <span className="block truncate text-[11px] text-faint">{r.sub}</span>}
                  </span>
                  {active === i && <CornerDownLeft className="h-3.5 w-3.5 text-teal" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line bg-surface2/60 px-4 py-2 text-[10.5px] text-faint">
          <span className="flex items-center gap-2"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate <Kbd>↵</Kbd> open</span>
          <span>Signed in as {user?.name}</span>
        </div>
      </div>
    </div>
  );
}
