import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Filter, GitMerge, Link2, MessageSquare, Plus, Ticket as TicketIcon, Timer, Trash2, X } from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, formatDate, priorityMeta, relativeDue, statusMeta, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Avatar, Badge, Button, Card, Dropdown, EmptyState, Input, MenuDivider, MenuItem, MenuLabel, Modal, PageHeader, Progress, SearchInput, Select, Skeleton, Tabs, Textarea } from '../components/ui';
import type { Ticket } from '../lib/types';

export default function Tickets() {
  const [params, setParams] = useSearchParams();
  const { canWrite } = useAuth();
  const { push } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [priority, setPriority] = useState('all');
  const [q, setQ] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal', customerId: '', assigneeId: '', teamId: '' });
  const [customers, setCustomers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ tickets: Ticket[]; counts: Record<string, number> }>(`/tickets${qs({ status, priority, q })}`);
      setTickets(d.tickets); setCounts(d.counts);
    } finally { setLoading(false); }
  }, [status, priority, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get<{ users: any[]; teams: any[] }>('/team').then((d) => { setAgents(d.users); setTeams(d.teams); });
    api.get<{ customers: any[] }>('/customers').then((d) => setCustomers(d.customers));
  }, []);

  const openTicket = async (id: string) => {
    try { setDetail(await api.get(`/tickets/${id}`)); } catch (e) { push({ title: 'Could not load ticket', tone: 'error' }); }
  };

  useEffect(() => {
    const id = params.get('id');
    if (id) openTicket(id);
  }, [params]);

  const patch = async (body: Record<string, unknown>, msg?: string) => {
    if (!detail) return;
    try {
      const d = await api.patch<any>(`/tickets/${detail.ticket.id}`, body);
      setDetail({ ...detail, ticket: d.ticket });
      load();
      if (msg) push({ title: msg, tone: 'success' });
    } catch (e) { push({ title: 'Update failed', description: (e as Error).message, tone: 'error' }); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/tickets', { ...form, customerId: form.customerId || undefined, assigneeId: form.assigneeId || undefined, teamId: form.teamId || undefined });
      setCreateOpen(false); setForm({ subject: '', description: '', priority: 'normal', customerId: '', assigneeId: '', teamId: '' });
      push({ title: 'Ticket created', tone: 'success' }); load();
    } catch (e) { push({ title: 'Could not create ticket', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(false); }
  };

  const merge = async () => {
    if (!mergeTarget) return;
    try {
      await api.post(`/tickets/${detail.ticket.id}/merge`, { targetId: mergeTarget });
      push({ title: 'Ticket merged', tone: 'success' }); setDetail(null); load();
    } catch (e) { push({ title: 'Merge failed', description: (e as Error).message, tone: 'error' }); }
  };

  const link = async () => {
    if (!mergeTarget) return;
    try {
      await api.post(`/tickets/${detail.ticket.id}/link`, { targetId: mergeTarget });
      push({ title: 'Tickets linked', tone: 'success' }); openTicket(detail.ticket.id);
    } catch (e) { push({ title: 'Link failed', description: (e as Error).message, tone: 'error' }); }
  };

  const tabs = [
    { value: 'all', label: 'All', count: Object.values(counts).reduce((a, b) => a + b, 0) },
    ...['new', 'open', 'pending', 'on_hold', 'resolved', 'closed'].map((s) => ({ value: s, label: statusMeta[s].label, count: counts[s] || 0 })),
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Tickets" description="Track, prioritise and resolve every support request with SLA accountability."
        actions={<>
          <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)} disabled={!canWrite}>New ticket</Button>
        </>}>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Tabs tabs={tabs} value={status} onChange={(v) => { setStatus(v); const n = new URLSearchParams(params); n.delete('id'); setParams(n); }} />
        </div>
      </PageHeader>

      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search by subject, customer or ticket number…" className="max-w-sm" />
        <Select size="sm" value={priority} onChange={setPriority} className="w-36"
          options={[{ value: 'all', label: 'Any priority' }, { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }]} />
        <span className="ml-auto text-[11px] text-faint">{tickets.length} tickets</span>
      </div>

      <div className="rf-scroll flex-1 p-4">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : tickets.length === 0 ? (
          <EmptyState icon={<TicketIcon className="h-5 w-5" />} title="No tickets match these filters" description="Adjust the status or priority filter, or create a new ticket to get started."
            action={<Button size="sm" variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>New ticket</Button>} />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-surface2/50 text-left text-[10.5px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-2 font-semibold">Ticket</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Priority</th>
                    <th className="px-3 py-2 font-semibold">Assignee</th>
                    <th className="px-3 py-2 font-semibold">SLA</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                    <th className="px-3 py-2 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tickets.map((t) => {
                    const closed = ['resolved', 'closed'].includes(t.status);
                    const due = closed ? { label: 'met', tone: 'slate' as const } : relativeDue(t.dueAt);
                    return (
                      <tr key={t.id} onClick={() => openTicket(t.id)} className="cursor-pointer transition hover:bg-surface2/60">
                        <td className="max-w-[320px] px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <TicketIcon className="h-3 w-3 shrink-0 text-faint" />
                            <span className="shrink-0 font-mono text-[11px] text-faint">#{t.number}</span>
                            <span className="truncate font-medium text-ink">{t.subject}</span>
                          </div>
                          {t.convRef && <div className="mt-0.5 flex items-center gap-1 text-[10px] text-faint"><MessageSquare className="h-2.5 w-2.5" />linked to {t.convRef}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {t.customer && <Avatar name={t.customer.name} color={t.customer.color} size="xs" />}
                            <span className="truncate text-muted">{t.customer?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={statusMeta[t.status]?.tone as any}>{statusMeta[t.status]?.label || t.status}</Badge></td>
                        <td className="px-3 py-2.5"><Badge tone={priorityMeta[t.priority]?.tone as any}>{priorityMeta[t.priority]?.label}</Badge></td>
                        <td className="px-3 py-2.5">
                          {t.assignee ? (
                            <div className="flex items-center gap-1.5"><Avatar name={t.assignee.name} color={t.assignee.color} size="xs" /><span className="truncate text-muted">{t.assignee.name.split(' ')[0]}</span></div>
                          ) : <span className="text-[11px] text-faint">Unassigned</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={t.slaState === 'breached' ? 'red' : t.slaState === 'at_risk' ? 'amber' : t.slaState === 'met' ? 'green' : 'slate'}>
                            {t.slaState.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5"><span className={cn('text-[11px]', due.tone === 'red' ? 'font-medium text-danger' : due.tone === 'amber' ? 'text-warning' : 'text-muted')}>{due.label}</span></td>
                        <td className="px-3 py-2.5 text-[11px] text-faint">{timeAgo(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create ticket" icon={<TicketIcon className="h-4 w-4" />} size="lg"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={create} disabled={!form.subject}>Create ticket</Button></>}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Subject</label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Short description of the issue" /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Description</label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Full context, reproduction steps, order numbers…" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Customer</label>
              <Select value={form.customerId} onChange={(v) => setForm({ ...form, customerId: v })} placeholder="Select customer" options={customers.map((c) => ({ value: c.id, label: c.name }))} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Priority</label>
              <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={Object.entries(priorityMeta).map(([v, m]) => ({ value: v, label: m.label }))} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Assignee</label>
              <Select value={form.assigneeId} onChange={(v) => setForm({ ...form, assigneeId: v })} placeholder="Unassigned" options={agents.map((a) => ({ value: a.id, label: a.name }))} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Team</label>
              <Select value={form.teamId} onChange={(v) => setForm({ ...form, teamId: v })} placeholder="No team" options={teams.map((t) => ({ value: t.id, label: t.name }))} /></div>
          </div>
        </div>
      </Modal>

      {/* detail drawer */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `#${detail.ticket.number} — ${detail.ticket.subject}` : ''} size="xl"
        description={detail ? `${detail.ticket.customer?.name || 'No customer'} · created ${formatDate(detail.ticket.createdAt)}` : ''}
        icon={<TicketIcon className="h-4 w-4" />}
        footer={detail && <>
          <Dropdown width="w-44" trigger={<Button size="sm" variant="secondary" icon={<GitMerge className="h-3.5 w-3.5" />}>Merge / link</Button>}>
            {(close) => (
              <>
                <MenuLabel>Target ticket</MenuLabel>
                <div className="px-1.5 pb-1.5">
                  <Select size="sm" value={mergeTarget} onChange={setMergeTarget} placeholder="Select ticket"
                    options={tickets.filter((t) => t.id !== detail.ticket.id).map((t) => ({ value: t.id, label: `#${t.number} ${t.subject.slice(0, 28)}` }))} />
                </div>
                <MenuItem icon={<GitMerge className="h-3.5 w-3.5" />} onClick={() => { merge(); close(); }} disabled={!mergeTarget}>Merge into target</MenuItem>
                <MenuItem icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => { link(); close(); }} disabled={!mergeTarget}>Link as related</MenuItem>
              </>
            )}
          </Dropdown>
          <Dropdown width="w-40" trigger={<Button size="sm" variant="secondary" icon={<CalendarClock className="h-3.5 w-3.5" />}>Status</Button>}>
            {() => Object.entries(statusMeta).map(([k, v]) => <MenuItem key={k} active={detail.ticket.status === k} onClick={() => patch({ status: k }, `Status set to ${v.label}`)}>{v.label}</MenuItem>)}
          </Dropdown>
          <Button size="sm" variant="primary" onClick={() => { patch({ status: 'resolved' }, 'Ticket resolved'); setDetail(null); }} disabled={!canWrite}>Resolve</Button>
        </>}>
        {detail && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="rounded-xl border border-line bg-surface2/40 p-3">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Description</div>
                <p className="text-[12.5px] leading-relaxed text-ink">{detail.ticket.description || 'No description provided.'}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Status"><Select size="sm" value={detail.ticket.status} onChange={(v) => patch({ status: v }, 'Status updated')} options={Object.entries(statusMeta).map(([v, m]) => ({ value: v, label: m.label }))} /></Field>
                <Field label="Priority"><Select size="sm" value={detail.ticket.priority} onChange={(v) => patch({ priority: v }, 'Priority updated')} options={Object.entries(priorityMeta).map(([v, m]) => ({ value: v, label: m.label }))} /></Field>
                <Field label="Assignee"><Select size="sm" value={detail.ticket.assignee?.id || ''} onChange={(v) => patch({ assigneeId: v || null }, 'Assignee updated')} placeholder="Unassigned" options={agents.map((a) => ({ value: a.id, label: a.name }))} /></Field>
                <Field label="Team"><Select size="sm" value={detail.ticket.team || ''} onChange={(v) => patch({ teamId: v || null }, 'Team updated')} placeholder="No team" options={teams.map((t) => ({ value: t.id, label: t.name }))} /></Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(detail.ticket.customFields || {}).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line px-2.5 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-faint">{k.replace(/_/g, ' ')}</div>
                    <div className="text-[12px] font-medium text-ink">{String(v)}</div>
                  </div>
                ))}
              </div>

              {detail.links?.length > 0 && (
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-1 text-[11px] font-semibold text-ink">Linked tickets</div>
                  {detail.links.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-1.5 py-0.5 text-[11.5px] text-muted">
                      <Link2 className="h-3 w-3" />#{l.number} {l.subject} <Badge tone="slate" className="ml-auto !text-[9px]">{l.link_type}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 text-[11px] font-semibold text-ink">Audit trail</div>
                {detail.audit?.length ? detail.audit.map((a: any) => (
                  <div key={a.id} className="border-t border-line/60 py-1 text-[11px] first:border-0">
                    <span className="font-medium text-ink">{a.action.replace(/\./g, ' ')}</span>
                    <span className="text-faint"> · {a.user_name} · {timeAgo(a.created_at)}</span>
                  </div>
                )) : <p className="text-[11px] text-faint">No activity logged yet.</p>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><Timer className="h-3 w-3" /> SLA tracking</div>
                <div className="flex items-center justify-between text-[11.5px]"><span className="text-muted">State</span><Badge tone={detail.ticket.slaState === 'breached' ? 'red' : detail.ticket.slaState === 'met' ? 'green' : 'amber'}>{detail.ticket.slaState.replace('_', ' ')}</Badge></div>
                <div className="mt-1.5 flex items-center justify-between text-[11.5px]"><span className="text-muted">Due</span><span className="font-medium text-ink">{relativeDue(detail.ticket.dueAt).label}</span></div>
                <div className="mt-2"><Progress value={detail.ticket.slaState === 'met' ? 100 : detail.ticket.slaState === 'breached' ? 100 : 55} tone={detail.ticket.slaState === 'breached' ? 'red' : detail.ticket.slaState === 'met' ? 'green' : 'amber'} /></div>
              </div>
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 text-[11px] font-semibold text-ink">Customer</div>
                <div className="flex items-center gap-2">
                  {detail.ticket.customer && <Avatar name={detail.ticket.customer.name} color={detail.ticket.customer.color} size="sm" />}
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-ink">{detail.ticket.customer?.name || '—'}</div>
                    <div className="truncate text-[10.5px] text-faint">{detail.ticket.customer?.email}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-line p-3 text-[11.5px]">
                <div className="mb-1 text-[11px] font-semibold text-ink">Metadata</div>
                <Row k="Source" v={detail.ticket.source} />
                <Row k="Created" v={formatDate(detail.ticket.createdAt)} />
                <Row k="Resolved" v={detail.ticket.resolvedAt ? formatDate(detail.ticket.resolvedAt) : '—'} />
                <Row k="Conversation" v={detail.ticket.convRef || '—'} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-faint">{label}</label>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between border-t border-line/60 py-0.5 first:border-0"><span className="text-muted">{k}</span><span className="font-medium capitalize text-ink">{v}</span></div>;
}
