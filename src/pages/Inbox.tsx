import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown, Check, ChevronLeft, Filter, Inbox as InboxIcon, Mail, MessageCircle, MessageSquare,
  PanelLeftClose, PanelRightClose, Search, SlidersHorizontal, Star, Tag, UserCheck, UserX, X, Zap,
  Clock, CheckCircle2, Flame, Star as StarIcon, Archive, Trash2, Users,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, channelLabels, statusMeta } from '../lib/utils';
import { useAuth, useRealtime, useToast } from '../lib/store';
import { Avatar, Badge, Button, Checkbox, Dropdown, EmptyState, Input, MenuDivider, MenuItem, MenuLabel, SearchInput, Select, Skeleton } from '../components/ui';
import { ConversationList } from '../components/inbox/ConversationList';
import { ConversationThread } from '../components/inbox/ConversationThread';
import { ChannelIcon } from '../components/ChannelIcon';
import type { Conversation } from '../lib/types';

const VIEWS = [
  { id: 'all', label: 'All conversations', icon: InboxIcon, countKey: 'all' },
  { id: 'mine', label: 'Assigned to me', icon: UserCheck, countKey: 'mine' },
  { id: 'unassigned', label: 'Unassigned', icon: UserX, countKey: 'unassigned' },
  { id: 'open', label: 'Open', icon: MessageSquare, countKey: 'open' },
  { id: 'pending', label: 'Pending', icon: Clock, countKey: 'pending' },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle2, countKey: 'resolved' },
  { id: 'chat', label: 'Live chat', icon: MessageCircle, countKey: 'chat' },
  { id: 'urgent', label: 'Urgent', icon: Flame, countKey: 'urgent' },
  { id: 'starred', label: 'Starred', icon: StarIcon },
  { id: 'mentions', label: 'Internal notes', icon: Tag },
];

const CHANNELS = ['email', 'chat', 'whatsapp', 'instagram', 'messenger', 'telegram', 'amazon', 'ebay', 'etsy', 'shopify', 'tiktok'];
const STATUSES = ['open', 'new', 'pending', 'on_hold', 'resolved', 'closed'];

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'all';
  const selectedId = params.get('c') || undefined;
  const { user, canWrite } = useAuth();
  const { push } = useToast();
  const { subscribe } = useRealtime();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [channel, setChannel] = useState('all');
  const [assignee, setAssignee] = useState(view === 'mine' ? 'me' : view === 'unassigned' ? 'unassigned' : 'all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<any[]>([]);
  const [tags, setTags] = useState<{ name: string; color: string }[]>([]);
  const [savedReplies, setSavedReplies] = useState<{ id: string; title: string; body: string; category: string }[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 240);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.get<{ conversations: Conversation[]; counts: Record<string, number> }>(
        `/conversations${qs({ view, q: debounced, channel, assignee, priority, sort, pageSize: 60 })}`,
      );
      setConversations(d.conversations);
      setCounts(d.counts);
    } catch { /* surfaced by empty state */ }
    finally { setLoading(false); }
  }, [view, debounced, channel, assignee, priority, sort]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ users: any[] }>('/team').then((d) => setAgents(d.users.filter((u) => u.role !== 'readonly'))).catch(() => {});
    api.get<any>('/settings').then((d) => { setTags(d.tags); setSavedReplies(d.savedReplies); setTeams(d.teams || []); }).catch(() => {});
    api.get<any>('/team').then((d) => setTeams(d.teams)).catch(() => {});
  }, []);

  // realtime: refresh list + auto-open new conversations for the current view
  useEffect(() => subscribe((e) => {
    if (['message.created', 'conversation.updated', 'conversations.bulk', 'conversation.created'].includes(e.type)) {
      load(true);
    }
  }), [subscribe, load]);

  // keyboard: j/k navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = conversations.findIndex((c) => c.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const next = conversations[Math.min(idx + 1, conversations.length - 1)];
        if (next) select(next.id);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        const prev = conversations[Math.max(idx - 1, 0)];
        if (prev) select(prev.id);
      }
      if (e.key === 'e' && selectedId) patchStatus('resolved');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [conversations, selectedId]);

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('c', id);
    setParams(next, { replace: true });
  };
  const setView = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('view', v);
    next.delete('c');
    setAssignee(v === 'mine' ? 'me' : v === 'unassigned' ? 'unassigned' : 'all');
    setParams(next);
  };

  const onChanged = useCallback(() => { load(true); }, [load]);

  const toggleStar = async (c: Conversation) => {
    setConversations((cur) => cur.map((x) => (x.id === c.id ? { ...x, starred: !x.starred } : x)));
    await api.patch(`/conversations/${c.id}`, { starred: !c.starred }).catch(() => load(true));
  };

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulk = async (action: string, value?: string) => {
    if (!selected.size) return;
    try {
      await api.post('/conversations/bulk', { ids: [...selected], action, value });
      push({ title: `${selected.size} conversation${selected.size > 1 ? 's' : ''} updated`, description: `Bulk action: ${action}`, tone: 'success' });
      setSelected(new Set()); load(true);
    } catch (e) { push({ title: 'Bulk action failed', description: (e as Error).message, tone: 'error' }); }
  };

  const patchStatus = async (status: string) => {
    if (!selectedId) return;
    await api.patch(`/conversations/${selectedId}`, { status });
    load(true);
  };

  const activeView = VIEWS.find((v) => v.id === view);
  const filtersActive = channel !== 'all' || priority !== 'all' || assignee !== 'all';

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ---------- folders column ---------- */}
      <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink"><InboxIcon className="h-3.5 w-3.5 text-teal" /> Unified inbox</div>
          <p className="mt-0.5 text-[10.5px] text-faint">Every channel, one workspace</p>
        </div>
        <div className="rf-scroll flex-1 px-2 py-2">
          <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Folders</div>
          {VIEWS.map((v) => {
            const count = v.countKey ? counts[v.countKey] : undefined;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={cn('mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-[6px] text-[12px] font-medium transition',
                  view === v.id ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2 hover:text-ink')}>
                <v.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">{v.label}</span>
                {count ? <span className={cn('rounded px-1 text-[10px] font-semibold', view === v.id ? 'bg-teal/15 text-teal' : 'text-faint')}>{count}</span> : null}
              </button>
            );
          })}

          <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Channels</div>
          <button onClick={() => setChannel('all')}
            className={cn('mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-[11.5px] transition', channel === 'all' ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2')}>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-surface3 text-[9px] font-bold text-muted">ALL</span>
            All channels
          </button>
          {CHANNELS.map((c) => (
            <button key={c} onClick={() => setChannel(channel === c ? 'all' : c)}
              className={cn('mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-[11.5px] transition', channel === c ? 'bg-surface2 font-medium text-ink' : 'text-muted hover:bg-surface2')}>
              <ChannelIcon type={c} size="xs" />
              <span className="flex-1 truncate text-left">{channelLabels[c]}</span>
            </button>
          ))}

          <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Teams</div>
          {teams.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-[5px] text-[11.5px] text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-[10px] text-faint">{t.openConversations}</span>
            </div>
          ))}
        </div>
        {counts.unassigned > 0 && (
          <div className="border-t border-line p-2">
            <button onClick={() => setView('unassigned')} className="w-full rounded-lg border border-warning/30 bg-warning/8 px-2 py-1.5 text-left">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-warning"><Zap className="h-3 w-3" /> {counts.unassigned} unassigned</div>
              <div className="text-[10px] text-faint">Triage the queue</div>
            </button>
          </div>
        )}
      </aside>

      {/* ---------- list column ---------- */}
      <section className={cn('flex min-w-0 shrink-0 flex-col border-r border-line bg-surface transition-all',
        selectedId ? 'hidden w-full lg:flex lg:w-[340px]' : 'w-full lg:w-[340px]',
        listCollapsed && 'lg:hidden')}>
        <div className="border-b border-line px-3 py-2">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[13px] font-semibold text-ink">{activeView?.label}</h2>
            <Badge tone="slate">{counts[activeView?.countKey || 'all'] ?? conversations.length}</Badge>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setFiltersOpen((v) => !v)}
                className={cn('relative rounded-md p-1.5 transition hover:bg-surface2', filtersActive ? 'text-teal' : 'text-muted')}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {filtersActive && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-teal" />}
              </button>
              <Dropdown width="w-44" trigger={<button className="rounded-md p-1.5 text-muted hover:bg-surface2"><ArrowUpDown className="h-3.5 w-3.5" /></button>}>
                {() => (
                  <>
                    <MenuLabel>Sort by</MenuLabel>
                    {[['recent', 'Newest activity'], ['oldest', 'Oldest first'], ['priority', 'Priority']].map(([v, l]) => (
                      <MenuItem key={v} active={sort === v} onClick={() => setSort(v)}>{l}</MenuItem>
                    ))}
                  </>
                )}
              </Dropdown>
              <button onClick={() => setListCollapsed(true)} className="hidden rounded-md p-1.5 text-muted hover:bg-surface2 lg:block" title="Hide list"><PanelLeftClose className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="mt-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search this view…" />
          </div>
          {filtersOpen && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-surface2/50 p-2 rf-animate-in">
              <div className="grid grid-cols-2 gap-1.5">
                <Select size="sm" value={assignee} onChange={setAssignee}
                  options={[{ value: 'all', label: 'Anyone' }, { value: 'me', label: 'Assigned to me' }, { value: 'unassigned', label: 'Unassigned' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
                <Select size="sm" value={priority} onChange={setPriority}
                  options={[{ value: 'all', label: 'Any priority' }, { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] text-faint">{conversations.length} results</span>
                {filtersActive && <button onClick={() => { setChannel('all'); setPriority('all'); setAssignee('all'); }} className="text-[10.5px] font-medium text-teal hover:underline">Clear filters</button>}
              </div>
            </div>
          )}
          {selected.size > 0 && (
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-teal/30 bg-teal/6 px-2 py-1 rf-animate-in">
              <span className="text-[11px] font-medium text-ink">{selected.size} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => bulk('resolve')} className="rounded p-1 text-muted hover:bg-surface hover:text-success" title="Resolve"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => bulk('assign', user?.id)} className="rounded p-1 text-muted hover:bg-surface hover:text-info" title="Assign to me"><UserCheck className="h-3.5 w-3.5" /></button>
                <button onClick={() => bulk('priority', 'urgent')} className="rounded p-1 text-muted hover:bg-surface hover:text-danger" title="Set urgent"><Flame className="h-3.5 w-3.5" /></button>
                <button onClick={() => setSelected(new Set())} className="rounded p-1 text-muted hover:bg-surface hover:text-ink" title="Clear"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </div>

        <div className="rf-scroll flex-1">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={(c) => select(c.id)}
            loading={loading && !conversations.length}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleStar={toggleStar}
            emptyLabel={debounced ? 'No matches' : view === 'mine' ? 'Your inbox is clear' : 'Nothing here'}
          />
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[10px] text-faint">
          <span>{conversations.length} conversations</span>
          <span className="hidden sm:inline">J / K to navigate · E to resolve</span>
        </div>
      </section>

      {/* ---------- thread column ---------- */}
      <section className={cn('min-w-0 flex-1 bg-bg', selectedId ? 'block' : 'hidden lg:block')}>
        {!mounted ? null : selectedId ? (
          <ConversationThread
            key={selectedId}
            conversationId={selectedId}
            onBack={() => { const n = new URLSearchParams(params); n.delete('c'); setParams(n, { replace: true }); }}
            onChanged={onChanged}
            agents={agents}
            tags={tags}
            savedReplies={savedReplies}
            teams={teams}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            {listCollapsed && (
              <Button size="sm" variant="secondary" icon={<PanelRightClose className="h-3.5 w-3.5" />} onClick={() => setListCollapsed(false)}>Show list</Button>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal/15 to-info/10 text-teal">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Select a conversation</h2>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">
                Choose a thread from the list to see the full history, customer context and reply across email, chat and marketplaces.
              </p>
            </div>
            <div className="grid max-w-md grid-cols-2 gap-2 text-left">
              {[
                ['Reply everywhere', 'Email, chat and marketplace threads in one place'],
                ['AI drafts', 'Generate, edit and send with your approval'],
                ['Customer context', 'Orders, tickets and history side by side'],
                ['Team collaboration', 'Internal notes and mentions'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-lg border border-line bg-surface p-2.5">
                  <div className="text-[11.5px] font-semibold text-ink">{t}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-muted">{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
