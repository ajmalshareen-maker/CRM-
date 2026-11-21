import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell, Building2, Check, Clock, Copy, CreditCard, FileText, KeyRound, Palette, Plus, Save, Settings as SettingsIcon,
  Shield, ShieldCheck, Trash2, User, Webhook, Workflow, Sparkles, Globe, Lock, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, formatDate, money, roleLabels, timeAgo } from '../lib/utils';
import { useAuth, useTheme, useToast } from '../lib/store';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, Progress, Select, Skeleton, Tabs, Textarea, Toggle } from '../components/ui';

const TABS = [
  { value: 'general', label: 'General', icon: Building2 },
  { value: 'branding', label: 'Branding', icon: Palette },
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'channels', label: 'Email & channels', icon: Globe },
  { value: 'replies', label: 'Saved replies', icon: FileText },
  { value: 'fields', label: 'Custom fields', icon: SettingsIcon },
  { value: 'hours', label: 'Business hours', icon: Clock },
  { value: 'sla', label: 'SLA policies', icon: Shield },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'api', label: 'API & webhooks', icon: KeyRound },
  { value: 'audit', label: 'Audit log', icon: Eye },
  { value: 'billing', label: 'Billing & plans', icon: CreditCard },
];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'general';
  const { user, org, canAdmin, canWrite, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  const { push } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orgForm, setOrgForm] = useState<any>({ name: '', brandColor: '#21B8A6', logoInitials: '', timezone: 'Asia/Karachi' });
  const [ws, setWs] = useState<any>({});
  const [profile, setProfile] = useState({ name: '', title: '', status: 'online' });
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>(['message.created']);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [replyForm, setReplyForm] = useState({ title: '', body: '', category: 'General' });
  const [replyOpen, setReplyOpen] = useState(false);
  const [hours, setHours] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<any>('/settings').then((d) => {
      setData(d);
      setOrgForm({ name: d.org.name, brandColor: d.org.brand_color, logoInitials: d.org.logo_initials, timezone: d.org.timezone });
      setWs(d.workspace || {});
      setHours(d.businessHours || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (user) setProfile({ name: user.name, title: user.title || '', status: user.status }); }, [user]);

  const saveOrg = async (patch: any) => {
    setSaving(true);
    try { await api.patch('/settings/workspace', { org: patch }); push({ title: 'Workspace updated', tone: 'success' }); refresh(); load(); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
    finally { setSaving(false); }
  };
  const saveWs = async (patch: any) => {
    try { await api.patch('/settings/workspace', { workspace: patch }); setWs({ ...ws, ...patch }); push({ title: 'Preferences saved', tone: 'success' }); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
  };
  const saveProfile = async () => {
    setSaving(true);
    try { await api.patch('/auth/me', profile); push({ title: 'Profile updated', tone: 'success' }); refresh(); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
    finally { setSaving(false); }
  };

  const setTab = (v: string) => { const n = new URLSearchParams(params); n.set('tab', v); setParams(n, { replace: true }); };

  const createKey = async () => {
    try { const d = await api.post<any>('/settings/api-keys', { name: keyName }); setNewKey(d.key); setKeyName(''); load(); }
    catch (e) { push({ title: 'Could not create key', description: (e as Error).message, tone: 'error' }); }
  };
  const revokeKey = async (id: string) => { await api.del(`/settings/api-keys/${id}`); push({ title: 'Key revoked', tone: 'info' }); load(); };
  const createHook = async () => {
    try { const d = await api.post<any>('/settings/webhooks', { url: hookUrl, events: hookEvents }); setNewSecret(d.secret); setHookUrl(''); load(); }
    catch (e) { push({ title: 'Could not add webhook', description: (e as Error).message, tone: 'error' }); }
  };
  const createReply = async () => {
    try { await api.post('/settings/saved-replies', replyForm); setReplyOpen(false); setReplyForm({ title: '', body: '', category: 'General' }); push({ title: 'Saved reply created', tone: 'success' }); load(); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
  };
  const saveHours = async () => {
    try { await api.patch('/settings/business-hours', { hours }); push({ title: 'Business hours saved', tone: 'success' }); }
    catch (e) { push({ title: 'Could not save', tone: 'error' }); }
  };

  const TABS_WITH_ICONS = TABS.map((t) => ({ ...t, icon: <t.icon className="h-3.5 w-3.5" /> }));
  const active = TABS.find((t) => t.value === tab) || TABS[0];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" description="Workspace, channels, policies and security — all in one place." badge={canAdmin ? <Badge tone="teal">Admin access</Badge> : <Badge tone="slate">Limited access</Badge>} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[218px] shrink-0 overflow-y-auto border-r border-line bg-surface p-2 lg:block">
          {TABS_WITH_ICONS.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn('mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px] font-medium transition',
                tab === t.value ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2 hover:text-ink')}>
              {t.icon}<span className="flex-1 text-left">{t.label}</span>
            </button>
          ))}
        </aside>

        <div className="rf-scroll min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-3 lg:hidden">
            <Select value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
          </div>

          {loading ? <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : (
            <>
              {tab === 'general' && (
                <div className="max-w-2xl space-y-3">
                  <Card>
                    <CardHeader title="Workspace details" subtitle="Shown across the app and to teammates" icon={<Building2 className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Workspace name</label>
                        <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} disabled={!canAdmin} /></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Initials / logo</label>
                          <Input value={orgForm.logoInitials || ''} onChange={(e) => setOrgForm({ ...orgForm, logoInitials: e.target.value.toUpperCase().slice(0, 3) })} disabled={!canAdmin} /></div>
                        <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Timezone</label>
                          <Select value={orgForm.timezone} onChange={(v) => setOrgForm({ ...orgForm, timezone: v })} disabled={!canAdmin}
                            options={['Asia/Karachi', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney'].map((z) => ({ value: z, label: z }))} /></div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-surface2/50 px-2.5 py-1.5 text-[11px] text-muted">
                        <span>Workspace slug</span><code className="rounded bg-surface px-1.5 py-0.5 text-ink">{data.org.slug}</code>
                        <span className="ml-auto">Created {formatDate(data.org.created_at)}</span>
                      </div>
                      <Button variant="primary" size="sm" loading={saving} onClick={() => saveOrg(orgForm)} disabled={!canAdmin} icon={<Save className="h-3.5 w-3.5" />}>Save changes</Button>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Workspace defaults" subtitle="Applied to new conversations" icon={<SettingsIcon className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Default email signature</label>
                        <Textarea rows={3} value={ws.default_signature || ''} onChange={(e) => setWs({ ...ws, default_signature: e.target.value })} onBlur={() => saveWs({ default_signature: ws.default_signature })} disabled={!canAdmin} /></div>
                      <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                        <div><div className="text-[12px] font-medium text-ink">Dark mode</div><div className="text-[10.5px] text-faint">Applies to your browser only</div></div>
                        <Toggle checked={theme === 'dark'} onChange={toggle} />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'branding' && (
                <div className="max-w-2xl space-y-3">
                  <Card>
                    <CardHeader title="Brand appearance" subtitle="Your colour flows through the inbox, widget and help center" icon={<Palette className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Brand colour</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={orgForm.brandColor} onChange={(e) => setOrgForm({ ...orgForm, brandColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface" />
                          <Input value={orgForm.brandColor} onChange={(e) => setOrgForm({ ...orgForm, brandColor: e.target.value })} className="max-w-[140px] font-mono" />
                          {['#21B8A6', '#4C7DF0', '#F0A43C', '#E45B65', '#B07CE8', '#142D46'].map((c) => (
                            <button key={c} onClick={() => setOrgForm({ ...orgForm, brandColor: c })} className="h-6 w-6 rounded-md ring-1 ring-black/10" style={{ background: c }} />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-line p-3">
                        <div className="mb-2 text-[10.5px] uppercase tracking-wide text-faint">Preview</div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white" style={{ background: orgForm.brandColor }}>{orgForm.logoInitials || 'RF'}</span>
                          <div><div className="text-[12.5px] font-semibold text-ink">{orgForm.name}</div><div className="text-[10.5px] text-faint">Every conversation. One workspace.</div></div>
                          <button className="ml-auto rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-white" style={{ background: orgForm.brandColor }}>Primary action</button>
                        </div>
                      </div>
                      <Button variant="primary" size="sm" loading={saving} onClick={() => saveOrg(orgForm)} disabled={!canAdmin} icon={<Save className="h-3.5 w-3.5" />}>Save branding</Button>
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'profile' && (
                <div className="max-w-xl space-y-3">
                  <Card>
                    <CardHeader title="Your profile" subtitle="How teammates see you" icon={<User className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user?.name} color={user?.avatar_color} size="lg" status={profile.status as any} />
                        <div><div className="text-[13px] font-semibold text-ink">{user?.name}</div><div className="text-[11px] text-muted">{user?.email} · {roleLabels[user?.role || 'agent']}</div></div>
                      </div>
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Display name</label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Job title</label><Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></div>
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Availability</label>
                        <Select value={profile.status} onChange={(v) => setProfile({ ...profile, status: v })} options={[{ value: 'online', label: 'Online' }, { value: 'away', label: 'Away' }, { value: 'offline', label: 'Offline' }]} /></div>
                      <Button variant="primary" size="sm" loading={saving} onClick={saveProfile} icon={<Save className="h-3.5 w-3.5" />}>Save profile</Button>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Your teams" icon={<User className="h-4 w-4" />} />
                    <div className="flex flex-wrap gap-1.5 p-4">
                      {data.users.find((u: any) => u.id === user?.id)?.teams?.map((t: string) => <Badge key={t} tone="teal">{t}</Badge>) || <span className="text-[12px] text-muted">No teams assigned.</span>}
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'channels' && (
                <div className="space-y-3">
                  <Alert tone="info" title="Email configuration lives with your integrations">
                    Gmail, Outlook and IMAP/SMTP accounts are configured in the Integrations center so credentials, sync status and error logs stay in one audited place.
                  </Alert>
                  <Card>
                    <CardHeader title="Connected mailboxes" subtitle="Inbound and outbound email" icon={<Globe className="h-4 w-4" />} />
                    <div className="divide-y divide-line">
                      {[
                        ['support@northwind.io', 'Gmail · OAuth', 'connected'],
                        ['billing@northwind.io', 'Outlook · OAuth', 'connected'],
                      ].map(([mailbox, provider, status]) => (
                        <div key={mailbox} className="flex items-center gap-2 px-4 py-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10 text-info"><Globe className="h-3.5 w-3.5" /></span>
                          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-ink">{mailbox}</div><div className="text-[10.5px] text-faint">{provider}</div></div>
                          <Badge tone="green" dot>{status}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-[12px] font-semibold text-ink">IMAP / SMTP (bring your own server)</div>
                    <p className="mt-1 text-[11.5px] text-muted">Configure host, port, TLS and an app password in Integrations → Custom IMAP/SMTP. Credentials are encrypted at rest.</p>
                    <Button size="sm" className="mt-2" onClick={() => { location.href = '/integrations'; }}>Open integrations</Button>
                  </Card>
                </div>
              )}

              {tab === 'replies' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-[13px] font-semibold text-ink">Saved replies</h3><p className="text-[11.5px] text-muted">Reusable snippets with variables like {'{{customer.first_name}}'}.</p></div>
                    <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setReplyOpen(true)} disabled={!canWrite}>New reply</Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {data.savedReplies.map((r: any) => (
                      <Card key={r.id} className="p-3">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[12.5px] font-semibold text-ink">{r.title}</h4>
                          <Badge tone="slate" className="ml-auto">{r.category}</Badge>
                        </div>
                        <p className="mt-1 rf-line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-muted">{r.body}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-faint">
                          <span>used {r.usageCount} times</span>
                          <button onClick={() => { navigator.clipboard?.writeText(r.body); push({ title: 'Copied', tone: 'success' }); }} className="ml-auto rounded p-0.5 hover:text-teal"><Copy className="h-3 w-3" /></button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'fields' && (
                <Card>
                  <CardHeader title="Custom fields" subtitle="Extend tickets and customers with your own data" icon={<SettingsIcon className="h-4 w-4" />} />
                  <div className="divide-y divide-line">
                    {data.customFields.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-2 px-4 py-2.5">
                        <Badge tone="slate">{f.entity}</Badge>
                        <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-ink">{f.label}</div><div className="text-[10.5px] text-faint">key: {f.key} · {f.type}{f.options?.length ? ` · ${f.options.join(', ')}` : ''}</div></div>
                        {f.required && <Badge tone="amber">required</Badge>}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-line p-3 text-[11px] text-faint">Custom fields are stored as validated JSON per record, so adding a field never requires a migration.</div>
                </Card>
              )}

              {tab === 'hours' && (
                <Card>
                  <CardHeader title="Business hours" subtitle="Used for SLA calculations and widget availability" icon={<Clock className="h-4 w-4" />}
                    action={<Button size="sm" onClick={saveHours} disabled={!canAdmin} icon={<Save className="h-3.5 w-3.5" />}>Save</Button>} />
                  <div className="divide-y divide-line">
                    {hours.map((h, i) => (
                      <div key={h.day} className="flex items-center gap-2 px-4 py-2">
                        <span className="w-20 text-[12px] font-medium text-ink">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][h.day]}</span>
                        <Toggle checked={!h.closed} onChange={(v) => setHours(hours.map((x, j) => (j === i ? { ...x, closed: !v } : x)))} disabled={!canAdmin} />
                        {h.closed ? <span className="text-[11px] text-faint">Closed</span> : (
                          <div className="flex items-center gap-1.5">
                            <input type="time" value={h.open_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))} className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink" />
                            <span className="text-[11px] text-faint">to</span>
                            <input type="time" value={h.close_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))} className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {tab === 'sla' && (
                <div className="space-y-2">
                  {data.slaPolicies.map((s: any) => (
                    <Card key={s.id} className="p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal"><Shield className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5"><h3 className="text-[12.5px] font-semibold text-ink">{s.name}</h3>{s.active ? <Badge tone="green">active</Badge> : <Badge tone="slate">paused</Badge>}</div>
                          <p className="text-[11px] text-muted">{s.description}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px]">
                            <span className="rounded bg-surface2 px-1.5 py-0.5 text-muted">First response: {s.first_response_mins}m</span>
                            <span className="rounded bg-surface2 px-1.5 py-0.5 text-muted">Resolution: {s.resolution_mins}m</span>
                            <span className="rounded bg-surface2 px-1.5 py-0.5 text-muted">Applies to: {s.applies_to}</span>
                            {s.business_hours_only ? <span className="rounded bg-surface2 px-1.5 py-0.5 text-muted">business hours only</span> : null}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {tab === 'notifications' && (
                <div className="max-w-xl space-y-3">
                  <Card>
                    <CardHeader title="Notification preferences" subtitle="Choose what reaches you and how" icon={<Bell className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      {[
                        ['notifications_email', 'Email notifications', 'Assignments, mentions and SLA risks by email.'],
                        ['notifications_desktop', 'Desktop notifications', 'Browser alerts for new assignments and replies.'],
                      ].map(([k, l, d]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                          <div><div className="text-[12px] font-medium text-ink">{l}</div><div className="text-[10.5px] text-faint">{d}</div></div>
                          <Toggle checked={!!ws[k]} onChange={(v) => saveWs({ [k]: v })} />
                        </div>
                      ))}
                      <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Digest frequency</label>
                        <Select value={ws.notifications_digest || 'daily'} onChange={(v) => saveWs({ notifications_digest: v })}
                          options={[{ value: 'realtime', label: 'Real time' }, { value: 'hourly', label: 'Hourly' }, { value: 'daily', label: 'Daily summary' }, { value: 'weekly', label: 'Weekly summary' }]} /></div>
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'security' && (
                <div className="max-w-xl space-y-3">
                  <Card>
                    <CardHeader title="Security" subtitle="Protect your workspace and customer data" icon={<ShieldCheck className="h-4 w-4" />} />
                    <div className="space-y-3 p-4">
                      {[
                        ['security_2fa', 'Require two-factor authentication', 'Every teammate must enrol an authenticator app.'],
                        ['security_sso', 'SAML single sign-on', 'Centralise access through your identity provider (Studio plan and above).'],
                      ].map(([k, l, d]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                          <div><div className="text-[12px] font-medium text-ink">{l}</div><div className="text-[10.5px] text-faint">{d}</div></div>
                          <Toggle checked={!!ws[k]} onChange={(v) => saveWs({ [k]: v })} disabled={!canAdmin} />
                        </div>
                      ))}
                      <div className="rounded-lg border border-line px-3 py-2">
                        <div className="text-[12px] font-medium text-ink">Audit log retention</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Select size="sm" value={String(ws.security_audit_retention_days || 365)} onChange={(v) => saveWs({ security_audit_retention_days: Number(v) })}
                            options={[90, 180, 365, 730].map((d) => ({ value: String(d), label: `${d} days` }))} className="w-32" />
                          <span className="text-[10.5px] text-faint">Applies to all audit events in this workspace.</span>
                        </div>
                      </div>
                      <Alert tone="warning" title="Data handling">
                        Secrets (OAuth tokens, API keys, webhook secrets) are encrypted at rest. Database queries are always scoped by
                        organisation id, so one workspace can never read another's data.
                      </Alert>
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'api' && (
                <div className="max-w-2xl space-y-3">
                  <Card>
                    <CardHeader title="API keys" subtitle="Authenticate server-to-server requests" icon={<KeyRound className="h-4 w-4" />} />
                    <div className="space-y-2 p-4">
                      {data.apiKeys.map((k: any) => (
                        <div key={k.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                          <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{k.prefix}••••••••</code>
                          <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-medium text-ink">{k.name}</div><div className="text-[10px] text-faint">created {formatDate(k.createdAt)} · last used {k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'never'}</div></div>
                          {k.revoked ? <Badge tone="red">revoked</Badge> : <Button size="xs" variant="ghost" onClick={() => revokeKey(k.id)} className="text-danger" disabled={!canAdmin}>Revoke</Button>}
                        </div>
                      ))}
                      <div className="flex gap-1.5">
                        <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name, e.g. Production server" />
                        <Button size="sm" variant="primary" onClick={createKey} disabled={!keyName || !canAdmin}>Create key</Button>
                      </div>
                      <p className="text-[10.5px] text-faint">Rate limit: 60 requests/minute per workspace, bursts to 100.</p>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Webhooks" subtitle="Receive signed events at your endpoint" icon={<Webhook className="h-4 w-4" />} />
                    <div className="space-y-2 p-4">
                      {data.webhooks.map((w: any) => (
                        <div key={w.id} className="rounded-lg border border-line px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <code className="truncate text-[11px] text-ink">{w.url}</code>
                            <Badge tone={w.active ? 'green' : 'slate'} className="ml-auto">{w.active ? 'active' : 'paused'}</Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {w.events.map((e: string) => <span key={e} className="rounded bg-surface2 px-1 py-0.5 font-mono text-[9.5px] text-muted">{e}</span>)}
                            {w.lastStatus && <span className="ml-auto text-[10px] text-faint">last {w.lastStatus} · {timeAgo(w.lastDeliveryAt)}</span>}
                          </div>
                        </div>
                      ))}
                      <div className="grid gap-1.5 sm:grid-cols-[1fr_auto]">
                        <Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://your-domain.com/replyflow" />
                        <Button size="sm" variant="primary" onClick={createHook} disabled={!hookUrl || !canAdmin}>Add endpoint</Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['conversation.created', 'message.created', 'ticket.resolved', 'csat.submitted'].map((e) => (
                          <button key={e} onClick={() => setHookEvents(hookEvents.includes(e) ? hookEvents.filter((x) => x !== e) : [...hookEvents, e])}
                            className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition', hookEvents.includes(e) ? 'border-teal bg-teal/10 text-teal' : 'border-line text-muted')}>{e}</button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {tab === 'audit' && (
                <Card className="overflow-hidden">
                  <CardHeader title="Audit log" subtitle="Immutable record of workspace activity" icon={<Eye className="h-4 w-4" />} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                        <th className="px-4 py-2 font-semibold">Action</th><th className="px-3 py-2 font-semibold">Actor</th><th className="px-3 py-2 font-semibold">Entity</th><th className="px-3 py-2 font-semibold">When</th>
                      </tr></thead>
                      <tbody className="divide-y divide-line">
                        {data.auditLogs.map((l: any) => (
                          <tr key={l.id} className="hover:bg-surface2/50">
                            <td className="px-4 py-2"><span className="font-mono text-[11px] text-ink">{l.action}</span></td>
                            <td className="px-3 py-2 text-muted">{l.user_name}</td>
                            <td className="px-3 py-2 text-[11px] text-faint">{l.entity_type}{l.entity_id ? ` · ${String(l.entity_id).slice(0, 14)}` : ''}</td>
                            <td className="px-3 py-2 text-[11px] text-faint">{timeAgo(l.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {tab === 'billing' && (
                <div className="max-w-3xl space-y-3">
                  <Card>
                    <CardHeader title="Current plan" subtitle={`${data.org.plan} · renews monthly`} icon={<CreditCard className="h-4 w-4" />} />
                    <div className="p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <div className="text-[26px] font-semibold leading-none text-ink">{data.org.plan === 'growth' ? '$149' : data.org.plan === 'scale' ? '$399' : '$49'}<span className="text-[12px] font-normal text-faint">/month</span></div>
                          <div className="mt-1 text-[11.5px] text-muted">{data.users.length} of {data.org.seats_limit} seats used</div>
                        </div>
                        <div className="ml-auto"><Badge tone="teal" dot>Active</Badge></div>
                      </div>
                      <div className="mt-2"><Progress value={(data.users.length / data.org.seats_limit) * 100} /></div>
                    </div>
                  </Card>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['Starter', '$49', ['3 seats', '2 channels', 'Email + chat', 'Community support'], false],
                      ['Growth', '$149', ['25 seats', 'Unlimited channels', 'AI assist + automations', 'SLA policies', 'Priority support'], true],
                      ['Scale', '$399', ['Unlimited seats', 'SSO & SCIM', 'Audit retention', 'Dedicated CSM'], false],
                    ].map(([name, price, feats, current]: any) => (
                      <Card key={name} className={cn('p-3.5', current && 'ring-2 ring-teal/40')}>
                        <div className="flex items-center gap-1.5"><h3 className="text-[13px] font-semibold text-ink">{name}</h3>{current && <Badge tone="teal">current</Badge>}</div>
                        <div className="mt-1 text-[20px] font-semibold text-ink">{price}<span className="text-[11px] font-normal text-faint">/mo</span></div>
                        <ul className="mt-2 space-y-1">
                          {feats.map((f: string) => <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted"><Check className="h-3 w-3 text-success" />{f}</li>)}
                        </ul>
                        <Button size="sm" variant={current ? 'secondary' : 'primary'} className="mt-2.5 w-full" disabled={current || !canAdmin}
                          onClick={() => push({ title: 'Plan change requested', description: 'Billing is handled by your payment provider in production. No charge was made.', tone: 'info' })}>
                          {current ? 'Current plan' : `Upgrade to ${name}`}
                        </Button>
                      </Card>
                    ))}
                  </div>
                  <Alert tone="info" title="Usage limits">
                    Seat limits are enforced server-side — inviting beyond {data.org.seats_limit} seats returns an upgrade prompt rather than silently over-provisioning.
                  </Alert>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={!!newKey} onClose={() => setNewKey(null)} title="API key created" icon={<KeyRound className="h-4 w-4" />} size="sm"
        footer={<Button variant="primary" onClick={() => setNewKey(null)}>Done</Button>}>
        <p className="text-[12px] text-muted">Copy this key now — it is shown only once and only a hash is stored.</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-line bg-surface2/60 px-2.5 py-2">
          <code className="flex-1 break-all font-mono text-[11.5px] text-ink">{newKey}</code>
          <button onClick={() => { navigator.clipboard?.writeText(newKey!); push({ title: 'Key copied', tone: 'success' }); }} className="rounded p-1 text-muted hover:text-teal"><Copy className="h-3.5 w-3.5" /></button>
        </div>
      </Modal>
      <Modal open={!!newSecret} onClose={() => setNewSecret(null)} title="Webhook endpoint added" icon={<Webhook className="h-4 w-4" />} size="sm"
        footer={<Button variant="primary" onClick={() => setNewSecret(null)}>Done</Button>}>
        <p className="text-[12px] text-muted">Verify the <code className="rounded bg-surface2 px-1">x-replyflow-signature</code> header using HMAC-SHA256 with this secret:</p>
        <div className="mt-2 rounded-lg border border-line bg-surface2/60 px-2.5 py-2"><code className="break-all font-mono text-[11.5px] text-ink">{newSecret}</code></div>
      </Modal>
      <Modal open={replyOpen} onClose={() => setReplyOpen(false)} title="New saved reply" icon={<FileText className="h-4 w-4" />} size="md"
        footer={<><Button variant="ghost" onClick={() => setReplyOpen(false)}>Cancel</Button><Button variant="primary" onClick={createReply} disabled={!replyForm.title || !replyForm.body}>Create reply</Button></>}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Title</label><Input value={replyForm.title} onChange={(e) => setReplyForm({ ...replyForm, title: e.target.value })} /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Category</label>
            <Select value={replyForm.category} onChange={(v) => setReplyForm({ ...replyForm, category: v })} options={['General', 'Billing', 'Delivery', 'Refund', 'Marketplace'].map((c) => ({ value: c, label: c }))} /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Body</label>
            <Textarea rows={7} value={replyForm.body} onChange={(e) => setReplyForm({ ...replyForm, body: e.target.value })} placeholder={'Hi {{customer.first_name}},\n\n…'} /></div>
        </div>
      </Modal>
    </div>
  );
}
