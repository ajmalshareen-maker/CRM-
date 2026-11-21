import { useEffect, useState } from 'react';
import { Check, Code2, Copy, ExternalLink, Eye, MessageCircle, Monitor, Palette, Plus, Save, Smartphone, Trash2, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Badge, Button, Card, CardHeader, Input, PageHeader, Select, Skeleton, Tabs, Textarea, Toggle } from '../components/ui';

export default function LiveChatWidget() {
  const { org, canAdmin } = useAuth();
  const { push } = useToast();
  const [widget, setWidget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('design');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    api.get<any>('/settings').then((d) => setWidget(d.widget)).finally(() => setLoading(false));
  }, []);

  const save = async (patch?: any) => {
    setSaving(true);
    try { await api.patch('/settings/widget', patch || widget); push({ title: 'Widget updated', description: 'Changes apply to new visitors immediately.', tone: 'success' }); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
    finally { setSaving(false); }
  };

  const embed = `<script src="${location.origin}/widget.js" data-replyflow="${org?.slug || 'northwind'}" defer></script>`;

  if (loading || !widget) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Live chat widget" description="An embeddable chat bubble that creates real conversations in your unified inbox."
        actions={<>
          <Button size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.open(`/api/widget/config/${org?.slug}`, '_blank')}>View config</Button>
          <Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={() => save()} disabled={!canAdmin}>Save changes</Button>
        </>}>
        <div className="mt-2.5"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'design', label: 'Design & copy' }, { value: 'behaviour', label: 'Behaviour' }, { value: 'install', label: 'Install' }, { value: 'preview', label: 'Preview' },
        ]} /></div>
      </PageHeader>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {tab === 'design' && (
            <>
              <Card>
                <CardHeader title="Messaging" subtitle="What visitors read first" icon={<MessageCircle className="h-4 w-4" />} />
                <div className="space-y-3 p-4">
                  <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Widget name</label>
                    <Input value={widget.name} onChange={(e) => setWidget({ ...widget, name: e.target.value })} disabled={!canAdmin} /></div>
                  <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Welcome message</label>
                    <Textarea rows={2} value={widget.welcome_message} onChange={(e) => setWidget({ ...widget, welcome_message: e.target.value })} disabled={!canAdmin} /></div>
                  <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Offline message</label>
                    <Textarea rows={2} value={widget.offline_message} onChange={(e) => setWidget({ ...widget, offline_message: e.target.value })} disabled={!canAdmin} /></div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Appearance" subtitle="Colour, position and launcher style" icon={<Palette className="h-4 w-4" />} />
                <div className="space-y-3 p-4">
                  <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Accent colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={widget.primary_color} onChange={(e) => setWidget({ ...widget, primary_color: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-line" />
                      <Input value={widget.primary_color} onChange={(e) => setWidget({ ...widget, primary_color: e.target.value })} className="max-w-[130px] font-mono" />
                      {['#21B8A6', '#4C7DF0', '#F0A43C', '#E45B65', '#142D46'].map((c) => (
                        <button key={c} onClick={() => setWidget({ ...widget, primary_color: c })} className="h-6 w-6 rounded-md ring-1 ring-black/10" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Position</label>
                      <Select value={widget.position} onChange={(v) => setWidget({ ...widget, position: v })} options={[{ value: 'bottom-right', label: 'Bottom right' }, { value: 'bottom-left', label: 'Bottom left' }]} /></div>
                    <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Launcher style</label>
                      <Select value={widget.bubble_style} onChange={(v) => setWidget({ ...widget, bubble_style: v })} options={[{ value: 'round', label: 'Round' }, { value: 'square', label: 'Rounded square' }]} /></div>
                  </div>
                  <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Avatar initials</label>
                    <Input value={widget.avatar_initials} onChange={(e) => setWidget({ ...widget, avatar_initials: e.target.value.toUpperCase().slice(0, 3) })} className="max-w-[100px]" /></div>
                </div>
              </Card>
            </>
          )}

          {tab === 'behaviour' && (
            <>
              <Card>
                <CardHeader title="Pre-chat form" subtitle="Collect identity before the conversation starts" icon={<Zap className="h-4 w-4" />} />
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <div><div className="text-[12px] font-medium text-ink">Require pre-chat form</div><div className="text-[10.5px] text-faint">Name, email and topic before chatting</div></div>
                    <Toggle checked={!!widget.prechat_enabled} onChange={(v) => setWidget({ ...widget, prechat_enabled: v ? 1 : 0 })} disabled={!canAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    {(widget.prechat_fields || []).map((f: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5">
                        <Input value={f.label} onChange={(e) => setWidget({ ...widget, prechat_fields: widget.prechat_fields.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)) })} className="!h-7 !text-[11.5px]" />
                        <span className="text-[10px] text-faint">{f.key}</span>
                        <button onClick={() => setWidget({ ...widget, prechat_fields: widget.prechat_fields.map((x: any, j: number) => (j === i ? { ...x, required: !x.required } : x)) })}
                          className={cn('rounded px-1.5 py-0.5 text-[10px]', f.required ? 'bg-teal/10 text-teal' : 'bg-surface2 text-faint')}>{f.required ? 'required' : 'optional'}</button>
                        <button onClick={() => setWidget({ ...widget, prechat_fields: widget.prechat_fields.filter((_: any, j: number) => j !== i) })} className="rounded p-1 text-faint hover:text-danger"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <Button size="xs" variant="ghost" icon={<Plus className="h-3 w-3" />}
                      onClick={() => setWidget({ ...widget, prechat_fields: [...(widget.prechat_fields || []), { key: `field_${Date.now().toString(36)}`, label: 'New field', required: false }] })}>Add field</Button>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Availability" subtitle="When your team can be reached" icon={<Check className="h-4 w-4" />} />
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <div><div className="text-[12px] font-medium text-ink">Only show online during business hours</div><div className="text-[10.5px] text-faint">Outside hours the visitor sees the offline form</div></div>
                    <Toggle checked={!!widget.business_hours_only} onChange={(v) => setWidget({ ...widget, business_hours_only: v ? 1 : 0 })} disabled={!canAdmin} />
                  </div>
                  <Alert tone="info">Chats are assigned to the Live Chat Crew team; round-robin rules apply automatically.</Alert>
                </div>
              </Card>
            </>
          )}

          {tab === 'install' && (
            <Card>
              <CardHeader title="Installation" subtitle="One script tag, no build step required" icon={<Code2 className="h-4 w-4" />} />
              <div className="space-y-3 p-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11.5px] font-medium text-muted">Embed snippet</label>
                    <Button size="xs" variant="ghost" icon={<Copy className="h-3 w-3" />} onClick={() => { navigator.clipboard?.writeText(embed); push({ title: 'Snippet copied', tone: 'success' }); }}>Copy</Button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-line bg-surface2/60 p-2.5 font-mono text-[11px] text-ink">{embed}</pre>
                </div>
                <ol className="ml-4 list-decimal space-y-1 text-[12px] text-muted">
                  <li>Paste the snippet before <code className="rounded bg-surface2 px-1">&lt;/body&gt;</code> on every page where chat should appear.</li>
                  <li>Reload the page — the launcher appears in the corner.</li>
                  <li>Send a test message; it lands in Unified Inbox → Live chat within seconds.</li>
                </ol>
                <Alert tone="info" title="Try it yourself">
                  Open the preview tab and use the launcher in the bottom-right corner. Real conversations are created and appear in your inbox — clearly labelled as live chat.
                </Alert>
              </div>
            </Card>
          )}

          {tab === 'preview' && (
            <Card>
              <CardHeader title="Embedded preview" subtitle="This is the real widget script, loading live config" icon={<Eye className="h-4 w-4" />} />
              <div className="p-4">
                <div className="relative overflow-hidden rounded-xl border border-line rf-pattern-dots bg-bg" style={{ height: 460 }}>
                  <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger/60" /><span className="h-2 w-2 rounded-full bg-warning/60" /><span className="h-2 w-2 rounded-full bg-success/60" />
                    <span className="ml-2 rounded bg-surface2 px-2 py-0.5 text-[10px] text-muted">https://northwind.io/pricing</span>
                  </div>
                  <iframe title="widget preview" src="/widget-preview.html" className="h-full w-full border-0" />
                </div>
                <p className="mt-2 text-[10.5px] text-faint">The preview loads /widget.js exactly as a customer site would. Messages you send appear in the inbox.</p>
              </div>
            </Card>
          )}
        </div>

        {/* live widget mock */}
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-3 py-2 text-[11px] font-semibold text-ink">Live appearance</div>
            <div className="relative bg-bg p-3" style={{ height: 400 }}>
              <div className="absolute inset-x-3 top-3 h-[300px] rounded-xl bg-surface shadow-soft" />
              <div className="absolute bottom-3 right-3 w-[210px] overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
                <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: widget.primary_color }}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/25 text-[9px] font-bold text-white">{widget.avatar_initials}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] font-semibold text-white">{widget.name}</div>
                    <div className="flex items-center gap-1 text-[8.5px] text-white/85"><span className="h-1.5 w-1.5 rounded-full bg-[#7ef0c5]" />Online — replies in minutes</div>
                  </div>
                </div>
                <div className="space-y-1.5 bg-bg p-2">
                  <div className="max-w-[85%] rounded-lg rounded-bl-sm border border-line bg-surface px-2 py-1.5 text-[10px] leading-snug text-ink">{widget.welcome_message}</div>
                  <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm px-2 py-1.5 text-[10px] leading-snug text-white" style={{ background: widget.primary_color }}>Do you ship to Dubai?</div>
                </div>
                <div className="flex items-center gap-1 border-t border-line p-1.5">
                  <div className="flex-1 rounded-md border border-line px-1.5 py-1 text-[9px] text-faint">Write a message…</div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] text-white" style={{ background: widget.primary_color }}>➤</span>
                </div>
              </div>
              <span className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lift" style={{ background: widget.primary_color }}>
                <MessageCircle className="h-4 w-4" />
              </span>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] font-semibold text-ink">Channel status</div>
            <div className="mt-1.5 space-y-1 text-[10.5px]">
              <div className="flex items-center justify-between"><span className="text-muted">Widget endpoint</span><Badge tone="green">live</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted">Conversation intake</span><Badge tone="green">live chat queue</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted">Pre-chat form</span><Badge tone={widget.prechat_enabled ? 'teal' : 'slate'}>{widget.prechat_enabled ? 'on' : 'off'}</Badge></div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><Monitor className="h-3 w-3" /> Responsive</div>
            <p className="text-[10.5px] leading-snug text-muted">The widget adapts to mobile viewports, respects safe areas and honours <code className="rounded bg-surface2 px-1">prefers-reduced-motion</code>.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
