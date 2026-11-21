import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Brain, Check, ChevronRight, Clipboard, Copy, FileText, Languages, ListChecks, Loader2,
  MessageSquare, Send, Sparkles, Tags, Wand2, Zap, ShieldCheck, BarChart3, SmilePlus, Target, Info,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, formatDateTime, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Tabs, Textarea } from '../components/ui';
import { ChannelIcon } from '../components/ChannelIcon';

const TONES = ['professional', 'friendly', 'empathetic', 'concise', 'formal'];

export default function AIAssistant() {
  const { user, aiProvider, canWrite } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [q, setQ] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [output, setOutput] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [meta, setMeta] = useState<{ provider?: string; model?: string; note?: string; warning?: string }>({});
  const [language, setLanguage] = useState('Urdu');
  const [composeText, setComposeText] = useState('');
  const [tab, setTab] = useState('workspace');

  useEffect(() => {
    api.get<any>(`/conversations${qs({ pageSize: 40, sort: 'recent' })}`).then((d) => {
      setConversations(d.conversations);
      if (d.conversations[0]) setSelected(d.conversations[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setOutput(''); setOptions([]); setInsights(null); setMeta({});
    api.get<any>(`/conversations/${selected}`).then(setDetail);
    api.get<any>(`/ai/insights/${selected}`).then(setInsights).catch(() => {});
  }, [selected]);

  const run = async (action: string) => {
    if (!selected) return;
    setBusy(action);
    try {
      const d = await api.post<any>('/ai/assist', {
        conversationId: selected, action, tone, language, length,
        text: action === 'rewrite' || action === 'translate' ? (output || composeText) : '',
      });
      setMeta({ provider: d.provider, model: d.model, note: d.note, warning: d.warning });
      if (action === 'suggestions') { setOptions(d.options || []); setOutput(''); }
      else setOutput(d.text);
      if (d.structured) setInsights((cur: any) => ({ ...cur, ...d.structured }));
    } catch (e) { push({ title: 'AI request failed', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(null); }
  };

  const sendInto = () => {
    if (!output) return;
    navigate(`/inbox?c=${selected}`);
    push({ title: 'Opening conversation', description: 'Paste or edit the draft in the composer, then send.', tone: 'info' });
  };

  const conv = detail?.conversation;
  const filtered = conversations.filter((c) => !q || `${c.subject} ${c.customer.name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="AI Assistant" description="Draft, summarise, translate and triage — always with a human in the loop."
        actions={<>
          <Badge tone={aiProvider === 'live' ? 'green' : 'amber'} dot>{aiProvider === 'live' ? 'Live LLM provider' : 'Local assist engine'}</Badge>
        </>}>
        <div className="mt-2.5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'workspace', label: 'Assist workspace', icon: <Sparkles className="h-3 w-3" /> },
            { value: 'capabilities', label: 'Capabilities', icon: <ListChecks className="h-3 w-3" /> },
            { value: 'settings', label: 'AI settings', icon: <ShieldCheck className="h-3 w-3" /> },
          ]} />
        </div>
      </PageHeader>

      {tab === 'workspace' && (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
          {/* conversation picker */}
          <aside className="flex min-h-0 flex-col border-b border-line bg-surface lg:border-b-0 lg:border-r">
            <div className="border-b border-line p-2">
              <SearchInput value={q} onChange={setQ} placeholder="Find a conversation…" />
            </div>
            <div className="rf-scroll flex-1">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className={cn('flex w-full gap-2 border-b border-line/60 px-3 py-2 text-left transition', selected === c.id ? 'bg-teal/[0.07]' : 'hover:bg-surface2')}>
                  <Avatar name={c.customer.name} color={c.customer.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{c.customer.name}</span>
                    <span className="block truncate text-[10.5px] text-muted">{c.subject}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-faint"><ChannelIcon type={c.channelType} size="xs" />{timeAgo(c.lastMessageAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* workspace */}
          <div className="rf-scroll min-h-0 p-4">
            {!conv ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-3">
                <Card className="p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-semibold text-ink">{conv.subject}</h2>
                      <p className="mt-0.5 text-[11.5px] text-muted">{conv.customer.name} · {conv.ref} · {conv.channelName}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={conv.priority === 'urgent' ? 'red' : conv.priority === 'high' ? 'amber' : 'slate'}>{conv.priority}</Badge>
                      <Badge tone={conv.status === 'resolved' ? 'green' : 'teal'}>{conv.status}</Badge>
                      <Button size="sm" variant="secondary" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => navigate(`/inbox?c=${conv.id}`)}>Open thread</Button>
                    </div>
                  </div>

                  {insights && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <Mini label="Intent" value={insights.intent} icon={<Target className="h-3 w-3" />} />
                      <Mini label="Sentiment" value={insights.sentiment} icon={<SmilePlus className="h-3 w-3" />} tone={insights.sentiment === 'negative' ? 'danger' : insights.sentiment === 'positive' ? 'success' : 'muted'} />
                      <Mini label="Priority" value={insights.priority} icon={<Zap className="h-3 w-3" />} />
                      <Mini label="Messages" value={String(detail.messages.length)} icon={<MessageSquare className="h-3 w-3" />} />
                    </div>
                  )}
                  {insights?.suggestedArticles?.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] text-faint">Knowledge:</span>
                      {insights.suggestedArticles.map((a: any) => (
                        <button key={a.id} onClick={() => navigate(`/knowledge?article=${a.id}`)} className="flex items-center gap-1 rounded-md bg-surface2 px-1.5 py-0.5 text-[10.5px] text-muted hover:bg-teal/10 hover:text-teal">
                          <BookOpen className="h-2.5 w-2.5" />{a.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {insights?.tags?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] text-faint">Suggested tags:</span>
                      {insights.tags.map((t: string) => <Badge key={t} tone="teal" className="!text-[9.5px]">{t}</Badge>)}
                    </div>
                  )}
                </Card>

                <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="primary" icon={<Wand2 className="h-3.5 w-3.5" />} loading={busy === 'draft'} onClick={() => run('draft')} disabled={!canWrite}>Generate reply</Button>
                      <Button size="sm" icon={<ListChecks className="h-3.5 w-3.5" />} loading={busy === 'suggestions'} onClick={() => run('suggestions')}>Suggestions</Button>
                      <Button size="sm" icon={<FileText className="h-3.5 w-3.5" />} loading={busy === 'summarize'} onClick={() => run('summarize')}>Summarise</Button>
                      <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />} loading={busy === 'intent'} onClick={() => run('intent')}>Detect intent</Button>
                      <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} loading={busy === 'rewrite'} onClick={() => run('rewrite')}>Fix grammar</Button>
                      <Button size="sm" icon={<Languages className="h-3.5 w-3.5" />} loading={busy === 'translate'} onClick={() => run('translate')}>Translate</Button>
                    </div>

                    <div className="rounded-xl border border-line bg-surface">
                      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                          <Sparkles className="h-3 w-3 text-teal" /> Output
                          {meta.provider && <Badge tone={meta.provider === 'live' ? 'green' : 'amber'} className="!text-[9px]">{meta.provider === 'live' ? meta.model : 'local engine'}</Badge>}
                        </span>
                        {output && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { navigator.clipboard?.writeText(output); push({ title: 'Copied', tone: 'success' }); }} className="rounded p-1 text-muted hover:bg-surface2 hover:text-ink"><Copy className="h-3 w-3" /></button>
                            <button onClick={() => navigate(`/inbox?c=${selected}`)} className="rounded p-1 text-muted hover:bg-surface2 hover:text-teal" title="Use in inbox"><Send className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                      {busy ? (
                        <div className="flex items-center gap-2 px-3 py-8 text-[12px] text-muted"><Loader2 className="h-4 w-4 animate-spin text-teal" /> Thinking with conversation context and knowledge base…</div>
                      ) : options.length > 0 ? (
                        <div className="space-y-2 p-2">
                          {options.map((o, i) => (
                            <button key={i} onClick={() => { setOutput(o); setOptions([]); }} className="w-full rounded-lg border border-line p-2.5 text-left text-[12px] leading-relaxed text-ink transition hover:border-teal/50 hover:bg-teal/[0.03]">
                              <span className="mb-1 block text-[9.5px] font-semibold uppercase text-faint">Option {i + 1}</span>
                              <span className="whitespace-pre-wrap">{o}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Textarea rows={9} value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Choose an action above, or write here and use Fix grammar / Translate…" className="!rounded-t-none !border-0 !text-[12.5px]" />
                      )}
                    </div>

                    {(meta.note || meta.warning) && (
                      <Alert tone={meta.warning ? 'warning' : 'info'}>
                        {meta.warning || meta.note}
                      </Alert>
                    )}

                    {output && (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="primary" onClick={sendInto} icon={<Send className="h-3.5 w-3.5" />} disabled={!canWrite}>Review in inbox</Button>
                        <Button size="sm" onClick={() => run('rewrite')} icon={<Check className="h-3.5 w-3.5" />}>Improve</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setOutput(''); setMeta({}); }}>Clear</Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Card className="p-3">
                      <div className="mb-1.5 text-[11px] font-semibold text-ink">Tone</div>
                      <div className="flex flex-wrap gap-1">
                        {TONES.map((t) => (
                          <button key={t} onClick={() => setTone(t)}
                            className={cn('rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium capitalize transition',
                              tone === t ? 'border-teal bg-teal/10 text-teal' : 'border-line text-muted hover:text-ink')}>{t}</button>
                        ))}
                      </div>
                      <div className="mb-1.5 mt-2.5 text-[11px] font-semibold text-ink">Length</div>
                      <Select size="sm" value={length} onChange={setLength} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }]} />
                      <div className="mb-1 mt-2.5 text-[11px] font-semibold text-ink">Translation target</div>
                      <Select size="sm" value={language} onChange={setLanguage} options={['Urdu', 'Spanish', 'Arabic', 'French', 'German'].map((l) => ({ value: l, label: l }))} />
                    </Card>
                    <Card className="p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><ShieldCheck className="h-3 w-3 text-teal" /> Guardrails</div>
                      <ul className="space-y-1 text-[10.5px] leading-snug text-muted">
                        <li>• Never auto-sends — you approve every message.</li>
                        <li>• Grounded in this conversation + your knowledge base.</li>
                        <li>• Refunds and legal replies need human sign-off.</li>
                      </ul>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'capabilities' && <Capabilities />}
      {tab === 'settings' && <AISettings />}
    </div>
  );
}

function Capabilities() {
  const items = [
    ['AI-generated replies', 'Draft email and chat responses grounded in the thread and knowledge base.', Wand2],
    ['Suggested responses', 'Three distinct options for the same customer message.', ListChecks],
    ['Tone adjustment', 'Professional, friendly, empathetic, concise or formal — one click.', Sparkles],
    ['Grammar correction', 'Cleans up rushed internal drafts before they go out.', Check],
    ['Translation', 'Localise replies for multilingual customers and agents.', Languages],
    ['Conversation summary', 'Hand over context without reading the whole thread.', FileText],
    ['Intent detection', 'Classifies the customer’s actual ask for routing and reporting.', Target],
    ['Sentiment analysis', 'Flags rising frustration before it becomes a churn risk.', SmilePlus],
    ['Priority detection', 'Surfaces urgency from language and account context.', Zap],
    ['Suggested tags & categories', 'Keeps taxonomies consistent without manual work.', Tags],
    ['Knowledge retrieval', 'Pulls the right help article into the reply.', BookOpen],
    ['Human approval rules', 'High-impact responses always require explicit approval.', ShieldCheck],
  ];
  return (
    <div className="rf-scroll flex-1 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([title, desc, Icon]: any) => (
          <Card key={title} className="p-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal"><Icon className="h-4 w-4" /></span>
            <h3 className="mt-2 text-[12.5px] font-semibold text-ink">{title}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
          </Card>
        ))}
      </div>
      <Alert tone="info" title="Bring your own model" className="mt-4">
        ReplyFlow is provider-agnostic. Set <code className="rounded bg-surface2 px-1">REPLYFLOW_AI_BASE_URL</code>,
        <code className="mx-1 rounded bg-surface2 px-1">REPLYFLOW_AI_API_KEY</code> and
        <code className="mx-1 rounded bg-surface2 px-1">REPLYFLOW_AI_MODEL</code> to route requests to any OpenAI-compatible gateway.
        Until then the local assist engine handles drafting deterministically — and every response is labelled with its provider.
      </Alert>
    </div>
  );
}

function AISettings() {
  const { push } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>({ ai_auto_send: false, ai_approval_required: true, ai_provider: 'demo', ai_model: 'replyflow-assist-v2' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get<any>('/settings').then((d) => setSettings(d.workspace || {})); }, []);
  const save = async (next: any) => {
    setSaving(true);
    try { await api.patch('/settings/workspace', { workspace: next }); setSettings(next); push({ title: 'AI settings saved', tone: 'success' }); }
    catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
    finally { setSaving(false); }
  };
  return (
    <div className="rf-scroll flex-1 p-4 sm:p-6">
      <div className="max-w-2xl space-y-3">
        <Card>
          <CardHeader title="Model & provider" subtitle="Choose how ReplyFlow generates text" icon={<Brain className="h-4 w-4" />} />
          <div className="space-y-3 p-4">
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Provider</label>
              <Select value={settings.ai_provider || 'demo'} onChange={(v) => save({ ...settings, ai_provider: v })}
                options={[{ value: 'demo', label: 'Local assist engine (no credentials)' }, { value: 'openai', label: 'OpenAI-compatible endpoint' }, { value: 'azure', label: 'Azure OpenAI' }, { value: 'anthropic', label: 'Anthropic' }]} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Model name</label>
              <Input value={settings.ai_model || ''} onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })} onBlur={() => save(settings)} /></div>
            <Alert tone="info">API keys are configured as server environment variables and never stored in the browser.</Alert>
          </div>
        </Card>
        <Card>
          <CardHeader title="Approval rules" subtitle="AI never sends without a human" icon={<ShieldCheck className="h-4 w-4" />} />
          <div className="space-y-3 p-4">
            {[['ai_approval_required', 'Require agent approval before sending', 'Every AI draft lands in the composer for review.'], ['ai_auto_send', 'Auto-send low-risk replies (off by default)', 'Only for internal FAQ answers with a confidence above 0.95.']].map(([k, l, d]) => (
              <label key={k} className="flex items-start gap-2.5">
                <input type="checkbox" checked={!!settings[k]} onChange={(e) => save({ ...settings, [k]: e.target.checked })} disabled={saving} className="mt-0.5 h-4 w-4 accent-teal" />
                <span><span className="block text-[12.5px] font-medium text-ink">{l}</span><span className="block text-[11px] text-muted">{d}</span></span>
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface2/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wide text-faint">{icon}{label}</div>
      <div className={cn('mt-0.5 truncate text-[12px] font-semibold capitalize', tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink')}>{value}</div>
    </div>
  );
}
