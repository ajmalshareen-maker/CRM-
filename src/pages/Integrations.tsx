import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, ExternalLink, Filter, Link2, Plug, RefreshCw,
  Search, Settings2, ShieldCheck, Unplug, XCircle, Zap, Info, Server, KeyRound, Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, integrationStatusMeta, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Badge, Button, Card, Dropdown, EmptyState, Input, MenuItem, MenuLabel, Modal, PageHeader, SearchInput, Select, Skeleton, Tabs } from '../components/ui';
import { ChannelIcon, channelLabel } from '../components/ChannelIcon';

const BRAND: Record<string, { initials: string; color: string }> = {
  gmail: { initials: 'GM', color: '#EA4335' }, outlook: { initials: 'OL', color: '#0F6CBD' },
  imap: { initials: 'IM', color: '#718096' }, whatsapp: { initials: 'WA', color: '#25A65B' },
  instagram: { initials: 'IG', color: '#D6487E' }, messenger: { initials: 'MS', color: '#2D7FF9' },
  telegram: { initials: 'TG', color: '#2AABEE' }, slack: { initials: 'SL', color: '#611F69' },
  amazon: { initials: 'AZ', color: '#E08A1E' }, ebay: { initials: 'eB', color: '#3B7BB8' },
  etsy: { initials: 'ET', color: '#D2603A' }, walmart: { initials: 'WM', color: '#2E77BC' },
  shopify: { initials: 'SH', color: '#5E8E3E' }, woocommerce: { initials: 'WC', color: '#7F54B3' },
  tiktok: { initials: 'TT', color: '#172B4D' }, aliexpress: { initials: 'AE', color: '#E43D33' },
  stripe: { initials: 'ST', color: '#635BFF' }, zapier: { initials: 'ZP', color: '#FF4A00' },
  hubspot: { initials: 'HS', color: '#FF7A59' }, jira: { initials: 'JR', color: '#2684FF' },
  linear: { initials: 'LN', color: '#5E6AD2' }, segment: { initials: 'SG', color: '#52BD94' },
};

function BrandMark({ k, size = 'md' }: { k: string; size?: 'md' | 'lg' }) {
  const b = BRAND[k] || { initials: k.slice(0, 2).toUpperCase(), color: '#718096' };
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-sm',
      size === 'lg' ? 'h-11 w-11 text-[13px]' : 'h-8 w-8 text-[11px]')}
      style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}cc)` }}>
      {b.initials}
    </span>
  );
}
import type { Channel, Integration } from '../lib/types';

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Email: ShieldCheck, Messaging: Plug, Marketplace: Zap, eCommerce: Zap, Payments: KeyRound,
  Automation: Sparkles, CRM: Link2, Engineering: Server, Analytics: Sparkles,
};

export default function Integrations() {
  const { canAdmin, aiProvider } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState('all');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [configure, setConfigure] = useState<Integration | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState<Integration | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<{ integrations: Integration[] }>('/integrations').then((d) => setIntegrations(d.integrations)),
      api.get<{ channels: Channel[] }>('/channels').then((d) => setChannels(d.channels)),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const act = async (int: Integration, action: string, config?: Record<string, string>) => {
    // Validate before the request so the user gets feedback next to the fields.
    if (action === 'connect' && int.authType !== 'oauth') {
      const fields = configSchema[int.key] || [{ key: 'apiKey', label: 'API key' }];
      const missing = fields.filter((f) => !(config || {})[f.key]?.trim());
      if (missing.length) {
        setFormError(`Enter ${missing.map((f) => f.label.toLowerCase()).join(' and ')} — ${int.name} cannot be verified without them.`);
        return;
      }
    }
    setFormError(null);
    setBusy(int.id + action);
    try {
      const d = await api.post<any>(`/integrations/${int.id}/action`, { action, config });
      if (action === 'connect' && d.partial) {
        push({ title: 'Configuration saved — verification pending', description: d.message, tone: 'warning' });
      } else {
        push({
          title: action === 'connect' ? `${int.name} connected` : action === 'disconnect' ? `${int.name} disconnected` : action === 'enable_demo' ? `${int.name} demo enabled` : 'Sync complete',
          description: d.note || d.message, tone: action === 'disconnect' ? 'info' : 'success',
        });
      }
      setConfigure(null); setConfigValues({}); setFormError(null); load();
    } catch (e) {
      push({ title: `${int.name}: action blocked`, description: (e as Error).message, tone: 'error' });
    } finally { setBusy(null); }
  };

  const channelAction = async (ch: Channel, action: string) => {
    setBusy(ch.id + action);
    try {
      const d = await api.post<any>(`/channels/${ch.id}/action`, { action });
      push({ title: action === 'sync' ? `${ch.name} synced` : `${ch.name} updated`, description: d.imported != null ? `${d.imported} new items imported` : `Status: ${d.status}`, tone: 'success' });
      load();
    } catch (e) {
      push({ title: 'Channel action failed', description: (e as Error).message, tone: 'error' });
    } finally { setBusy(null); }
  };

  const counts = useMemo(() => ({
    connected: integrations.filter((i) => i.status === 'connected').length,
    demo: integrations.filter((i) => i.status === 'demo').length,
    needs: integrations.filter((i) => i.status === 'needs_config' || i.status === 'available').length,
    approval: integrations.filter((i) => i.status === 'awaiting_approval').length,
  }), [integrations]);

  const filtered = integrations.filter((i) => {
    if (tab !== 'all' && i.status !== tab) return false;
    if (q && !`${i.name} ${i.category} ${i.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const configSchema: Record<string, { key: string; label: string; placeholder?: string; secret?: boolean }[]> = {
    whatsapp: [
      { key: 'phoneNumberId', label: 'Phone number ID' },
      { key: 'businessAccountId', label: 'WhatsApp Business account ID' },
      { key: 'accessToken', label: 'Permanent access token', secret: true },
      { key: 'verifyToken', label: 'Webhook verify token', secret: true },
    ],
    imap: [
      { key: 'host', label: 'IMAP host', placeholder: 'imap.yourdomain.com' },
      { key: 'port', label: 'IMAP port', placeholder: '993' },
      { key: 'smtpHost', label: 'SMTP host' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'App password', secret: true },
    ],
    shopify: [{ key: 'shopDomain', label: 'Shop domain', placeholder: 'store.myshopify.com' }, { key: 'accessToken', label: 'Admin API access token', secret: true }],
    woocommerce: [{ key: 'siteUrl', label: 'Site URL' }, { key: 'consumerKey', label: 'Consumer key' }, { key: 'consumerSecret', label: 'Consumer secret', secret: true }],
    telegram: [{ key: 'botToken', label: 'Bot token', secret: true }],
  };

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Integrations" description="Connect the channels your customers already use. Every status below reflects reality — nothing is faked."
        actions={<>
          <Badge tone={aiProvider === 'live' ? 'green' : 'amber'} dot>AI provider: {aiProvider}</Badge>
          <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Refresh</Button>
        </>} />

      <div className="p-4 sm:p-6">
        {/* honesty banner */}
        <Alert tone="info" title="How connection states work" className="mb-4">
          <div className="mt-1 grid gap-2 sm:grid-cols-4">
            {[
              ['connected', 'Live API — real data is syncing.'],
              ['demo', 'Sample data only. No external calls.'],
              ['needs_config', 'Credentials required to finish setup.'],
              ['awaiting_approval', 'Platform approval pending. Nothing ingested.'],
            ].map(([k, description]) => (
              <div key={k} className="rounded-lg border border-line bg-surface px-2 py-1.5">
                <Badge tone={integrationStatusMeta[k].tone}>{integrationStatusMeta[k].label}</Badge>
                <p className="mt-1 text-[10.5px] leading-snug text-muted">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            ReplyFlow never simulates a successful connection. Where a platform requires approved developer access, we show it as awaiting approval and ingest no data until the provider confirms the connection.
          </p>
        </Alert>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[['Connected', counts.connected, 'green', CheckCircle2], ['Demo', counts.demo, 'teal', Sparkles], ['Needs setup', counts.needs, 'amber', Settings2], ['Awaiting approval', counts.approval, 'slate', Clock]].map(([l, v, tone, Icon]: any) => (
            <Card key={l} className="flex items-center gap-3 p-3.5">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg',
                tone === 'green' ? 'bg-success/10 text-success' : tone === 'teal' ? 'bg-teal/10 text-teal' : tone === 'amber' ? 'bg-warning/12 text-warning' : 'bg-muted/12 text-muted')}>
                <Icon className="h-4 w-4" />
              </span>
              <div><div className="text-[18px] font-semibold leading-none text-ink">{v}</div><div className="mt-0.5 text-[10.5px] text-faint">{l}</div></div>
            </Card>
          ))}
        </div>

        <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'All', count: integrations.length },
          { value: 'connected', label: 'Connected', count: counts.connected },
          { value: 'demo', label: 'Demo', count: counts.demo },
          { value: 'needs_config', label: 'Needs setup', count: counts.needs },
          { value: 'awaiting_approval', label: 'Awaiting approval', count: counts.approval },
        ]} />

        <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Search integrations…" className="max-w-sm" /></div>

        {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((i) => {
            const meta = integrationStatusMeta[i.status] || integrationStatusMeta.available;
            return (
              <Card key={i.id} className="flex flex-col p-3.5 transition hover:shadow-lift">
                <div className="flex items-start gap-2.5">
                  <BrandMark k={i.key} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-[13px] font-semibold text-ink">{i.name}</h4>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{i.description}</p>
                  </div>
                  <Badge tone={meta.tone} dot>{meta.label}</Badge>
                </div>

                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-faint">
                  <span className="rounded bg-surface2 px-1.5 py-0.5 font-medium uppercase">{i.authType}</span>
                  {i.lastSyncAt && <span>synced {timeAgo(i.lastSyncAt)}</span>}
                  {i.errors?.length > 0 && (
                    <button onClick={() => setShowErrors(i)} className="flex items-center gap-0.5 text-warning hover:underline">
                      <AlertTriangle className="h-2.5 w-2.5" />{i.errors.length} log
                    </button>
                  )}
                </div>

                <p className="mt-1.5 text-[10px] leading-snug text-faint">{meta.hint}</p>

                <div className="mt-2.5 flex items-center gap-1.5 border-t border-line/70 pt-2.5">
                  {i.status === 'connected' ? (
                    <>
                      <Button size="xs" icon={<RefreshCw className="h-3 w-3" />} loading={busy === i.id + 'sync'} onClick={() => act(i, 'sync')} disabled={!canAdmin}>Sync now</Button>
                      <Button size="xs" variant="ghost" icon={<Unplug className="h-3 w-3" />} onClick={() => act(i, 'disconnect')} disabled={!canAdmin}>Disconnect</Button>
                    </>
                  ) : i.status === 'demo' ? (
                    <>
                      <Button size="xs" variant="soft" icon={<RefreshCw className="h-3 w-3" />} onClick={() => act(i, 'sync')}>Refresh demo</Button>
                      <Button size="xs" variant="ghost" onClick={() => { setConfigure(i); setConfigValues({}); setFormError(null); }} disabled={!canAdmin}>Connect real</Button>
                    </>
                  ) : i.status === 'awaiting_approval' ? (
                    <Button size="xs" variant="secondary" disabled icon={<Clock className="h-3 w-3" />}>Approval pending</Button>
                  ) : (
                    <Button size="xs" variant="primary" icon={<Plug className="h-3 w-3" />} onClick={() => { setConfigure(i); setConfigValues({}); setFormError(null); }} disabled={!canAdmin}>
                      {i.status === 'needs_config' ? 'Finish setup' : 'Connect'}
                    </Button>
                  )}
                  <a href={i.docsUrl} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-faint hover:text-teal">Docs <ExternalLink className="inline h-2.5 w-2.5" /></a>
                </div>
              </Card>
                );
              })}
            </div>
            {filtered.length === 0 && <EmptyState icon={<Plug className="h-5 w-5" />} title="No integrations match" description="Try a different category or clear the search." />}
          </>
        )}

        {/* channels table */}
        <Card className="mt-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">Connected channels</h3>
              <p className="text-[11px] text-muted">Inboxes feeding the unified workspace — with real connection health.</p>
            </div>
            <Badge tone="slate">{channels.length} channels</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2 font-semibold">Channel</th><th className="px-3 py-2 font-semibold">Type</th><th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Auth</th><th className="px-3 py-2 font-semibold">Last sync</th><th className="px-3 py-2 text-right font-semibold">Conversations</th><th className="px-3 py-2 font-semibold">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {channels.map((ch) => {
                  const meta = integrationStatusMeta[ch.status] || integrationStatusMeta.available;
                  return (
                    <tr key={ch.id} className="hover:bg-surface2/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ChannelIcon type={ch.type} size="sm" />
                          <div className="min-w-0"><div className="truncate font-medium text-ink">{ch.name}</div><div className="truncate text-[10px] text-faint">{ch.handle}</div></div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-muted">{channelLabel(ch.type)}</td>
                      <td className="px-3 py-2.5"><Badge tone={meta.tone} dot>{meta.label}</Badge></td>
                      <td className="px-3 py-2.5"><span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] uppercase text-muted">{ch.authType}</span></td>
                      <td className="px-3 py-2.5 text-[11px] text-muted">{ch.lastSyncAt ? timeAgo(ch.lastSyncAt) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">{ch.conversations}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => channelAction(ch, 'sync')} disabled={busy === ch.id + 'sync'} className="rounded p-1 text-muted hover:bg-surface2 hover:text-teal" title="Sync"><RefreshCw className={cn('h-3.5 w-3.5', busy === ch.id + 'sync' && 'animate-spin')} /></button>
                          {ch.status === 'connected' && <button onClick={() => channelAction(ch, 'test')} className="rounded p-1 text-muted hover:bg-surface2 hover:text-info" title="Test connection"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                          {ch.errors?.length > 0 && <button onClick={() => setShowErrors({ ...ch, key: ch.type, category: 'Channel', description: '', docsUrl: '' } as any)} className="rounded p-1 text-muted hover:bg-surface2 hover:text-warning" title="View log"><AlertTriangle className="h-3.5 w-3.5" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* configure modal */}
      <Modal open={!!configure} onClose={() => setConfigure(null)} title={configure ? `Connect ${configure.name}` : ''} icon={<Plug className="h-4 w-4" />} size="md"
        description={configure ? `${configure.authType === 'oauth' ? 'OAuth 2.0' : 'API credentials'} · credentials are encrypted at rest and never exposed to the browser.` : ''}
        footer={<><Button variant="ghost" onClick={() => setConfigure(null)}>Cancel</Button>
          <Button variant="primary" loading={busy === configure?.id + 'connect'} onClick={() => configure && act(configure, 'connect', configValues)}>Save & connect</Button></>}>
        {configure && (
          <div className="space-y-3">
            {formError && <Alert tone="warning" title="Credentials required">{formError}</Alert>}
            {integrationStatusMeta[configure.status]?.label === 'Awaiting approval' ? null : null}
            {configure.authType === 'oauth' ? (
              <>
                <Alert tone="info" title="OAuth handshake">
                  In production this opens the provider consent screen, exchanges the code server-side, and stores the
                  encrypted refresh token. Without a configured app client ID/secret the connection stays in
                  <b> Needs setup</b> rather than pretending to succeed.
                </Alert>
                <div className="rounded-lg border border-line bg-surface2/50 p-3 text-[11.5px]">
                  <div className="mb-1 font-medium text-ink">Redirect URI</div>
                  <code className="block break-all rounded bg-surface px-2 py-1 text-[10.5px] text-muted">{location.origin}/api/oauth/{configure.key}/callback</code>
                  <div className="mt-2 mb-1 font-medium text-ink">Requested scopes</div>
                  <code className="block text-[10.5px] text-muted">read:messages · write:messages · read:customers</code>
                </div>
                <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Client ID (optional — required for live verification)</label>
                  <Input value={configValues.clientId || ''} onChange={(e) => setConfigValues({ ...configValues, clientId: e.target.value })} placeholder="Paste your provider client ID" /></div>
              </>
            ) : (
              (configSchema[configure.key] || [{ key: 'apiKey', label: 'API key', secret: true }]).map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-[11.5px] font-medium text-muted">{f.label}</label>
                  <Input type={f.secret ? 'password' : 'text'} value={configValues[f.key] || ''} onChange={(e) => setConfigValues({ ...configValues, [f.key]: e.target.value })} placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`} />
                </div>
              ))
            )}
            <Alert tone="warning" title="We will not fabricate a connection">
              If the provider cannot be verified from this environment, the integration is saved with status
              <b> Needs setup</b> and an explanatory error log entry — never shown as connected.
            </Alert>
          </div>
        )}
      </Modal>

      {/* error log modal */}
      <Modal open={!!showErrors} onClose={() => setShowErrors(null)} title="Connection log" icon={<AlertTriangle className="h-4 w-4" />} size="md"
        description={showErrors?.name}>
        <div className="space-y-2">
          {(showErrors?.errors || []).length === 0 && <p className="text-[12px] text-muted">No log entries recorded.</p>}
          {showErrors?.errors?.map((e, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface2/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Badge tone={e.level === 'warn' ? 'amber' : e.level === 'error' ? 'red' : 'slate'}>{e.level}</Badge>
                <span className="text-[10.5px] text-faint">{timeAgo(e.at)}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink">{e.message}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
