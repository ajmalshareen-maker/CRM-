import { useCallback, useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock, Download, FileSpreadsheet, Star, Ticket, Timer, TrendingUp, Users, Target } from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, duration, formatDate, statusMeta } from '../lib/utils';
import { useToast } from '../lib/store';
import { Badge, Button, Card, CardHeader, Dropdown, MenuItem, MenuLabel, PageHeader, Progress, Select, Skeleton, Tabs } from '../components/ui';

const RANGE_LABEL: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

export default function Reports() {
  const { push } = useToast();
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const load = useCallback(() => {
    setLoading(true);
    api.get<any>(`/reports${qs({ range })}`).then(setData).finally(() => setLoading(false));
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = (type: string) => {
    api.download(`/reports/export${qs({ type })}`);
    push({ title: 'Export started', description: `Your ${type} CSV is downloading.`, tone: 'success' });
  };

  const k = data?.kpis;

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Reports & Analytics" description="Understand volume, speed, quality and team capacity across every channel."
        actions={<>
          <Select size="sm" value={range} onChange={setRange} className="w-36" options={Object.entries(RANGE_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          <Dropdown width="w-52" trigger={<Button size="sm" variant="primary" icon={<Download className="h-3.5 w-3.5" />}>Export CSV</Button>}>
            {(close) => (
              <>
                <MenuLabel>Export data</MenuLabel>
                <MenuItem icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={() => { exportCsv('conversations'); close(); }}>Conversations</MenuItem>
                <MenuItem icon={<Ticket className="h-3.5 w-3.5" />} onClick={() => { exportCsv('tickets'); close(); }}>Tickets</MenuItem>
                <MenuItem icon={<Users className="h-3.5 w-3.5" />} onClick={() => { exportCsv('agents'); close(); }}>Agent performance</MenuItem>
                <MenuItem icon={<Users className="h-3.5 w-3.5" />} onClick={() => { exportCsv('customers'); close(); }}>Customers</MenuItem>
              </>
            )}
          </Dropdown>
        </>}>
        <div className="mt-2.5"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'overview', label: 'Overview' }, { value: 'channels', label: 'Channels' }, { value: 'agents', label: 'Agents' }, { value: 'sla', label: 'SLA & quality' },
        ]} /></div>
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Incoming conversations', loading ? null : k?.conversations, TrendingUp, 'teal', `${k?.inbound ?? 0} inbound messages`],
            ['Outgoing replies', loading ? null : k?.outbound, CheckCircle2, 'blue', 'Across all channels'],
            ['Avg first response', loading ? null : duration(k?.frt), Timer, 'green', 'Target under 60m'],
            ['Avg resolution', loading ? null : duration(k?.art), Clock, 'violet', 'Target under 24h'],
          ].map(([l, v, Icon, tone, hint]: any) => (
            <Card key={l} className="p-3.5">
              <div className="flex items-start justify-between">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg',
                  tone === 'teal' ? 'bg-teal/10 text-teal' : tone === 'blue' ? 'bg-info/10 text-info' : tone === 'green' ? 'bg-success/10 text-success' : 'bg-violet/12 text-violet')}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-2 text-[21px] font-semibold leading-none text-ink">{v == null ? <Skeleton className="h-5 w-12" /> : v}</div>
              <div className="mt-1 text-[11.5px] font-medium text-muted">{l}</div>
              <div className="text-[10px] text-faint">{hint}</div>
            </Card>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <Card>
              <CardHeader title="Conversation volume & resolutions" subtitle={`${RANGE_LABEL[range]} · daily`} icon={<BarChart3 className="h-4 w-4" />} />
              <div className="h-[280px] px-2 pb-2 pt-3">
                {loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4C7DF0" stopOpacity={0.24} /><stop offset="100%" stopColor="#4C7DF0" stopOpacity={0} /></linearGradient>
                        <linearGradient id="r2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A673" stopOpacity={0.24} /><stop offset="100%" stopColor="#16A673" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="var(--rf-border)" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <RTooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#4C7DF0" fill="url(#r1)" strokeWidth={2} />
                      <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#16A673" fill="url(#r2)" strokeWidth={2} />
                      <Line type="monotone" dataKey="replies" name="Replies" stroke="#21B8A6" strokeWidth={1.6} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title="CSAT distribution" subtitle="Satisfaction survey scores" icon={<Star className="h-4 w-4" />} />
                <div className="h-[200px] px-2 pt-3">
                  {loading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.csatDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 6" stroke="var(--rf-border)" vertical={false} />
                        <XAxis dataKey="score" tickLine={false} axisLine={false} tickFormatter={(v) => `${v} ★`} />
                        <YAxis tickLine={false} axisLine={false} width={22} allowDecimals={false} />
                        <RTooltip content={<Tip />} />
                        <Bar dataKey="count" name="Responses" radius={[6, 6, 0, 0]}>
                          {data.csatDistribution.map((d: any) => (
                            <Cell key={d.score} fill={d.score >= 4 ? '#16A673' : d.score === 3 ? '#F0A43C' : '#E45B65'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="border-t border-line px-4 py-2 text-[11.5px] text-muted">
                  Average score <span className="font-semibold text-ink">{k?.csat ?? '—'} / 5</span>
                </div>
              </Card>

              <Card>
                <CardHeader title="Ticket mix" subtitle="Status and priority" icon={<Ticket className="h-4 w-4" />} />
                <div className="space-y-2 p-4">
                  {(data?.ticketsByStatus || []).map((t: any) => {
                    const total = data.ticketsByStatus.reduce((a: number, b: any) => a + b.value, 0) || 1;
                    return (
                      <div key={t.name}>
                        <div className="mb-0.5 flex items-center justify-between text-[11.5px]">
                          <span className="capitalize text-ink">{statusMeta[t.name]?.label || t.name}</span>
                          <span className="tabular-nums text-muted">{t.value}</span>
                        </div>
                        <Progress value={(t.value / total) * 100} tone={t.name === 'resolved' ? 'green' : t.name === 'pending' ? 'amber' : 'teal'} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <CardHeader title="SLA compliance" subtitle="Target 95%" icon={<Target className="h-4 w-4" />} />
                <div className="flex flex-col items-center p-4">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--rf-surface-2)" strokeWidth="12" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke={k?.slaCompliance >= 95 ? '#16A673' : k?.slaCompliance >= 80 ? '#F0A43C' : '#E45B65'}
                        strokeWidth="12" strokeLinecap="round" strokeDasharray={`${((k?.slaCompliance || 0) / 100) * 327} 327`} />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-[24px] font-semibold leading-none text-ink">{k?.slaCompliance ?? '—'}%</div>
                      <div className="text-[10px] text-faint">within SLA</div>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-muted">{k?.unresolved ?? 0} unresolved conversations in this range.</p>
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 'channels' && (
          <Card>
            <CardHeader title="Channel performance" subtitle="Volume, resolution and first-response time by channel" icon={<BarChart3 className="h-4 w-4" />} />
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2 font-semibold">Channel</th><th className="px-3 py-2 text-right font-semibold">Conversations</th>
                  <th className="px-3 py-2 text-right font-semibold">Resolved</th><th className="px-3 py-2 text-right font-semibold">Resolution rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Avg FRT</th><th className="px-3 py-2 font-semibold">Volume</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {(data?.channels || []).map((c: any) => {
                    const rate = c.total ? Math.round((c.resolved / c.total) * 100) : 0;
                    const max = Math.max(...(data?.channels || []).map((x: any) => x.total), 1);
                    return (
                      <tr key={c.name} className="hover:bg-surface2/50">
                        <td className="px-4 py-2.5 font-medium capitalize text-ink">{c.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink">{c.total}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{c.resolved}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{rate}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{c.frt ? duration(c.frt) : '—'}</td>
                        <td className="px-3 py-2.5"><Progress value={(c.total / max) * 100} className="w-28" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'agents' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader title="Agent productivity" subtitle="Assigned, resolved, replies and satisfaction" icon={<Users className="h-4 w-4" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-2 font-semibold">Agent</th><th className="px-3 py-2 text-right font-semibold">Assigned</th>
                    <th className="px-3 py-2 text-right font-semibold">Resolved</th><th className="px-3 py-2 text-right font-semibold">Replies</th>
                    <th className="px-3 py-2 text-right font-semibold">FRT</th><th className="px-3 py-2 text-right font-semibold">CSAT</th>
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {(data?.agents || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-surface2/50">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full" style={{ background: a.color }} /><span className="font-medium text-ink">{a.name}</span></div></td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink">{a.assigned}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.resolved}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.replies}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.frt ? duration(a.frt) : '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.csat ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHeader title="Team balance" subtitle="Relative reply volume" icon={<Users className="h-4 w-4" />} />
              <div className="h-[260px]">
                {loading ? <Skeleton className="m-3 h-[220px]" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data.agents.slice(0, 6).map((a: any) => ({ name: a.name.split(' ')[0], replies: a.replies, resolved: a.resolved }))}>
                      <PolarGrid stroke="var(--rf-border)" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--rf-muted)' }} />
                      <Radar dataKey="replies" stroke="#21B8A6" fill="#21B8A6" fillOpacity={0.28} />
                      <Radar dataKey="resolved" stroke="#4C7DF0" fill="#4C7DF0" fillOpacity={0.16} />
                      <RTooltip content={<Tip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === 'sla' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="SLA breaches over time" subtitle="Daily breach count" icon={<Target className="h-4 w-4" />} />
              <div className="h-[240px] px-2 pt-3">
                {loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="var(--rf-border)" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                      <RTooltip content={<Tip />} />
                      <Bar dataKey="breaches" name="Breaches" fill="#E45B65" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Quality summary" subtitle="Satisfaction and compliance" icon={<Star className="h-4 w-4" />} />
              <div className="space-y-3 p-4">
                {[
                  ['SLA compliance', `${k?.slaCompliance ?? 100}%`, k?.slaCompliance ?? 100, 'teal'],
                  ['CSAT score', `${k?.csat ?? '—'} / 5`, ((k?.csat || 0) / 5) * 100, 'green'],
                  ['Unresolved share', `${data?.kpis?.unresolved ?? 0} conversations`, 100 - ((k?.unresolved || 0) / Math.max(1, k?.conversations || 1)) * 100, 'amber'],
                ].map(([l, v, pct, tone]: any) => (
                  <div key={l}>
                    <div className="mb-1 flex items-center justify-between text-[12px]"><span className="text-ink">{l}</span><span className="font-semibold tabular-nums text-ink">{v}</span></div>
                    <Progress value={pct} tone={tone} />
                  </div>
                ))}
                <div className="rounded-lg border border-line bg-surface2/40 p-2.5 text-[11px] text-muted">
                  Export this report as CSV for board reporting or your data warehouse. All timestamps are UTC and every row is scoped to your workspace.
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lift">
      {label && <div className="mb-1 text-[10.5px] font-semibold capitalize text-ink">{String(label).length > 12 ? formatDate(label) : label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize text-muted">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-ink">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
