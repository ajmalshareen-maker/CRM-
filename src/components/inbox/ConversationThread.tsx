import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, ArrowLeft, AtSign, Bell, Building2, Check, CheckCheck, ChevronDown, CircleDot, Clock, Copy,
  ExternalLink, FileText, Flame, Forward, Lock, Mail, MessageSquarePlus, MoreHorizontal, NotebookPen,
  Paperclip, PenLine, Plus, Reply, RotateCcw, Send, Sparkles, Star, StickyNote, Tag as TagIcon, Ticket,
  Trash2, UserPlus, Wand2, X, Zap, Languages, ListChecks, ThumbsUp, MapPin, Phone, ShoppingBag, History,
  SmilePlus, MessageCircle, Loader2, ShieldAlert, Info,
} from 'lucide-react';
import { api, qs } from '../../lib/api';
import { cn, clock, duration, formatDate, formatDateTime, money, priorityMeta, relativeDue, statusMeta, timeAgo, toneClasses } from '../../lib/utils';
import { useAuth, useRealtime, useToast } from '../../lib/store';
import { Alert, Avatar, Badge, Button, Checkbox, Dropdown, Input, MenuDivider, MenuItem, MenuLabel, Modal, Progress, Skeleton, Textarea, Toggle, Tooltip } from '../ui';
import { ChannelIcon, channelLabel, channelMetaFor } from '../ChannelIcon';
import type { Conversation, Message } from '../../lib/types';

interface Detail {
  conversation: Conversation;
  messages: Message[];
  customer: any;
  otherConversations: Conversation[];
  tickets: any[];
  audit: any[];
}

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'concise', label: 'Concise' },
  { value: 'formal', label: 'Formal' },
];

export function ConversationThread({ conversationId, onBack, onChanged, agents, tags, savedReplies, teams }: {
  conversationId: string;
  onBack: () => void;
  onChanged: (c?: Conversation) => void;
  agents: any[];
  tags: { name: string; color: string }[];
  savedReplies: { id: string; title: string; body: string; category: string }[];
  teams: { id: string; name: string; color: string }[];
}) {
  const { user, canWrite, aiProvider } = useAuth();
  const { push } = useToast();
  const { subscribe, send } = useRealtime();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reply' | 'note'>('reply');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTone, setAiTone] = useState('professional');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [translateLang, setTranslateLang] = useState('Urdu');
  const [replyAllTo, setReplyAllTo] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [signature, setSignature] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [typingWho, setTypingWho] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.get<Detail>(`/conversations/${conversationId}`);
      setDetail(d);
      setInsights(null);
      if (!silent) api.post(`/conversations/${conversationId}/read`).then(() => onChanged()).catch(() => {});
    } catch (e) {
      push({ title: 'Could not open conversation', description: (e as Error).message, tone: 'error' });
    } finally { setLoading(false); }
  }, [conversationId, push, onChanged]);

  useEffect(() => { load(); setDraft(''); setAttachments([]); setAiSuggestions([]); setTab('reply'); }, [conversationId, load]);

  useEffect(() => subscribe((e) => {
    if (e.type === 'message.created' && e.conversationId === conversationId) load(true);
    if (e.type === 'conversation.updated' && e.conversation?.id === conversationId) load(true);
    if (e.type === 'typing' && e.conversationId === conversationId && e.who !== user?.id) {
      setTypingWho(e.name || 'Someone');
      setTimeout(() => setTypingWho(null), 2500);
    }
  }), [subscribe, conversationId, load, user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [detail?.messages.length]);

  const conv = detail?.conversation;
  const customer = detail?.customer;

  const patch = async (body: Record<string, unknown>, msg?: string) => {
    try {
      const d = await api.patch<{ conversation: Conversation }>(`/conversations/${conversationId}`, body);
      setDetail((cur) => (cur ? { ...cur, conversation: d.conversation } : cur));
      onChanged(d.conversation);
      if (msg) push({ title: msg, tone: 'success' });
    } catch (e) { push({ title: 'Update failed', description: (e as Error).message, tone: 'error' }); }
  };

  const sendMessage = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const body = signature && tab === 'reply' ? `${draft}${signatureText(user?.name)}` : draft;
      const d = await api.post<any>(`/conversations/${conversationId}/messages`, {
        body, isInternal: tab === 'note', attachments,
        ...(cc || bcc ? { meta: { cc, bcc } } : {}),
      });
      setDraft(''); setAttachments([]); setAiSuggestions([]); setShowCc(false); setCc(''); setBcc('');
      await load(true);
      onChanged(d.conversation);
      push({
        title: tab === 'note' ? 'Internal note added' : 'Reply sent',
        description: tab === 'note' ? 'Only your team can see notes.' : d.delivery?.note,
        tone: 'success',
      });
    } catch (e) {
      push({ title: 'Message not sent', description: (e as Error).message, tone: 'error' });
    } finally { setSending(false); }
  };

  const runAi = async (action: string, extra?: Record<string, unknown>) => {
    setAiBusy(action);
    setAiNote(null);
    try {
      const d = await api.post<any>('/ai/assist', { conversationId, action, tone: aiTone, language: translateLang, text: draft, length: 'medium', ...extra });
      if (action === 'draft') {
        setDraft(d.text);
        setAiSuggestions([]);
        if (d.warning) setAiNote(d.warning);
        else if (d.note) setAiNote(d.note);
        push({ title: 'AI draft ready', description: `${d.provider === 'live' ? 'Generated by ' + d.model : 'Drafted by the local assist engine'} — review before sending.`, tone: 'info' });
      } else if (action === 'suggestions') {
        setAiSuggestions(d.options || []);
        setAiNote(d.note || null);
      } else if (action === 'rewrite') {
        if (!draft.trim()) { push({ title: 'Write something first', description: 'Add a draft, then ask AI to improve it.', tone: 'warning' }); return; }
        setDraft(d.text);
        push({ title: 'Draft improved', description: 'Grammar corrected and tone applied.', tone: 'success' });
      } else if (action === 'translate') {
        if (!draft.trim()) { push({ title: 'Nothing to translate', tone: 'warning' }); return; }
        setDraft(d.text);
        push({ title: `Translated to ${translateLang}`, description: d.note || 'Review before sending.', tone: 'success' });
      } else if (action === 'summarize') {
        await api.patch(`/conversations/${conversationId}`, {});
        setInsights({ summary: d.text });
        push({ title: 'Summary generated', tone: 'success' });
      } else if (action === 'intent') {
        setInsights({ ...(insights || {}), analysis: d.structured, raw: d.text });
      }
    } catch (e) {
      push({ title: 'AI request failed', description: (e as Error).message, tone: 'error' });
    } finally { setAiBusy(null); }
  };

  const loadInsights = async () => {
    try {
      const d = await api.get<any>(`/ai/insights/${conversationId}`);
      setInsights(d);
    } catch (e) { push({ title: 'Could not load insights', tone: 'error' }); }
  };

  const onFile = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setAttachments((a) => [...a, ...list]);
  };

  const addTag = (name: string) => {
    if (!conv) return;
    const next = Array.from(new Set([...(conv.tags || []), name]));
    patch({ tags: next }, `Tag “${name}” added`);
    setTagQuery('');
  };
  const removeTag = (name: string) => conv && patch({ tags: conv.tags.filter((t) => t !== name) }, 'Tag removed');

  const toggleStar = () => conv && patch({ starred: !conv.starred });
  const setStatus = (status: string) => patch({ status }, `Marked as ${status.replace('_', ' ')}`);

  if (loading) return <ThreadSkeleton onBack={onBack} />;
  if (!conv || !detail) return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-[13px] text-muted">Conversation unavailable.</p>
      <Button size="sm" onClick={onBack}>Back to list</Button>
    </div>
  );

  const slaDue = relativeDue(conv.slaDueAt);
  const isDemoChannel = conv.channelStatus === 'demo';
  const filteredTags = tags.filter((t) => !conv.tags?.includes(t.name) && t.name.toLowerCase().includes(tagQuery.toLowerCase())).slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* header */}
      <div className="shrink-0 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-start gap-2">
          <button onClick={onBack} className="mt-0.5 rounded-lg p-1 text-muted hover:bg-surface2 lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[14px] font-semibold text-ink">{conv.subject}</h2>
              <Tooltip label={conv.starred ? 'Unstar' : 'Star'}><button onClick={toggleStar} className="shrink-0 rounded p-1 hover:bg-surface2"><Star className={cn('h-3.5 w-3.5', conv.starred ? 'fill-warning text-warning' : 'text-faint')} /></button></Tooltip>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span className="font-medium text-ink">{conv.ref}</span>
              <span className="text-faint">·</span>
              <ChannelIcon type={conv.channelType} size="xs" />
              <span>{conv.channelName || channelLabel(conv.channelType)}</span>
              {isDemoChannel && <Badge tone="amber" className="!py-0 !text-[9.5px]">demo channel</Badge>}
              <span className="text-faint">·</span>
              <span>opened {formatDate(conv.createdAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Dropdown width="w-52" trigger={<Button size="sm" variant="secondary" icon={<Check className="h-3.5 w-3.5" />}>{statusMeta[conv.status]?.label || conv.status}<ChevronDown className="h-3 w-3" /></Button>}>
              {(close) => (
                <>
                  <MenuLabel>Set status</MenuLabel>
                  {Object.entries(statusMeta).map(([k, v]) => (
                    <MenuItem key={k} active={conv.status === k} onClick={() => { setStatus(k); close(); }}>{v.label}</MenuItem>
                  ))}
                  <MenuDivider />
                  <MenuItem icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => { setStatus('open'); close(); }}>Reopen</MenuItem>
                </>
              )}
            </Dropdown>
            <Dropdown width="w-48" trigger={<Button size="sm" variant="secondary" icon={<Flame className={cn('h-3.5 w-3.5', conv.priority === 'urgent' ? 'text-danger' : 'text-faint')} />}>{priorityMeta[conv.priority]?.label}</Button>}>
              {(close) => (
                <>
                  <MenuLabel>Priority</MenuLabel>
                  {Object.entries(priorityMeta).map(([k, v]) => (
                    <MenuItem key={k} active={conv.priority === k} onClick={() => { patch({ priority: k }, `Priority set to ${v.label}`); close(); }}>{v.label}</MenuItem>
                  ))}
                </>
              )}
            </Dropdown>
            <Dropdown width="w-52" trigger={<button className="rounded-lg p-2 text-muted hover:bg-surface2"><MoreHorizontal className="h-4 w-4" /></button>}>
              {(close) => (
                <>
                  <MenuItem icon={<Star className="h-3.5 w-3.5" />} onClick={() => { toggleStar(); close(); }}>{conv.starred ? 'Remove star' : 'Star conversation'}</MenuItem>
                  <MenuItem icon={<Clock className="h-3.5 w-3.5" />} onClick={() => { patch({ status: 'on_hold' }, 'Snoozed — status set to on hold'); close(); }}>Snooze (on hold)</MenuItem>
                  <MenuItem icon={<Ticket className="h-3.5 w-3.5" />} onClick={async () => {
                    close();
                    try {
                      await api.post('/tickets', { subject: conv.subject, description: `Created from ${conv.ref}`, customerId: conv.customer.id, conversationId: conv.id, priority: conv.priority });
                      push({ title: 'Ticket created', description: 'Linked to this conversation.', tone: 'success' });
                      load(true);
                    } catch (e) { push({ title: 'Could not create ticket', description: (e as Error).message, tone: 'error' }); }
                  }}>Convert to ticket</MenuItem>
                  <MenuItem icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(`${location.origin}/inbox?c=${conv.id}`); push({ title: 'Link copied', tone: 'success' }); close(); }}>Copy link</MenuItem>
                  <MenuItem icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => { close(); navigate(`/customers?id=${conv.customer.id}`); }}>Open customer record</MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<Archive className="h-3.5 w-3.5" />} onClick={() => { setStatus('closed'); close(); }}>Close conversation</MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        </div>

        {/* meta strip */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusMeta[conv.status]?.tone as any}>{statusMeta[conv.status]?.label || conv.status}</Badge>
          <Badge tone={priorityMeta[conv.priority]?.tone as any}>{priorityMeta[conv.priority]?.label}</Badge>
          {conv.slaState !== 'met' && (
            <Badge tone={conv.slaState === 'breached' ? 'red' : conv.slaState === 'at_risk' ? 'amber' : 'slate'}>
              <Clock className="h-2.5 w-2.5" /> SLA {conv.slaState === 'breached' ? slaDue.label : slaDue.label}
            </Badge>
          )}
          {conv.sentiment && <Badge tone={conv.sentiment === 'negative' ? 'red' : conv.sentiment === 'positive' ? 'green' : 'slate'}><SmilePlus className="h-2.5 w-2.5" />{conv.sentiment}</Badge>}
          {conv.tags?.map((t) => (
            <span key={t} className="group inline-flex items-center gap-1 rounded-md bg-surface2 px-1.5 py-0.5 text-[10.5px] text-muted">
              <TagIcon className="h-2.5 w-2.5" />{t}
              <button onClick={() => removeTag(t)} className="opacity-0 transition group-hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          <Dropdown width="w-48" trigger={
            <button className="rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[10.5px] text-faint hover:border-teal hover:text-teal">+ tag</button>
          }>
            {() => (
              <>
                <div className="p-1"><Input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="Find or add tag…" className="!h-7 !text-[12px]" /></div>
                {tagQuery && !tags.some((t) => t.name.toLowerCase() === tagQuery.toLowerCase()) && (
                  <MenuItem icon={<Plus className="h-3.5 w-3.5" />} onClick={() => addTag(tagQuery)}>Create “{tagQuery}”</MenuItem>
                )}
                {filteredTags.map((t) => <MenuItem key={t.name} icon={<span className="h-2 w-2 rounded-full" style={{ background: t.color }} />} onClick={() => addTag(t.name)}>{t.name}</MenuItem>)}
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="rf-scroll flex-1 px-3 py-3 sm:px-5">
            {/* assignment bar */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface2/50 px-2.5 py-1.5">
              <Dropdown width="w-56" trigger={
                <button className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted transition hover:bg-surface hover:text-ink">
                  <UserPlus className="h-3 w-3" />
                  {conv.assignee ? <><Avatar name={conv.assignee.name} color={conv.assignee.color} size="xs" className="!h-4 !w-4 !text-[8px]" /> {conv.assignee.name}</> : 'Assign agent'}
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              }>
                {(close) => (
                  <>
                    <MenuLabel>Assign to</MenuLabel>
                    <MenuItem icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => { patch({ assigneeId: null }, 'Unassigned'); close(); }}>Unassign</MenuItem>
                    <MenuItem active={conv.assignee?.id === user?.id} onClick={() => { patch({ assigneeId: user?.id }, 'Assigned to you'); close(); }}>
                      Assign to me
                    </MenuItem>
                    <MenuDivider />
                    {agents.map((a) => (
                      <MenuItem key={a.id} active={conv.assignee?.id === a.id} onClick={() => { patch({ assigneeId: a.id }, `Assigned to ${a.name}`); close(); }}
                        icon={<Avatar name={a.name} color={a.avatar_color} size="xs" className="!h-4 !w-4 !text-[8px]" />}>
                        {a.name}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Dropdown>
              <span className="h-3 w-px bg-line" />
              <Dropdown width="w-52" trigger={
                <button className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted transition hover:bg-surface hover:text-ink">
                  <Users2Icon /> {conv.teamName || 'Assign team'} <ChevronDown className="h-2.5 w-2.5" />
                </button>
              }>
                {(close) => teams.map((t) => (
                  <MenuItem key={t.id} active={conv.teamId === t.id} onClick={() => { patch({ teamId: t.id }, `Moved to ${t.name}`); close(); }}
                    icon={<span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}>{t.name}</MenuItem>
                ))}
              </Dropdown>
              <span className="ml-auto flex items-center gap-1.5">
                <button onClick={() => setShowCustomer((v) => !v)} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface hover:text-ink">
                  {showCustomer ? 'Hide' : 'Show'} customer
                </button>
                <Button size="xs" variant="primary" icon={<Check className="h-3 w-3" />}
                  onClick={() => patch({ status: conv.status === 'resolved' ? 'open' : 'resolved' }, conv.status === 'resolved' ? 'Reopened' : 'Conversation resolved')}>
                  {conv.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </Button>
              </span>
            </div>

            {/* messages */}
            <div className="space-y-3">
              {detail.messages.map((m, i) => (
                <MessageBubble key={m.id} message={m} conv={conv} prev={detail.messages[i - 1]} agents={agents} />
              ))}
              {typingWho && (
                <div className="flex items-center gap-1.5 pl-10 text-[11px] text-faint">
                  <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${i * 120}ms` }} />)}</span>
                  {typingWho} is typing…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* AI panel (inline) */}
            {(aiSuggestions.length > 0 || insights) && (
              <div className="mt-4 space-y-2">
                {insights?.summary && (
                  <Alert tone="info" title="AI conversation summary">
                    <p className="whitespace-pre-wrap">{insights.summary}</p>
                  </Alert>
                )}
                {insights?.analysis && (
                  <Alert tone="info" title="Intent, sentiment & priority">
                    <div className="grid grid-cols-3 gap-2">
                      <div><div className="text-[10px] uppercase text-faint">Intent</div><div className="font-medium text-ink">{insights.analysis.intent}</div></div>
                      <div><div className="text-[10px] uppercase text-faint">Sentiment</div><div className="font-medium capitalize text-ink">{insights.analysis.sentiment}</div></div>
                      <div><div className="text-[10px] uppercase text-faint">Priority</div><div className="font-medium capitalize text-ink">{insights.analysis.priority}</div></div>
                    </div>
                    {insights.analysis.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="text-[10.5px] text-faint">Suggested tags:</span>
                        {insights.analysis.tags.map((t: string) => (
                          <button key={t} onClick={() => addTag(t)} className="rounded bg-teal/10 px-1.5 py-0.5 text-[10.5px] font-medium text-teal hover:bg-teal/20">+ {t}</button>
                        ))}
                      </div>
                    )}
                  </Alert>
                )}
                {aiSuggestions.length > 0 && (
                  <div className="rounded-xl border border-teal/25 bg-teal/[0.04] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-teal" /> Suggested replies
                      <span className="ml-auto text-[10px] font-normal text-faint">Review & edit before sending</span>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map((s, i) => (
                        <button key={i} onClick={() => { setDraft(s); setAiSuggestions([]); composerRef.current?.focus(); }}
                          className="w-full rounded-lg border border-line bg-surface p-2.5 text-left text-[12px] leading-relaxed text-ink transition hover:border-teal/50 hover:bg-teal/[0.03]">
                          <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-faint">Option {i + 1}</span>
                          <span className="whitespace-pre-wrap">{s.slice(0, 320)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {aiNote && <p className="text-[10.5px] text-faint">{aiNote}</p>}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2 sm:px-5">
            <div className="mb-2 flex items-center gap-1">
              <button onClick={() => setTab('reply')}
                className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition',
                  tab === 'reply' ? 'bg-teal/12 text-teal' : 'text-muted hover:bg-surface2')}>
                <Reply className="h-3 w-3" /> Reply
              </button>
              <button onClick={() => setTab('note')}
                className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition',
                  tab === 'note' ? 'bg-warning/12 text-warning' : 'text-muted hover:bg-surface2')}>
                <StickyNote className="h-3 w-3" /> Internal note
              </button>
              {replyAllTo.length > 0 && <span className="ml-1 text-[10.5px] text-faint">Reply-all to {replyAllTo.length} recipients</span>}
              <div className="ml-auto flex items-center gap-1">
                <Dropdown width="w-56" trigger={<button className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:bg-surface2">Templates</button>}>
                  {(close) => (
                    <>
                      <MenuLabel>Saved replies</MenuLabel>
                      {savedReplies.map((r) => (
                        <MenuItem key={r.id} onClick={() => { setDraft(renderTemplate(r.body, conv, user)); setTab('reply'); close(); }}
                          icon={<FileText className="h-3.5 w-3.5" />}>{r.title}</MenuItem>
                      ))}
                      <MenuDivider />
                      <MenuItem icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { close(); navigate('/settings?tab=replies'); }}>Manage templates</MenuItem>
                    </>
                  )}
                </Dropdown>
                <Button size="xs" variant="soft" icon={<Sparkles className="h-3 w-3" />} onClick={() => setAiOpen(true)}>AI assist</Button>
              </div>
            </div>

            {showCc && tab === 'reply' && (
              <div className="mb-2 grid gap-1.5 sm:grid-cols-2">
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc — comma separated" className="!h-8 !text-[12px]" />
                <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Bcc — comma separated" className="!h-8 !text-[12px]" />
              </div>
            )}

            <div className={cn('rounded-xl border transition', tab === 'note' ? 'border-warning/40 bg-warning/[0.04]' : 'border-line bg-surface focus-within:border-teal/60 focus-within:ring-2 focus-within:ring-teal/12')}>
              {tab === 'note' && (
                <div className="flex items-center gap-1.5 border-b border-warning/25 px-3 py-1.5 text-[10.5px] font-medium text-warning">
                  <Lock className="h-3 w-3" /> Internal note — not visible to the customer
                </div>
              )}
              <Textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (e.target.value.length === 3) send({ type: 'typing', conversationId, who: user?.id, name: user?.name });
                }}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                rows={4}
                placeholder={tab === 'note' ? 'Leave a note for your teammates…' : `Reply to ${conv.customer.name} via ${channelLabel(conv.channelType)}…`}
                className="!rounded-none !border-0 !bg-transparent !px-3 !py-2.5 !text-[12.5px] focus:!ring-0"
              />
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  {attachments.map((a, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-md border border-line bg-surface2 px-1.5 py-0.5 text-[10.5px] text-muted">
                      <Paperclip className="h-2.5 w-2.5" />{a.name}
                      <button onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 border-t border-line/70 px-2 py-1.5">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFile(e.target.files)} />
                <Tooltip label="Attach file"><button onClick={() => fileRef.current?.click()} className="rounded p-1.5 text-faint hover:bg-surface2 hover:text-ink"><Paperclip className="h-3.5 w-3.5" /></button></Tooltip>
                <Tooltip label="Cc / Bcc"><button onClick={() => setShowCc((v) => !v)} className="rounded p-1.5 text-faint hover:bg-surface2 hover:text-ink"><AtSign className="h-3.5 w-3.5" /></button></Tooltip>
                <Tooltip label="Insert saved reply">
                  <Dropdown width="w-56" trigger={<button className="rounded p-1.5 text-faint hover:bg-surface2 hover:text-ink"><FileText className="h-3.5 w-3.5" /></button>}>
                    {(close) => savedReplies.map((r) => (
                      <MenuItem key={r.id} onClick={() => { setDraft((d) => (d ? d + '\n\n' : '') + renderTemplate(r.body, conv, user)); close(); }}>{r.title}</MenuItem>
                    ))}
                  </Dropdown>
                </Tooltip>
                <Tooltip label={signature ? 'Signature on' : 'Signature off'}>
                  <button onClick={() => setSignature((v) => !v)} className={cn('rounded p-1.5 hover:bg-surface2', signature ? 'text-teal' : 'text-faint hover:text-ink')}><PenLine className="h-3.5 w-3.5" /></button>
                </Tooltip>
                <span className="ml-auto hidden items-center gap-1.5 text-[10px] text-faint sm:flex">
                  {tab === 'reply' && <><span className="h-1.5 w-1.5 rounded-full bg-teal" />Sends via {channelLabel(conv.channelType)}</>}
                  {isDemoChannel && <Badge tone="amber" className="!py-0 !text-[9px]">stored in ReplyFlow only</Badge>}
                  <span className="hidden md:inline">⌘↵ to send</span>
                </span>
                <Button size="sm" variant={tab === 'note' ? 'navy' : 'primary'} loading={sending} onClick={sendMessage}
                  icon={tab === 'note' ? <StickyNote className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  disabled={!canWrite}>
                  {tab === 'note' ? 'Add note' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* customer sidebar */}
        {showCustomer && (
          <aside className="hidden w-[290px] shrink-0 overflow-y-auto border-l border-line bg-surface2/40 xl:block">
            <CustomerPanel detail={detail} agents={agents} onNoteAdded={() => load(true)} />
          </aside>
        )}
      </div>

      {/* AI modal */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="AI writing assistant" icon={<Sparkles className="h-4 w-4" />} size="lg"
        description={aiProvider === 'live' ? 'Connected to your LLM provider. Every draft is reviewed by you before sending.' : 'Local assist engine active — configure an LLM provider for richer generation.'}>
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[11.5px] font-medium text-muted">Tone</div>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button key={t.value} onClick={() => setAiTone(t.value)}
                  className={cn('rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition',
                    aiTone === t.value ? 'border-teal bg-teal/10 text-teal' : 'border-line text-muted hover:border-line-strong hover:text-ink')}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" icon={<Wand2 className="h-3.5 w-3.5" />} loading={aiBusy === 'draft'} onClick={() => runAi('draft')} disabled={!canWrite}>Generate reply</Button>
            <Button icon={<ListChecks className="h-3.5 w-3.5" />} loading={aiBusy === 'suggestions'} onClick={() => runAi('suggestions')}>3 suggestions</Button>
            <Button icon={<Check className="h-3.5 w-3.5" />} loading={aiBusy === 'rewrite'} onClick={() => runAi('rewrite')}>Fix grammar & tone</Button>
            <Button icon={<Sparkles className="h-3.5 w-3.5" />} loading={aiBusy === 'summarize'} onClick={() => runAi('summarize')}>Summarise thread</Button>
            <Button icon={<Zap className="h-3.5 w-3.5" />} loading={aiBusy === 'intent'} onClick={() => runAi('intent')}>Detect intent</Button>
            <Button icon={<Info className="h-3.5 w-3.5" />} loading={aiBusy === 'insights'} onClick={async () => { setAiBusy('insights'); await loadInsights(); setAiBusy(null); }}>Knowledge suggestions</Button>
          </div>
          <div className="rounded-lg border border-line bg-surface2/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted">Translate draft</span>
              <select value={translateLang} onChange={(e) => setTranslateLang(e.target.value)} className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink">
                {['Urdu', 'Spanish', 'Arabic', 'French', 'German'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <Button size="sm" icon={<Languages className="h-3.5 w-3.5" />} loading={aiBusy === 'translate'} onClick={() => runAi('translate')} className="w-full">Translate current draft</Button>
          </div>
          <Alert tone="warning" title="Human approval required">
            ReplyFlow never auto-sends AI output. Drafts land in the composer for you to review, edit and send.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------- message bubble ---------------------------- */
function MessageBubble({ message, conv, prev, agents }: { message: Message; conv: Conversation; prev?: Message; agents: any[] }) {
  const isCustomer = message.authorType === 'customer';
  const agent = agents.find((a) => a.id === message.authorId);
  const meta = message.meta || {};
  const delivery = meta.delivery;

  if (message.isInternal) {
    return (
      <div className="ml-8 rounded-xl border border-warning/30 bg-warning/[0.06] p-3 rf-animate-in">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-warning">
          <Lock className="h-3 w-3" /> Internal note
          <span className="font-normal text-faint">· {message.authorName} · {formatDateTime(message.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{message.body}</p>
      </div>
    );
  }

  const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
  return (
    <>
      {showDay && (
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-faint">{formatDate(message.createdAt, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className={cn('flex gap-2.5 rf-animate-in', isCustomer ? '' : 'flex-row-reverse')}>
        <Avatar name={message.authorName || conv.customer.name} color={isCustomer ? conv.customer.color : (agent?.avatar_color || '#4C7DF0')} size="sm" className="mt-0.5" />
        <div className={cn('min-w-0 max-w-[85%]', isCustomer ? '' : 'items-end')}>
          <div className={cn('mb-1 flex items-center gap-1.5 text-[10.5px]', isCustomer ? '' : 'justify-end')}>
            <span className="font-semibold text-ink">{message.authorName || conv.customer.name}</span>
            <span className="text-faint">{clock(message.createdAt)}</span>
            {!isCustomer && message.status === 'delivered' && <span title="Delivered"><CheckCheck className="h-3 w-3 text-teal" /></span>}
            {!isCustomer && message.status === 'sent' && <span title="Sent"><Check className="h-3 w-3 text-faint" /></span>}
            {meta.ai && <Badge tone="violet" className="!py-0 !text-[8.5px]">AI assisted</Badge>}
          </div>
          <div className={cn('rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-[0_1px_2px_rgba(20,45,70,0.04)]',
            isCustomer ? 'rounded-tl-md border border-line bg-surface text-ink' : 'rounded-tr-md bg-navy text-white/95 dark:bg-[#17796e] dark:text-white')}>
            <p className="whitespace-pre-wrap">{linkify(message.body)}</p>
            {message.attachments?.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-white/15 pt-2">
                {message.attachments.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-[11px] opacity-90"><Paperclip className="h-3 w-3" />{a.name}</span>
                ))}
              </div>
            )}
          </div>
          {delivery?.demo && (
            <div className={cn('mt-1 flex items-center gap-1 text-[9.5px] text-warning', !isCustomer && 'justify-end')}>
              <Info className="h-2.5 w-2.5" /> Stored in ReplyFlow — {delivery.note}
            </div>
          )}
          {isCustomer && meta.pageUrl && (
            <div className="mt-1 text-[9.5px] text-faint">via chat · {String(meta.pageUrl).slice(0, 46)}</div>
          )}
        </div>
      </div>
    </>
  );
}

function linkify(text: string) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer" className="underline underline-offset-2 opacity-90 hover:opacity-100">{p}</a>
    : <span key={i}>{p}</span>));
}

/* ---------------------------- customer panel ---------------------------- */
function CustomerPanel({ detail, agents, onNoteAdded }: { detail: Detail; agents: any[]; onNoteAdded: () => void }) {
  const { conversation: conv, customer } = detail;
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const { push } = useToast();
  const navigate = useNavigate();

  const addNote = async () => {
    if (!note.trim()) return;
    setAdding(true);
    try {
      await api.post(`/customers/${customer.id}/notes`, { title: 'Note added', body: note });
      setNote(''); push({ title: 'Note saved to customer timeline', tone: 'success' }); onNoteAdded();
    } catch (e) { push({ title: 'Could not save note', description: (e as Error).message, tone: 'error' }); }
    finally { setAdding(false); }
  };

  const channelSet = Array.from(new Set(detail.otherConversations.map((c) => c.channelType).concat(conv.channelType)));

  return (
    <div className="p-3">
      <div className="rounded-xl border border-line bg-surface p-3 text-center">
        <Avatar name={customer.name} color={customer.avatar_color} size="xl" className="mx-auto" />
        <h3 className="mt-2 text-[13.5px] font-semibold text-ink">{customer.name}</h3>
        <p className="text-[11px] text-muted">{customer.email}</p>
        {customer.company && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-surface2 px-2 py-0.5 text-[10.5px] text-muted">
            <Building2 className="h-2.5 w-2.5" />{customer.company}
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {customer.tags?.map((t: string) => <Badge key={t} tone="teal" className="!text-[9.5px]">{t}</Badge>)}
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-lg bg-surface2/60 py-2 text-center">
          <div><div className="text-[13px] font-semibold text-ink">{customer.lifetime_conversations}</div><div className="text-[9.5px] text-faint">Convos</div></div>
          <div><div className="text-[13px] font-semibold text-ink">{detail.tickets.length}</div><div className="text-[9.5px] text-faint">Tickets</div></div>
          <div><div className="text-[13px] font-semibold text-ink">{money(customer.ltv)}</div><div className="text-[9.5px] text-faint">LTV</div></div>
        </div>
        <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => navigate(`/customers?id=${customer.id}`)}>Open full profile</Button>
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl border border-line bg-surface p-3 text-[11.5px]">
        <Row icon={<Mail className="h-3 w-3" />} label="Email" value={customer.email} />
        <Row icon={<Phone className="h-3 w-3" />} label="Phone" value={customer.phone || '—'} />
        <Row icon={<MapPin className="h-3 w-3" />} label="Location" value={customer.location || '—'} />
        <Row icon={<History className="h-3 w-3" />} label="Last seen" value={timeAgo(customer.last_seen_at)} />
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-faint">Channels</span>
          <span className="ml-auto flex gap-1">{channelSet.map((c) => <ChannelIcon key={c} type={c} size="xs" />)}</span>
        </div>
      </div>

      {detail.tickets.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Linked tickets</div>
          {detail.tickets.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 py-0.5 text-[11px]">
              <Ticket className="h-3 w-3 text-faint" />
              <span className="truncate text-ink">#{t.number} {t.subject}</span>
              <Badge tone={statusMeta[t.status]?.tone as any} className="ml-auto !py-0 !text-[9px]">{t.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {customer.orders?.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><ShoppingBag className="h-3 w-3" /> Order history</div>
          {customer.orders.slice(0, 4).map((o: any) => (
            <div key={o.id} className="flex items-center gap-1.5 border-t border-line/60 py-1 text-[10.5px] first:border-0">
              <span className="font-medium text-ink">{o.number}</span>
              <span className="text-faint">{formatDate(o.placed_at)}</span>
              <span className="ml-auto font-semibold text-ink">{money(o.total, o.currency)}</span>
              <Badge tone={o.status === 'refunded' ? 'red' : o.status === 'fulfilled' ? 'green' : 'blue'} className="!py-0 !text-[9px]">{o.status}</Badge>
            </div>
          ))}
          <p className="mt-1 text-[9.5px] text-faint">Orders synced from connected commerce platforms. Demo data.</p>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-line bg-surface p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><NotebookPen className="h-3 w-3" /> Internal note</div>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for your team…" className="!text-[11.5px]" />
        <Button size="xs" className="mt-1.5 w-full" loading={adding} onClick={addNote}>Save note</Button>
      </div>

      {detail.otherConversations.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Previous conversations</div>
          {detail.otherConversations.map((c) => (
            <div key={c.id} className="border-t border-line/60 py-1 first:border-0">
              <div className="truncate text-[10.5px] text-ink">{c.subject}</div>
              <div className="flex items-center gap-1 text-[9.5px] text-faint">
                <ChannelIcon type={c.channelType} size="xs" />{timeAgo(c.lastMessageAt)} · {c.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.audit?.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Audit trail</div>
          {detail.audit.slice(0, 5).map((a) => (
            <div key={a.id} className="border-t border-line/60 py-1 text-[10px] first:border-0">
              <span className="text-ink">{a.action.replace(/\./g, ' ')}</span>
              <span className="text-faint"> · {a.user_name} · {timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-faint">{icon}</span>
      <span className="text-faint">{label}</span>
      <span className="ml-auto truncate font-medium text-ink">{value}</span>
    </div>
  );
}

function signatureText(name?: string) {
  return `\n\n— ${name || 'Support'}\nNorthwind Support · replyflow.app`;
}

function renderTemplate(body: string, conv: Conversation, user: any) {
  return body
    .replace(/\{\{customer\.first_name\}\}/g, conv.customer.name.split(' ')[0])
    .replace(/\{\{customer\.name\}\}/g, conv.customer.name)
    .replace(/\{\{agent\.first_name\}\}/g, (user?.name || '').split(' ')[0])
    .replace(/\{\{order\.number\}\}/g, '#48213')
    .replace(/\{\{order\.status\}\}/g, 'in transit')
    .replace(/\{\{order\.eta\}\}/g, 'Thursday')
    .replace(/\{\{refund\.amount\}\}/g, '$248.00');
}

const Users2Icon = () => <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;

function ThreadSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded p-1 text-muted lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="mt-2 h-3 w-40" />
      </div>
      <div className="flex-1 space-y-4 p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('flex gap-2.5', i % 2 && 'flex-row-reverse')}>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className={cn('flex-1 space-y-2', i % 2 && 'items-end')}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className={cn('h-16', i % 2 ? 'w-2/3' : 'w-3/4')} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3"><Skeleton className="h-24 w-full" /></div>
    </div>
  );
}
