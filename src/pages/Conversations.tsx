import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, Filter, Inbox, MessageSquare, Star, UserCheck, X } from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, duration, priorityMeta, statusMeta, timeAgo } from '../lib/utils';
import { useAuth, useRealtime, useToast } from '../lib/store';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Input, PageHeader, SearchInput, Select, Skeleton } from '../components/ui';
import { ChannelIcon } from '../components/ChannelIcon';
import type { Conversation } from '../lib/types';

export default function Conversations() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const { push } = useToast();
  const { subscribe } = useRealtime();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [priority, setPriority] = useState('all');
  const [channel, setChannel] = useState('all');
  const [assignee, setAssignee] = useState(params.get('assignee') || 'all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 240); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.get<{ conversations: Conversation[]; counts: Record<string, number> }>(
        `/conversations${qs({ view: 'all', q: debounced, status, priority, channel, assignee, pageSize: 100, sort: 'recent' })}`);
      setRows(d.conversations); setCounts(d.counts);
    } finally { setLoading(false); }
  }, [debounced, status, priority, channel, assignee]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<any>('/team').then((d) => setAgents(d.users)); }, []);
  useEffect(() => subscribe((e) => {
    if (['message.created', 'conversation.updated', 'conversations.bulk'].includes(e.type)) load(true);
  }), [subscribe, load]);

  const bulk = async (action: string, value?: string) => {
    if (!selected.size) return;
    try {
      await api.post('/conversations/bulk', { ids: [...selected], action, value });
      push({ title: `${selected.size} updated`, tone: 'success' });
      setSelected(new Set()); load(true);
    } catch (e) { push({ title: 'Bulk action failed', description: (e as Error).message, tone: 'error' }); }
  };

  const exportCsv = () => {
    api.download('/reports/export?type=conversations');
    push({ title: 'Export started', description: 'Conversations CSV is downloading.', tone: 'success' });
  };

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="All conversations" description="Every thread across every channel, searchable and filterable."
        actions={<>
          <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv}>Export CSV</Button>
          <Button size="sm" variant="primary" icon={<Inbox className="h-3.5 w-3.5" />} onClick={() => navigate('/inbox')}>Open inbox</Button>
        </>} />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search subject, customer, ref or message body…" className="max-w-sm" />
        <Select size="sm" value={status} onChange={setStatus} className="w-32"
          options={[{ value: 'all', label: 'Any status' }, ...Object.entries(statusMeta).map(([v, m]) => ({ value: v, label: m.label }))]} />
        <Select size="sm" value={priority} onChange={setPriority} className="w-32"
          options={[{ value: 'all', label: 'Any priority' }, ...Object.entries(priorityMeta).map(([v, m]) => ({ value: v, label: m.label }))]} />
        <Select size="sm" value={channel} onChange={setChannel} className="w-32"
          options={[{ value: 'all', label: 'All channels' }, ...['email', 'chat', 'whatsapp', 'instagram', 'messenger', 'telegram', 'amazon', 'ebay', 'etsy', 'tiktok'].map((c) => ({ value: c, label: c }))]} />
        <Select size="sm" value={assignee} onChange={setAssignee} className="w-36"
          options={[{ value: 'all', label: 'Anyone' }, { value: 'me', label: 'Assigned to me' }, { value: 'unassigned', label: 'Unassigned' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
        <span className="ml-auto text-[11px] text-faint">{rows.length} conversations</span>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b border-line bg-teal/6 px-4 py-1.5">
          <span className="text-[11.5px] font-medium text-ink">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-1">
            <Button size="xs" onClick={() => bulk('resolve')} icon={<CheckCircle2 className="h-3 w-3" />}>Resolve</Button>
            <Button size="xs" onClick={() => bulk('assign', agents[0]?.id)} icon={<UserCheck className="h-3 w-3" />}>Assign</Button>
            <Button size="xs" onClick={() => bulk('priority', 'urgent')} icon={<Filter className="h-3 w-3" />}>Set urgent</Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())} icon={<X className="h-3 w-3" />}>Clear</Button>
          </div>
        </div>
      )}

      <div className="p-4">
        {loading ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : rows.length === 0 ? <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No conversations match" description="Try widening your filters or clearing the search." />
          : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                      <th className="w-8 px-3 py-2"></th>
                      <th className="px-3 py-2 font-semibold">Conversation</th>
                      <th className="px-3 py-2 font-semibold">Customer</th>
                      <th className="px-3 py-2 font-semibold">Channel</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Priority</th>
                      <th className="px-3 py-2 font-semibold">Assignee</th>
                      <th className="px-3 py-2 font-semibold">SLA</th>
                      <th className="px-3 py-2 font-semibold">Last activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((c) => (
                      <tr key={c.id} className="cursor-pointer transition hover:bg-surface2/60" onClick={() => navigate(`/inbox?c=${c.id}`)}>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(c.id)} onChange={() => setSelected((cur) => { const n = new Set(cur); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                        </td>
                        <td className="max-w-[300px] px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {c.unreadCount > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />}
                            <span className={cn('truncate', c.unreadCount > 0 ? 'font-semibold text-ink' : 'font-medium text-ink')}>{c.subject}</span>
                            {c.starred && <Star className="h-2.5 w-2.5 shrink-0 fill-warning text-warning" />}
                          </div>
                          <div className="truncate text-[10.5px] text-faint">{c.ref} · {c.messageCount} messages{c.teamName ? ` · ${c.teamName}` : ''}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={c.customer.name} color={c.customer.color} size="xs" />
                            <span className="truncate text-muted">{c.customer.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><ChannelIcon type={c.channelType} size="xs" /><span className="capitalize text-muted">{c.channelType}</span></div></td>
                        <td className="px-3 py-2.5"><Badge tone={statusMeta[c.status]?.tone as any}>{statusMeta[c.status]?.label || c.status}</Badge></td>
                        <td className="px-3 py-2.5"><Badge tone={priorityMeta[c.priority]?.tone as any}>{priorityMeta[c.priority]?.label}</Badge></td>
                        <td className="px-3 py-2.5">
                          {c.assignee ? <div className="flex items-center gap-1.5"><Avatar name={c.assignee.name} color={c.assignee.color} size="xs" /><span className="truncate text-muted">{c.assignee.name.split(' ')[0]}</span></div>
                            : <span className="text-[11px] text-faint">Unassigned</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={c.slaState === 'breached' ? 'red' : c.slaState === 'at_risk' ? 'amber' : c.slaState === 'met' ? 'green' : 'slate'}>{c.slaState.replace('_', ' ')}</Badge></td>
                        <td className="px-3 py-2.5 text-[11px] text-faint">{timeAgo(c.lastMessageAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
      </div>
    </div>
  );
}
