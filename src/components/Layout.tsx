import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, MessagesSquare, UserCheck, UserX, Ticket, Clock, CheckCircle2, MessageCircle,
  Users, Building2, Sparkles, Workflow, BarChart3, BookOpen, Plug, UsersRound, Settings, ChevronDown,
  Plus, Bell, CircleHelp, Search, Moon, Sun, LogOut, PanelLeftClose, PanelLeft, Command, LifeBuoy,
  Bot, ShieldCheck, KeyRound, CreditCard, Zap, X, ArrowRight, Mail, Activity,
} from 'lucide-react';
import { useAuth, useTheme, useCommand, useRealtime } from '../lib/store';
import { api, qs } from '../lib/api';
import { cn, timeAgo, roleLabels } from '../lib/utils';
import { Avatar, Badge, Button, Dropdown, MenuItem, MenuLabel, MenuDivider, Input, Textarea, Select, Modal, Kbd } from './ui';
import { ChannelIcon } from './ChannelIcon';

type NavItem = { label: string; to: string; icon: React.ElementType; badgeKey?: 'mine' | 'unassigned' | 'open' | 'pending' | 'urgent'; section?: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, section: 'Workspace' },
  { label: 'Unified Inbox', to: '/inbox', icon: Inbox, section: 'Inbox', badgeKey: 'open' },
  { label: 'All Conversations', to: '/conversations', icon: MessagesSquare },
  { label: 'My Inbox', to: '/inbox?view=mine', icon: UserCheck, badgeKey: 'mine' },
  { label: 'Assigned to Me', to: '/conversations?assignee=me', icon: Activity },
  { label: 'Unassigned', to: '/inbox?view=unassigned', icon: UserX, badgeKey: 'unassigned' },
  { label: 'Open Tickets', to: '/tickets?status=open', icon: Ticket, section: 'Queues' },
  { label: 'Pending', to: '/inbox?view=pending', icon: Clock, badgeKey: 'pending' },
  { label: 'Resolved', to: '/inbox?view=resolved', icon: CheckCircle2 },
  { label: 'Live Chat', to: '/inbox?view=chat', icon: MessageCircle, section: 'Channels' },
  { label: 'Customers', to: '/customers', icon: Users, section: 'Customers' },
  { label: 'Companies', to: '/companies', icon: Building2 },
  { label: 'AI Assistant', to: '/ai', icon: Sparkles, section: 'Intelligence' },
  { label: 'Automations', to: '/automations', icon: Workflow },
  { label: 'Reports & Analytics', to: '/reports', icon: BarChart3 },
  { label: 'Knowledge Base', to: '/knowledge', icon: BookOpen, section: 'Content' },
  { label: 'Integrations', to: '/integrations', icon: Plug },
  { label: 'Team Management', to: '/team', icon: UsersRound, section: 'Admin' },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const bottomNav: NavItem[] = [
  { label: 'Live chat widget', to: '/widget', icon: MessageCircle },
  { label: 'Public help center', to: '/help', icon: LifeBuoy },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, org, logout, aiProvider } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('rf-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [insights, setInsights] = useState<{ unread: number }>({ unread: 0 });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { localStorage.setItem('rf-sidebar', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

  const loadCounts = () => {
    api.get<{ counts: Record<string, number> }>(`/conversations${qs({ pageSize: 1, view: 'all' })}`).then((d) => setCounts(d.counts)).catch(() => {});
    api.get<{ unread: number }>('/notifications').then((d) => setInsights({ unread: d.unread })).catch(() => {});
  };
  useEffect(() => { loadCounts(); }, [location.pathname]);

  // refresh counters whenever realtime activity lands
  React.useEffect(() => {
    const t = setInterval(loadCounts, 45000);
    return () => clearInterval(t);
  }, []);

  const badgeFor = (key?: NavItem['badgeKey']) => {
    if (!key) return null;
    const v = counts[key];
    return v ? v : null;
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-bg">
      {/* mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-navy/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 lg:static lg:translate-x-0',
        collapsed ? 'w-[68px]' : 'w-[248px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* brand */}
        <div className={cn('flex h-14 items-center gap-2.5 border-b border-line px-3.5', collapsed && 'justify-center px-0')}>
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-navy text-teal dark:bg-teal dark:text-navy">
              <svg viewBox="0 0 32 32" className="h-[18px] w-[18px]" fill="none">
                <path d="M8 24V8h9.2c3.6 0 6 2.1 6 5.4 0 2.5-1.4 4.3-3.6 5l4 5.6h-4.4l-3.6-5.2H12V24H8zm4-8.6h4.8c1.8 0 2.9-1 2.9-2.6s-1.1-2.6-2.9-2.6H12v5.2z" fill="currentColor" />
              </svg>
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold leading-tight tracking-tight text-ink">ReplyFlow</span>
                <span className="block truncate text-[10px] font-medium text-faint">Every conversation. One workspace.</span>
              </span>
            )}
          </button>
        </div>

        {/* workspace switcher */}
        {!collapsed && (
          <div className="border-b border-line px-2.5 py-2.5">
            <Dropdown
              width="w-[224px]"
              trigger={
                <button className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface2/60 px-2 py-1.5 text-left transition hover:border-line-strong">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: org?.brand_color || '#21B8A6' }}>
                    {org?.logo_initials || 'RF'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold leading-tight text-ink">{org?.name || 'Workspace'}</span>
                    <span className="block text-[10px] capitalize text-faint">{org?.plan} plan</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
                </button>
              }
            >
              {(close) => (
                <>
                  <MenuLabel>Workspaces</MenuLabel>
                  <MenuItem icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-teal text-[9px] font-bold text-white">{org?.logo_initials}</span>} active>
                    {org?.name}
                  </MenuItem>
                  <MenuItem icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-info/20 text-[9px] font-bold text-info">AP</span>} onClick={() => { close(); }}>
                    Acme Partners
                  </MenuItem>
                  <MenuItem icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-violet/20 text-[9px] font-bold text-violet">VL</span>} onClick={() => { close(); }}>
                    Vertex Labs (demo)
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings'); }}>Create workspace</MenuItem>
                  <MenuItem icon={<Settings className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings'); }}>Workspace settings</MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        )}

        {/* nav */}
        <nav className="rf-scroll flex-1 px-2 py-2">
          {NAV.map((item, i) => {
            const showSection = item.section && !collapsed && (i === 0 || NAV[i - 1].section !== item.section);
            const badge = badgeFor(item.badgeKey);
            return (
              <React.Fragment key={item.to}>
                {showSection && <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-faint">{item.section}</div>}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(
                    'group relative mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition-all',
                    isActive ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2 hover:text-ink',
                    collapsed && 'justify-center px-0 py-2',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r bg-teal" />}
                      <item.icon className={cn('h-[15px] w-[15px] shrink-0', isActive ? 'text-teal' : 'text-faint group-hover:text-muted')} />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && badge ? (
                        <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold', isActive ? 'bg-teal/15 text-teal' : 'bg-surface2 text-muted')}>{badge}</span>
                      ) : null}
                      {collapsed && badge ? <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-teal" /> : null}
                    </>
                  )}
                </NavLink>
              </React.Fragment>
            );
          })}

          <div className={cn('mt-3 border-t border-line pt-2', collapsed && 'mt-2')}>
            {!collapsed && <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Public</div>}
            {bottomNav.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => cn('mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition',
                  isActive ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2 hover:text-ink', collapsed && 'justify-center px-0 py-2')}
                title={collapsed ? item.label : undefined}>
                <item.icon className="h-[15px] w-[15px] shrink-0 text-faint" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* AI status + collapse */}
        <div className="border-t border-line p-2">
          {!collapsed ? (
            <div className="mb-2 rounded-lg border border-line bg-surface2/60 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                <Sparkles className="h-3 w-3 text-teal" /> AI Assist
                <Badge tone={aiProvider === 'live' ? 'green' : 'amber'} className="ml-auto !px-1 !py-0 !text-[9.5px]">{aiProvider === 'live' ? 'Live' : 'Local'}</Badge>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-faint">
                {aiProvider === 'live' ? 'Connected to your LLM provider.' : 'Local engine active. Add an API key for live generation.'}
              </p>
            </div>
          ) : null}
          <button onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-faint transition hover:bg-surface2 hover:text-ink">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <><PanelLeftClose className="h-3.5 w-3.5" /> <span>Collapse</span><Kbd className="ml-auto">[</Kbd></>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          unread={insights.unread}
          onRefreshCounts={loadCounts}
        />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <QuickCreate />
    </div>
  );
}

function Topbar({ onMenu, unread, onRefreshCounts }: { onMenu: () => void; unread: number; onRefreshCounts: () => void }) {
  const { user, logout, theme, toggle } = useThemeAndAuth();
  const { setOpen, setCreateOpen } = useCommand();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadNotifs = () => api.get<{ notifications: any[]; unread: number }>('/notifications').then((d) => setNotifs(d.notifications)).catch(() => {});
  useEffect(() => { loadNotifs(); }, []);
  useEffect(() => {
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read', {});
    loadNotifs(); onRefreshCounts();
  };

  return (
    <header className="flex h-14 w-full shrink-0 items-center gap-2 overflow-hidden border-b border-line bg-surface px-3 sm:px-4">
      <button onClick={onMenu} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface2 lg:hidden"><Inbox className="h-4 w-4" /></button>

      <button onClick={() => setOpen(true)}
        className="group flex h-9 min-w-0 w-full max-w-[420px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface2/60 px-3 text-[12.5px] text-faint transition hover:border-line-strong hover:bg-surface2 sm:flex-none">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Search conversations, customers, tickets…</span>
        <span className="hidden items-center gap-0.5 sm:flex"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)} className="hidden sm:inline-flex">
          Create
        </Button>

        <div className="relative">
          <button onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotifs(); }}
            className="relative rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink">
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread}</span>}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-50 mt-1.5 w-[340px] overflow-hidden rounded-xl border border-line bg-surface shadow-lift rf-animate-pop">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <span className="text-[12.5px] font-semibold text-ink">Notifications</span>
                  <button onClick={markAll} className="text-[11px] font-medium text-teal hover:underline">Mark all read</button>
                </div>
                <div className="rf-scroll max-h-[360px]">
                  {notifs.length === 0 && <div className="px-3.5 py-8 text-center text-[12px] text-muted">You're all caught up.</div>}
                  {notifs.map((n) => (
                    <button key={n.id}
                      onClick={async () => { await api.post('/notifications/read', { id: n.id }); if (n.link) navigate(n.link); setNotifOpen(false); loadNotifs(); onRefreshCounts(); }}
                      className={cn('flex w-full gap-2.5 border-b border-line/60 px-3.5 py-2.5 text-left transition last:border-0 hover:bg-surface2', !n.read && 'bg-teal/[0.04]')}>
                      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                        n.type === 'sla' ? 'bg-danger/10 text-danger' : n.type === 'assignment' ? 'bg-info/10 text-info' : n.type === 'success' ? 'bg-success/10 text-success' : n.type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-surface3 text-muted')}>
                        {n.type === 'sla' ? <Clock className="h-3 w-3" /> : n.type === 'assignment' ? <UserCheck className="h-3 w-3" /> : n.type === 'success' ? <CheckCircle2 className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('truncate text-[12px]', n.read ? 'font-medium text-ink' : 'font-semibold text-ink')}>{n.title}</span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />}
                        </span>
                        <span className="mt-0.5 block rf-line-clamp-2 text-[11px] leading-snug text-muted">{n.body}</span>
                        <span className="mt-0.5 block text-[10px] text-faint">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <Dropdown className="hidden sm:block" width="w-64" trigger={
          <button className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink" title="Help & shortcuts">
            <CircleHelp className="h-4 w-4" />
          </button>
        }>
          {(close) => (
            <>
              <MenuLabel>Help</MenuLabel>
              <MenuItem icon={<BookOpen className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/knowledge'); }}>Knowledge base</MenuItem>
              <MenuItem icon={<LifeBuoy className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/help'); }}>Public help center</MenuItem>
              <MenuItem icon={<MessageCircle className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/widget'); }}>Live chat widget</MenuItem>
              <MenuDivider />
              <MenuLabel>Keyboard shortcuts</MenuLabel>
              <div className="space-y-1 px-2.5 pb-2 text-[11px] text-muted">
                {[['Search', '⌘ K'], ['Quick create', '⌘ J'], ['Send reply', '⌘ ↵'], ['Close panel', 'Esc'], ['Toggle sidebar', '[']].map(([l, k]) => (
                  <div key={l} className="flex items-center justify-between"><span>{l}</span><Kbd>{k}</Kbd></div>
                ))}
              </div>
            </>
          )}
        </Dropdown>

        <button onClick={toggle} className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink" title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="mx-1 h-6 w-px bg-line" />

        <Dropdown width="w-60" trigger={
          <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-surface2">
            <Avatar name={user?.name} color={user?.avatar_color} size="sm" status="online" />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-[12px] font-semibold leading-tight text-ink">{user?.name}</span>
              <span className="block truncate text-[10px] text-faint">{roleLabels[user?.role || 'agent']}</span>
            </span>
            <ChevronDown className="hidden h-3 w-3 text-faint sm:block" />
          </button>
        }>
          {(close) => (
            <>
              <div className="px-2.5 py-2">
                <div className="text-[12.5px] font-semibold text-ink">{user?.name}</div>
                <div className="text-[11px] text-faint">{user?.email}</div>
              </div>
              <MenuDivider />
              <MenuItem icon={<UserCheck className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings?tab=profile'); }}>Profile settings</MenuItem>
              <MenuItem icon={<Bell className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings?tab=notifications'); }}>Notifications</MenuItem>
              <MenuItem icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings?tab=security'); }}>Security</MenuItem>
              <MenuItem icon={<CreditCard className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings?tab=billing'); }}>Billing & plans</MenuItem>
              <MenuDivider />
              <MenuItem icon={<LogOut className="h-3.5 w-3.5" />} danger onClick={logout}>Sign out</MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}

function useThemeAndAuth() {
  const auth = useAuth();
  const themeCtx = useTheme();
  return { ...auth, ...themeCtx };
}

/* --------------------------- Quick create --------------------------- */
function QuickCreate() {
  const { createOpen, setCreateOpen } = useCommand();
  const { user, canWrite } = useAuth();
  const [mode, setMode] = useState<'conversation' | 'ticket' | 'customer'>('conversation');
  const [customers, setCustomers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [form, setForm] = useState({ subject: '', body: '', customerId: '', channelId: '', priority: 'normal', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!createOpen) return;
    api.get<{ customers: any[] }>('/customers').then((d) => setCustomers(d.customers)).catch(() => {});
    api.get<{ channels: any[] }>('/channels').then((d) => setChannels(d.channels)).catch(() => {});
    api.get<{ teams: any[] }>('/team').then((d) => setTeams(d.teams)).catch(() => {});
  }, [createOpen]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === 'conversation') {
        if (!form.customerId) throw new Error('Select a customer');
        const d = await api.post<{ conversation: any }>('/conversations', {
          subject: form.subject || 'New conversation', customerId: form.customerId,
          channelId: form.channelId || channels.find((c) => c.status === 'connected')?.id,
          priority: form.priority, body: form.body,
        });
        setCreateOpen(false); setForm({ subject: '', body: '', customerId: '', channelId: '', priority: 'normal', description: '' });
        navigate(`/inbox?c=${d.conversation.id}`);
      } else if (mode === 'ticket') {
        await api.post('/tickets', { subject: form.subject, description: form.body, priority: form.priority, customerId: form.customerId || undefined });
        setCreateOpen(false); navigate('/tickets');
      } else {
        throw new Error('Use the Customers page to add a new customer');
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Quick create" description="Start work without leaving your current screen." icon={<Plus className="h-4 w-4" />} size="lg"
      footer={<>
        <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={busy} disabled={!canWrite}>{mode === 'customer' ? 'Open customers' : mode === 'ticket' ? 'Create ticket' : 'Create conversation'}</Button>
      </>}>
      {!canWrite && <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-ink">Your role is read-only — creating records is disabled.</div>}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface2 p-1">
        {(['conversation', 'ticket', 'customer'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium capitalize transition', mode === m ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>
            {m}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {mode === 'customer' ? (
          <div className="rounded-lg border border-line bg-surface2/50 p-4 text-[12.5px] text-muted">
            Customer records are created from the Customers page or automatically from verified channel identities.
            <Button variant="soft" size="sm" className="mt-3" onClick={() => { setCreateOpen(false); navigate('/customers'); }}>Go to Customers <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-muted">{mode === 'ticket' ? 'Ticket subject' : 'Conversation subject'}</label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={mode === 'ticket' ? 'Short summary of the issue' : 'What is this conversation about?'} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-muted">Customer</label>
                <Select value={form.customerId} onChange={(v) => setForm({ ...form, customerId: v })} placeholder="Select a customer"
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-muted">Priority</label>
                <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })}
                  options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
              </div>
            </div>
            {mode === 'conversation' && (
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-muted">Channel</label>
                <Select value={form.channelId} onChange={(v) => setForm({ ...form, channelId: v })} placeholder="Default connected channel"
                  options={channels.map((c) => ({ value: c.id, label: `${c.name} ${c.status !== 'connected' ? '(demo)' : ''}` }))} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-muted">{mode === 'ticket' ? 'Description' : 'First message'}</label>
              <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the opening message…" />
            </div>
            {err && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{err}</div>}
            <p className="text-[11px] text-faint">Signed in as {user?.name}. Replies on demo channels are stored in ReplyFlow and labelled clearly.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
