import { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowRight, Bot, Clock, GitBranch, Play, Plus, Save, Sparkles, Trash2, Workflow, X, Zap,
  CheckCircle2, AlarmClock, Users, Tags, Bell, Star, Gauge, MailQuestion, MessageSquare, TrendingUp, Copy,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Badge, Button, Card, CardHeader, Dropdown, EmptyState, Input, MenuItem, MenuLabel, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, Toggle } from '../components/ui';
import type { Automation } from '../lib/types';

const TRIGGERS = [
  { value: 'new_conversation', label: 'When a new conversation is created', icon: MessageSquare },
  { value: 'new_message', label: 'When a new message arrives', icon: MailQuestion },
  { value: 'status_change', label: 'When status changes', icon: GitBranch },
  { value: 'sla_breach', label: 'When an SLA is breached', icon: AlarmClock },
  { value: 'keyword', label: 'When a message contains keywords', icon: Tags },
  { value: 'schedule', label: 'On a schedule', icon: Clock },
];

const CONDITION_FIELDS = [
  { value: 'channel_type', label: 'Channel' }, { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' }, { value: 'customer_tag', label: 'Customer tag' },
  { value: 'assignee', label: 'Assignee' }, { value: 'team', label: 'Team' },
  { value: 'body', label: 'Message body' }, { value: 'customer_ltv', label: 'Customer lifetime value' },
];
const OPERATORS = [
  { value: 'equals', label: 'equals' }, { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' }, { value: 'contains_keyword', label: 'contains keyword' },
  { value: 'in', label: 'is one of' }, { value: 'is_empty', label: 'is empty' }, { value: 'greater_than', label: 'is greater than' },
];
const ACTIONS = [
  { value: 'assign_user', label: 'Assign to agent', icon: Users },
  { value: 'assign_team', label: 'Assign to team', icon: Users },
  { value: 'assign_round_robin', label: 'Round-robin assign team', icon: Users },
  { value: 'set_priority', label: 'Set priority', icon: Gauge },
  { value: 'add_tag', label: 'Add tag', icon: Tags },
  { value: 'star', label: 'Star conversation', icon: Star },
  { value: 'notify_manager', label: 'Notify manager', icon: Bell },
  { value: 'notify_assignee', label: 'Notify assignee', icon: Bell },
  { value: 'send_auto_reply', label: 'Send auto-acknowledgement', icon: MessageSquare },
  { value: 'send_csat', label: 'Send CSAT survey', icon: TrendingUp },
  { value: 'wait', label: 'Wait (delay in minutes)', icon: Clock },
  { value: 'snooze', label: 'Snooze conversation', icon: Clock },
];

export default function Automations() {
  const { canWrite } = useAuth();
  const { push } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('builder');
  const [editing, setEditing] = useState<Automation | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<{ automations: Automation[]; runs: any[] }>('/automations')
      .then((d) => { setAutomations(d.automations); setRuns(d.runs); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get<any>('/team').then((d) => { setAgents(d.users); setTeams(d.teams); });
  }, []);

  const toggle = async (a: Automation) => {
    await api.patch(`/automations/${a.id}`, { enabled: !a.enabled });
    load();
    push({ title: `${a.name} ${a.enabled ? 'paused' : 'activated'}`, tone: 'success' });
  };

  const runTest = async (a: Automation) => {
    setBusy(a.id);
    try { const d = await api.post<any>(`/automations/${a.id}/test`); setTestResult({ ...d, name: a.name }); load(); }
    catch (e) { push({ title: 'Test failed', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(null); }
  };

  const blank = (): Automation => ({
    id: '', name: '', description: '', enabled: true, triggerType: 'new_conversation', triggerConfig: {},
    conditions: [], actions: [{ type: 'set_priority', value: 'high' }], runCount: 0, isDemo: false,
  });

  const saveAutomation = async (a: Automation) => {
    try {
      if (a.id) await api.patch(`/automations/${a.id}`, a);
      else await api.post('/automations', a);
      push({ title: 'Automation saved', description: a.enabled ? 'It is live and running.' : 'Saved as paused.', tone: 'success' });
      setEditing(null); load();
    } catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
  };

  const deleteAutomation = async (a: Automation) => {
    await api.del(`/automations/${a.id}`); setEditing(null); load();
    push({ title: 'Automation deleted', tone: 'info' });
  };

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Automations" description="No-code workflows with WHEN → IF → THEN logic. Turn busywork into policy."
        actions={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing(blank())} disabled={!canWrite}>New automation</Button>}>
        <div className="mt-2.5"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'builder', label: 'Workflows', count: automations.length },
          { value: 'runs', label: 'Run history', count: runs.length },
          { value: 'library', label: 'Templates' },
        ]} /></div>
      </PageHeader>

      <div className="p-4 sm:p-6">
        {tab === 'builder' && (
          loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            : automations.length === 0 ? <EmptyState icon={<Workflow className="h-5 w-5" />} title="No automations yet" description="Create your first workflow to route, prioritise and escalate automatically."
              action={<Button size="sm" variant="primary" onClick={() => setEditing(blank())} icon={<Plus className="h-3.5 w-3.5" />}>New automation</Button>} />
            : (
              <div className="space-y-2.5">
                {automations.map((a) => {
                  const Trigger = TRIGGERS.find((t) => t.value === a.triggerType)?.icon || Zap;
                  return (
                    <Card key={a.id} className={cn('p-3.5 transition', !a.enabled && 'opacity-70')}>
                      <div className="flex items-start gap-3">
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', a.enabled ? 'bg-teal/10 text-teal' : 'bg-surface2 text-faint')}>
                          <Trigger className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-[13px] font-semibold text-ink">{a.name}</h3>
                            <Badge tone={a.enabled ? 'green' : 'slate'} dot>{a.enabled ? 'Active' : 'Paused'}</Badge>
                            {a.isDemo && <Badge tone="teal">demo</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-muted">{a.description}</p>

                          {/* flow strip */}
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[10.5px]">
                            <span className="flex items-center gap-1 rounded-md bg-info/10 px-1.5 py-0.5 font-semibold text-info">WHEN</span>
                            <span className="rounded-md bg-surface2 px-1.5 py-0.5 text-muted">{TRIGGERS.find((t) => t.value === a.triggerType)?.label.replace('When', '').trim()}</span>
                            {a.conditions.map((c, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <ArrowRight className="h-2.5 w-2.5 text-faint" />
                                <span className="rounded-md bg-warning/12 px-1.5 py-0.5 font-semibold text-warning">IF</span>
                                <span className="rounded-md bg-surface2 px-1.5 py-0.5 text-muted">{c.field.replace('_', ' ')} {c.op.replace('_', ' ')} {c.value}</span>
                              </span>
                            ))}
                            {a.actions.map((ac, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <ArrowRight className="h-2.5 w-2.5 text-faint" />
                                <span className="rounded-md bg-teal/12 px-1.5 py-0.5 font-semibold text-teal">THEN</span>
                                <span className="rounded-md bg-surface2 px-1.5 py-0.5 text-muted">{ac.type.replace(/_/g, ' ')}{ac.value ? ` → ${ac.value}` : ''}</span>
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 flex items-center gap-3 text-[10px] text-faint">
                            <span>{a.runCount.toLocaleString()} runs</span>
                            {a.lastRunAt && <span>last run {timeAgo(a.lastRunAt)}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Toggle checked={a.enabled} onChange={() => toggle(a)} disabled={!canWrite} />
                          <div className="flex items-center gap-1">
                            <Button size="xs" variant="ghost" icon={<Play className="h-3 w-3" />} loading={busy === a.id} onClick={() => runTest(a)}>Test</Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditing({ ...a })} disabled={!canWrite}>Edit</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
        )}

        {tab === 'runs' && (
          <Card className="overflow-hidden">
            <CardHeader title="Recent runs" subtitle="Every execution with its outcome" icon={<Clock className="h-4 w-4" />} />
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2 font-semibold">Automation</th><th className="px-3 py-2 font-semibold">Conversation</th><th className="px-3 py-2 font-semibold">Result</th><th className="px-3 py-2 font-semibold">Log</th><th className="px-3 py-2 font-semibold">When</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-surface2/50">
                      <td className="px-4 py-2 font-medium text-ink">{r.automation}</td>
                      <td className="px-3 py-2 text-muted">{r.conversation || '—'}</td>
                      <td className="px-3 py-2"><Badge tone={r.status === 'success' ? 'green' : r.status === 'skipped' ? 'slate' : 'red'}>{r.status}</Badge></td>
                      <td className="px-3 py-2 text-[11px] text-faint">{r.log}</td>
                      <td className="px-3 py-2 text-[11px] text-faint">{timeAgo(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'library' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Route marketplace messages', 'Send Amazon, eBay, Etsy and Walmart messages to the Marketplace Desk', 'new_conversation', [{ type: 'assign_team', value: 'team_market' }, { type: 'set_priority', value: 'high' }]],
              ['Urgent keyword escalation', 'Refund, chargeback, legal or outage keywords become Urgent instantly', 'new_message', [{ type: 'set_priority', value: 'urgent' }, { type: 'notify_manager', value: 'usr_amina' }]],
              ['No-reply reminder', 'Nudge the assignee after two hours without a response', 'sla_breach', [{ type: 'wait', value: '120' }, { type: 'notify_assignee', value: 'No reply in 2 hours' }]],
              ['VIP concierge', 'Route VIP-tagged customers to the senior desk and star the thread', 'new_conversation', [{ type: 'assign_user', value: 'usr_amina' }, { type: 'star' }]],
              ['CSAT on resolve', 'Send a one-question satisfaction survey when resolved', 'status_change', [{ type: 'send_csat' }]],
              ['Round-robin chat', 'Distribute website chats evenly across the chat crew', 'new_conversation', [{ type: 'assign_round_robin', value: 'team_chat' }]],
            ].map(([name, desc, trigger, actions]: any) => (
              <Card key={name} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal"><Sparkles className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[12.5px] font-semibold text-ink">{name}</h4>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
                    <p className="mt-1.5 text-[10px] text-faint">{actions.length} actions · trigger: {trigger.replace('_', ' ')}</p>
                  </div>
                </div>
                <Button size="xs" className="mt-2.5 w-full" icon={<Plus className="h-3 w-3" />} disabled={!canWrite}
                  onClick={() => setEditing({ id: '', name, description: desc, enabled: false, triggerType: trigger, triggerConfig: {}, conditions: [], actions, runCount: 0, isDemo: true })}>
                  Use template
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* builder modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit automation' : 'New automation'} icon={<Workflow className="h-4 w-4" />} size="xl"
        description="WHEN something happens, IF conditions match, THEN take these actions."
        footer={<>
          {editing?.id && <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => editing && deleteAutomation(editing)}>Delete</Button>}
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" icon={<Save className="h-3.5 w-3.5" />} onClick={() => editing && saveAutomation(editing)} disabled={!editing?.name}>Save automation</Button>
        </>}>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Name</label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Escalate VIP refunds" /></div>
              <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Status</label>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-line px-3"><Toggle checked={editing.enabled} onChange={(v) => setEditing({ ...editing, enabled: v })} /><span className="text-[12px] text-ink">{editing.enabled ? 'Active' : 'Paused'}</span></div></div>
            </div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Description</label>
              <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What does this automation do and why?" /></div>

            {/* WHEN */}
            <div className="rounded-xl border border-info/30 bg-info/[0.04] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-info"><Zap className="h-3.5 w-3.5" /> WHEN</div>
              <Select value={editing.triggerType} onChange={(v) => setEditing({ ...editing, triggerType: v })}
                options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))} />
              {editing.triggerType === 'new_message' && (
                <div className="mt-2"><Input value={(editing.triggerConfig.keywords || []).join(', ')} placeholder="Keywords, comma separated"
                  onChange={(e) => setEditing({ ...editing, triggerConfig: { ...editing.triggerConfig, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) } })} /></div>
              )}
              {editing.triggerType === 'status_change' && (
                <div className="mt-2"><Select value={editing.triggerConfig.to || 'resolved'} onChange={(v) => setEditing({ ...editing, triggerConfig: { ...editing.triggerConfig, to: v } })}
                  options={['new', 'open', 'pending', 'on_hold', 'resolved', 'closed'].map((s) => ({ value: s, label: `changes to ${s}` }))} /></div>
              )}
            </div>

            {/* IF */}
            <div className="rounded-xl border border-warning/30 bg-warning/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-warning"><GitBranch className="h-3.5 w-3.5" /> IF</div>
                <Button size="xs" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={() => setEditing({ ...editing, conditions: [...editing.conditions, { field: 'channel_type', op: 'equals', value: 'email' }] })}>Add condition</Button>
              </div>
              {editing.conditions.length === 0 && <p className="text-[11px] text-muted">No conditions — this runs for every matching trigger.</p>}
              <div className="space-y-1.5">
                {editing.conditions.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <Select size="sm" className="w-[130px]" value={c.field} onChange={(v) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, field: v } : x)) })} options={CONDITION_FIELDS} />
                    <Select size="sm" className="w-[130px]" value={c.op} onChange={(v) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, op: v } : x)) })} options={OPERATORS} />
                    <Input className="!h-8 w-[140px] !text-[12px]" value={c.value || ''} onChange={(e) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="value" />
                    <button onClick={() => setEditing({ ...editing, conditions: editing.conditions.filter((_, j) => j !== i) })} className="rounded p-1 text-faint hover:bg-surface hover:text-danger"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* THEN */}
            <div className="rounded-xl border border-teal/30 bg-teal/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-teal"><ArrowRight className="h-3.5 w-3.5" /> THEN</div>
                <Button size="xs" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={() => setEditing({ ...editing, actions: [...editing.actions, { type: 'add_tag', value: '' }] })}>Add action</Button>
              </div>
              <div className="space-y-1.5">
                {editing.actions.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <Select size="sm" className="w-[190px]" value={a.type} onChange={(v) => setEditing({ ...editing, actions: editing.actions.map((x, j) => (j === i ? { ...x, type: v } : x)) })}
                      options={ACTIONS.map((x) => ({ value: x.value, label: x.label }))} />
                    {['assign_user', 'notify_manager'].includes(a.type) && (
                      <Select size="sm" className="w-[150px]" value={a.value || ''} onChange={(v) => setEditing({ ...editing, actions: editing.actions.map((x, j) => (j === i ? { ...x, value: v } : x)) })}
                        placeholder="Select agent" options={agents.map((ag) => ({ value: ag.id, label: ag.name }))} />
                    )}
                    {['assign_team', 'assign_round_robin'].includes(a.type) && (
                      <Select size="sm" className="w-[150px]" value={a.value || ''} onChange={(v) => setEditing({ ...editing, actions: editing.actions.map((x, j) => (j === i ? { ...x, value: v } : x)) })}
                        placeholder="Select team" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
                    )}
                    {a.type === 'set_priority' && (
                      <Select size="sm" className="w-[120px]" value={a.value || 'normal'} onChange={(v) => setEditing({ ...editing, actions: editing.actions.map((x, j) => (j === i ? { ...x, value: v } : x)) })}
                        options={['low', 'normal', 'high', 'urgent'].map((p) => ({ value: p, label: p }))} />
                    )}
                    {['add_tag', 'wait', 'notify_assignee', 'send_auto_reply'].includes(a.type) && (
                      <Input className="!h-8 w-[150px] !text-[12px]" value={a.value || ''} placeholder={a.type === 'wait' ? 'minutes' : 'value'} onChange={(e) => setEditing({ ...editing, actions: editing.actions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                    )}
                    <button onClick={() => setEditing({ ...editing, actions: editing.actions.filter((_, j) => j !== i) })} className="rounded p-1 text-faint hover:bg-surface hover:text-danger"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
            <Alert tone="info">Workflows are evaluated in order. Delays run as background jobs and survive restarts.</Alert>
          </div>
        )}
      </Modal>

      {/* test result */}
      <Modal open={!!testResult} onClose={() => setTestResult(null)} title={`Dry run — ${testResult?.name || ''}`} icon={<Play className="h-4 w-4" />} size="md"
        description={testResult?.conversation ? `Evaluated against ${testResult.conversation.ref}: ${testResult.conversation.subject}` : ''}
        footer={<Button variant="primary" onClick={() => setTestResult(null)}>Done</Button>}>
        <div className="space-y-1.5">
          {testResult?.steps?.map((s: any, i: number) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface2/40 px-2.5 py-1.5">
              <Badge tone={s.step === 'WHEN' ? 'blue' : s.step === 'IF' ? 'amber' : 'teal'} className="!text-[9.5px]">{s.step}</Badge>
              <span className="flex-1 text-[11.5px] text-ink">{s.detail}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
          ))}
          <p className="pt-1 text-[10.5px] text-faint">Dry runs evaluate real data but do not mutate the conversation.</p>
        </div>
      </Modal>
    </div>
  );
}
