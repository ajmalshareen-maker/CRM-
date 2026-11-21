import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Clock, Inbox, MessageSquare,
  Sparkles, Star, Timer, TrendingUp, TriangleAlert, UserX, Users, Zap, Target, Ticket, Flame,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, compact, duration, formatDate, money, priorityMeta, statusMeta, timeAgo } from '../lib/utils';
import { Avatar, Badge, Button, Card, CardHeader, Dropdown, MenuItem, MenuLabel, PageHeader, Progress, Skeleton } from '../components/ui';
import { ChannelIcon } from '../components/ChannelIcon';
import { useAuth } from '../lib/store';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

const CHANNEL_COLORS: Record<string, string> = {
  email: '#4C7DF0', chat: '#21B8A6', whatsapp: '#25A65B', instagram: '#D6487E', messenger: '#2D7FF9',
  telegram: '#2AABEE', amazon: '#F0A43C', ebay: '#3B7BB8', etsy: '#D2603A', walmart: '#2E77BC',
  shopify: '#5E8E3E', tiktok: '#172B4D',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('7d');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    api.get<any>(`/dashboard${qs({ range, from, to })}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [range, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const k = data?.kpis;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <div className="rf-scroll h-full">
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0]}`}
        description="Here is how your support operation is performing right now."
        badge={<Badge tone="teal" dot>Live</Badge>}
        actions={
          <>
            <Dropdown width="w-48" trigger={
              <Button size="sm" icon={<CalendarDays className="h-3.5 w-3.5" />}>
                {RANGES.find((r) => r.value === range)?.label}
              </Button>
            }>
              {(close) => (
                <>
                  <MenuLabel>Date range</MenuLabel>
                  {RANGES.map((r) => (
                    <MenuItem key={r.value} active={range === r.value} onClick={() => { setRange(r.value); close(); }}>{r.label}</MenuItem>
                  ))}
                </>
              )}
            </Dropdown>
            <Button size="sm" variant="primary" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => navigate('/ai')}>AI insights</Button>
          </>
        }
      >
        {data?.trends?.period && (
          <p className="mt-1 text-[10.5px] text-faint">
            Trends compare against the previous equal period ({formatDate(data.trends.period.start)} – {formatDate(data.trends.period.end)}).
          </p>
        )}
        {range === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink" />
            <span className="text-[11px] text-faint">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink" />
          </div>
        )}
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total conversations" value={loading ? null : compact(k?.totalConversations)} icon={<Inbox className="h-3.5 w-3.5" />} trend={data?.trends?.totalConversations} tone="teal" hint={`${k?.resolvedInRange ?? 0} resolved in range`} onClick={() => navigate('/conversations')} />
          <KpiCard label="Open tickets" value={loading ? null : k?.openTickets} icon={<Ticket className="h-3.5 w-3.5" />} tone="blue" hint={`${k?.pending ?? 0} pending responses`} onClick={() => navigate('/tickets?status=open')} />
          <KpiCard label="Unassigned" value={loading ? null : k?.unassigned} icon={<UserX className="h-3.5 w-3.5" />} tone="amber" hint="Waiting for triage" onClick={() => navigate('/inbox?view=unassigned')} />
          <KpiCard label="Pending responses" value={loading ? null : k?.pending} icon={<Clock className="h-3.5 w-3.5" />} tone="violet" hint="Customer replied last" onClick={() => navigate('/inbox?view=pending')} />
          <KpiCard label="Avg first response" value={loading ? null : duration(k?.avgFirstResponseMins)} icon={<Timer className="h-3.5 w-3.5" />} trend={data?.trends?.avgFirstResponseMins} tone="teal" hint="Target: under 60m" good />
          <KpiCard label="Avg resolution time" value={loading ? null : duration(k?.avgResolutionMins)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} trend={data?.trends?.avgResolutionMins} tone="blue" hint="Across all channels" good />
          <KpiCard label="CSAT score" value={loading ? null : (k?.csat ?? '—')} suffix={k?.csat ? '/ 5.0' : ''} icon={<Star className="h-3.5 w-3.5" />} trend={data?.trends?.csat} tone="green" hint={`${k?.csatResponses ?? 0} survey responses`} good />
          <KpiCard label="SLA compliance" value={loading ? null : `${k?.slaCompliance ?? 100}%`} icon={<Target className="h-3.5 w-3.5" />} tone={k?.slaBreaches > 3 ? 'amber' : 'green'} hint={`${k?.slaBreaches ?? 0} breaches open`} />
        </div>

        {/* charts row */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Conversations over time" subtitle="Incoming conversations, outbound replies and resolutions"
              icon={<TrendingUp className="h-4 w-4" />}
              action={
                <div className="flex items-center gap-3 text-[11px] text-muted">
                  <Legend2 color="#21B8A6" label="Incoming" />
                  <Legend2 color="#4C7DF0" label="Replies" />
                  <Legend2 color="#16A673" label="Resolved" />
                </div>
              } />
            <div className="h-[248px] w-full px-2 pb-2 pt-3">
              {loading ? <div className="flex h-full items-center justify-center"><Skeleton className="h-full w-full" /></div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#21B8A6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#21B8A6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4C7DF0" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#4C7DF0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--rf-border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <RTooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="incoming" stroke="#21B8A6" strokeWidth={2} fill="url(#gIn)" name="Incoming" />
                    <Area type="monotone" dataKey="replies" stroke="#4C7DF0" strokeWidth={2} fill="url(#gRep)" name="Replies" />
                    <Line type="monotone" dataKey="resolved" stroke="#16A673" strokeWidth={2} dot={false} name="Resolved" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Channel performance" subtitle="Conversations by channel" icon={<MessageSquare className="h-4 w-4" />} />
            <div className="h-[248px] w-full">
              {loading ? <div className="p-4"><Skeleton className="h-[200px] w-full" /></div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byChannel} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {data.byChannel.map((entry: any) => (
                        <Cell key={entry.name} fill={CHANNEL_COLORS[entry.name] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 pb-4">
              {(data?.byChannel || []).slice(0, 6).map((c: any) => (
                <span key={c.name} className="flex items-center gap-1.5 text-[11px] capitalize text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLORS[c.name] || '#94A3B8' }} />
                  {c.name} <span className="font-semibold text-ink">{c.value}</span>
                </span>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* status distribution */}
          <Card>
            <CardHeader title="Ticket status" subtitle="Current distribution" icon={<Ticket className="h-4 w-4" />} />
            <div className="space-y-3 p-4">
              {(data?.byStatus || []).map((s: any) => {
                const total = data.byStatus.reduce((a: number, b: any) => a + b.value, 0) || 1;
                const pct = Math.round((s.value / total) * 100);
                const tone = s.name === 'resolved' ? 'green' : s.name === 'closed' ? 'slate' : s.name === 'pending' ? 'amber' : s.name === 'on_hold' ? 'violet' : 'teal';
                return (
                  <div key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-1.5 capitalize text-ink"><Badge tone={tone as any}>{statusMeta[s.name]?.label || s.name}</Badge></span>
                      <span className="tabular-nums text-muted">{s.value} · {pct}%</span>
                    </div>
                    <Progress value={pct} tone={tone as any} />
                  </div>
                );
              })}
              {!loading && !data?.byStatus?.length && <p className="py-6 text-center text-[12px] text-muted">No conversations in this range.</p>}
            </div>
          </Card>

          {/* leaderboard */}
          <Card>
            <CardHeader title="Agent performance" subtitle="Ranked by resolved conversations" icon={<Users className="h-4 w-4" />}
              action={<Button variant="link" size="xs" onClick={() => navigate('/reports')}>View report</Button>} />
            <div className="divide-y divide-line">
              {(data?.leaderboard || []).map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                    i === 0 ? 'bg-warning/15 text-warning' : i === 1 ? 'bg-muted/15 text-muted' : i === 2 ? 'bg-[#C1793F]/15 text-[#C1793F]' : 'bg-surface2 text-faint')}>{i + 1}</span>
                  <Avatar name={a.name} color={a.color} size="sm" status={a.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{a.name}</div>
                    <div className="text-[10.5px] text-faint">{a.resolved} resolved · {a.open} open</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-0.5 text-[12px] font-semibold text-ink">
                      <Star className="h-3 w-3 fill-warning text-warning" />{a.csat ?? '—'}
                    </div>
                    <div className="text-[10px] text-faint">{a.frt ? duration(a.frt) : '—'} FRT</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* priority alerts */}
          <Card>
            <CardHeader title="Priority alerts" subtitle="SLA risk and escalations" icon={<TriangleAlert className="h-4 w-4" />}
              action={<Badge tone="red">{data?.alerts?.length || 0}</Badge>} />
            <div className="divide-y divide-line">
              {(data?.alerts || []).map((a: any) => (
                <button key={a.id} onClick={() => navigate(`/inbox?c=${a.id}`)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-surface2">
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    a.slaState === 'breached' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning')}>
                    {a.slaState === 'breached' ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{a.subject}</span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <Badge tone={priorityMeta[a.priority]?.tone as any}>{a.priority}</Badge>
                      <span className="text-[10.5px] text-faint">{a.ref} · {a.slaState.replace('_', ' ')}</span>
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-faint" />
                </button>
              ))}
              {!loading && !data?.alerts?.length && <div className="px-4 py-8 text-center text-[12px] text-muted">No SLA risks. Nice work.</div>}
            </div>
          </Card>
        </div>

        {/* recent + activity */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Recent conversations" subtitle="Latest activity across every channel" icon={<Inbox className="h-4 w-4" />}
              action={<Button variant="link" size="xs" onClick={() => navigate('/inbox')}>Open inbox</Button>} />
            <div className="divide-y divide-line">
              {(data?.recent || []).map((c: any) => (
                <button key={c.id} onClick={() => navigate(`/inbox?c=${c.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface2">
                  <Avatar name={c.customer.name} color={c.customer.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-ink">{c.customer.name}</span>
                      <ChannelIcon type={c.channelType} size="xs" />
                      {c.unreadCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
                    </div>
                    <div className="truncate text-[11.5px] text-muted">{c.subject}</div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <Badge tone={statusMeta[c.status]?.tone as any}>{statusMeta[c.status]?.label || c.status}</Badge>
                    {c.assignee ? <Avatar name={c.assignee.name} color={c.assignee.color} size="xs" /> : <span className="text-[10px] text-faint">Unassigned</span>}
                  </div>
                  <span className="w-14 shrink-0 text-right text-[10.5px] text-faint">{timeAgo(c.lastMessageAt)}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent customer activity" subtitle="Orders, conversations and notes" icon={<Zap className="h-4 w-4" />} />
            <div className="relative px-4 py-3">
              <div className="absolute bottom-4 left-[26px] top-4 w-px bg-line" />
              <div className="space-y-3">
                {(data?.activity || []).slice(0, 7).map((a: any) => (
                  <div key={a.id} className="relative flex gap-2.5">
                    <span className={cn('z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ring-surface',
                      a.type === 'order' ? 'bg-info/20' : a.type === 'conversation' ? 'bg-teal/20' : 'bg-warning/20')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', a.type === 'order' ? 'bg-info' : a.type === 'conversation' ? 'bg-teal' : 'bg-warning')} />
                    </span>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <p className="truncate text-[11.5px] text-ink"><span className="font-medium">{a.customer_name}</span> — {a.title}</p>
                      <p className="text-[10px] text-faint">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* per-agent detail table */}
        <Card>
          <CardHeader title="Agent workload & performance" subtitle="Open load, response times and satisfaction by teammate" icon={<Users className="h-4 w-4" />} />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-2 font-semibold">Agent</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Open</th>
                  <th className="px-3 py-2 text-right font-semibold">Resolved</th>
                  <th className="px-3 py-2 text-right font-semibold">Replies</th>
                  <th className="px-3 py-2 text-right font-semibold">FRT</th>
                  <th className="px-3 py-2 text-right font-semibold">CSAT</th>
                  <th className="px-3 py-2 font-semibold">Resolution rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.agents || []).map((a: any) => (
                  <tr key={a.id} className="transition hover:bg-surface2/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={a.name} color={a.color} size="xs" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{a.name}</div>
                          <div className="text-[10.5px] text-faint">{a.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Badge tone={a.status === 'online' ? 'green' : a.status === 'away' ? 'amber' : 'slate'} dot>{a.status}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{a.open}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{a.resolved}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.replied}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.frt ? duration(a.frt) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{a.csat ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Progress value={a.resolutionRate} className="w-24" />
                        <span className="text-[11px] tabular-nums text-muted">{a.resolutionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lift">
      {label && <div className="mb-1 text-[11px] font-semibold capitalize text-ink">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="capitalize text-muted">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-ink">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, suffix, icon, trend, tone, hint, good, onClick }: {
  label: string; value: React.ReactNode; suffix?: string; icon: React.ReactNode; trend?: number | null;
  tone: 'teal' | 'blue' | 'amber' | 'violet' | 'green' | 'red'; hint?: string; good?: boolean; onClick?: () => void;
}) {
  const toneMap = {
    teal: 'bg-teal/10 text-teal', blue: 'bg-info/10 text-info', amber: 'bg-warning/12 text-warning',
    violet: 'bg-violet/12 text-violet', green: 'bg-success/10 text-success', red: 'bg-danger/10 text-danger',
  };
  const hasTrend = trend != null && Number.isFinite(trend);
  return (
    <Card
      className={cn('group p-3.5 transition-all', onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lift')}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneMap[tone])}>{icon}</span>
        {hasTrend && (
          <span className={cn('flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
            (good ? trend! <= 0 : trend! >= 0) ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
            {trend! >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {Math.abs(trend!)}%
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        {value == null ? <Skeleton className="h-6 w-14" /> : <span className="text-[22px] font-semibold leading-none tracking-tight text-ink">{value}</span>}
        {suffix && <span className="text-[11px] font-medium text-faint">{suffix}</span>}
      </div>
      <div className="mt-1 text-[11.5px] font-medium text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-[10.5px] text-faint">{hint}</div>}
    </Card>
  );
}
