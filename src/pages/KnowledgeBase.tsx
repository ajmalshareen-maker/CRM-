import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen, Check, ChevronLeft, Edit3, Eye, ExternalLink, FileText, Globe, Lock, Plus, Save, Search,
  Sparkles, ThumbsUp, Trash2, X,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, formatDate, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Tabs, Textarea } from '../components/ui';
import type { Article, KbCategory } from '../lib/types';

export default function KnowledgeBase() {
  const [params, setParams] = useSearchParams();
  const { canWrite, canAdmin } = useAuth();
  const { push } = useToast();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [activeCat, setActiveCat] = useState('all');
  const [reading, setReading] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('northwind');

  const load = () => {
    setLoading(true);
    api.get<{ categories: KbCategory[]; articles: Article[] }>('/knowledge')
      .then((d) => { setCategories(d.categories); setArticles(d.articles); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = params.get('article');
    if (id && articles.length) {
      const a = articles.find((x) => x.id === id);
      if (a) setReading(a);
    }
  }, [params, articles]);

  const filtered = articles.filter((a) => {
    if (visibility !== 'all' && a.visibility !== visibility) return false;
    if (activeCat !== 'all' && a.categoryId !== activeCat) return false;
    if (q && !`${a.title} ${a.body}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const save = async () => {
    if (!editing?.title) return;
    setSaving(true);
    try {
      if (editing.id) await api.patch(`/knowledge/${editing.id}`, editing);
      else await api.post('/knowledge', editing);
      push({ title: 'Article saved', tone: 'success' });
      setEditing(null); load();
    } catch (e) { push({ title: 'Could not save', description: (e as Error).message, tone: 'error' }); }
    finally { setSaving(false); }
  };

  const remove = async (a: Article) => {
    try { await api.del(`/knowledge/${a.id}`); push({ title: 'Article deleted', tone: 'info' }); setReading(null); load(); }
    catch (e) { push({ title: 'Could not delete', description: (e as Error).message, tone: 'error' }); }
  };

  const catName = (id?: string) => categories.find((c) => c.id === id)?.name || 'Uncategorised';

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Knowledge Base" description="One source of truth for agents and customers — with AI retrieval built in."
        actions={<>
          <Button size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.open(`/help`, '_blank')}>Public help center</Button>
          <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({ title: '', body: '', visibility: 'internal', status: 'published', categoryId: categories[0]?.id })} disabled={!canWrite}>New article</Button>
        </>} />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search articles…" className="max-w-xs" />
        <Select size="sm" value={activeCat} onChange={setActiveCat} className="w-44" placeholder="All categories"
          options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select size="sm" value={visibility} onChange={setVisibility} className="w-36"
          options={[{ value: 'all', label: 'All visibility' }, { value: 'public', label: 'Public' }, { value: 'internal', label: 'Internal' }]} />
        <span className="ml-auto text-[11px] text-faint">{filtered.length} articles · {categories.length} categories</span>
      </div>

      <div className="rf-scroll flex-1 p-4">
        {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          : filtered.length === 0 ? <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No articles found" description="Publish your first article so agents can answer instantly and AI can ground its suggestions."
            action={<Button size="sm" variant="primary" onClick={() => setEditing({ title: '', body: '', visibility: 'internal', status: 'published' })} icon={<Plus className="h-3.5 w-3.5" />}>New article</Button>} />
          : (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="space-y-2">
                {filtered.map((a) => (
                  <Card key={a.id} className="group cursor-pointer p-3.5 transition hover:shadow-lift" onClick={() => { setReading(a); const n = new URLSearchParams(params); n.set('article', a.id); setParams(n, { replace: true }); }}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface3 text-navy/70 dark:text-teal"><FileText className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-[13px] font-semibold text-ink">{a.title}</h3>
                          <Badge tone={a.visibility === 'public' ? 'teal' : 'slate'}>
                            {a.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}{a.visibility}
                          </Badge>
                          {a.status !== 'published' && <Badge tone="amber">{a.status}</Badge>}
                        </div>
                        <p className="mt-0.5 rf-line-clamp-2 text-[11.5px] leading-snug text-muted">{a.body.replace(/[#*|]/g, '').slice(0, 220)}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-faint">
                          <span>{catName(a.categoryId)}</span>
                          <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{a.views.toLocaleString()}</span>
                          <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{a.helpful}</span>
                          <span>updated {timeAgo(a.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button onClick={(e) => { e.stopPropagation(); setEditing(a); }} className="rounded p-1 text-muted hover:bg-surface2 hover:text-ink"><Edit3 className="h-3.5 w-3.5" /></button>
                        {canAdmin && <button onClick={(e) => { e.stopPropagation(); remove(a); }} className="rounded p-1 text-muted hover:bg-surface2 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-3">
                <Card>
                  <div className="border-b border-line px-3.5 py-2.5 text-[12px] font-semibold text-ink">Categories</div>
                  <div className="p-1.5">
                    <button onClick={() => setActiveCat('all')} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition', activeCat === 'all' ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2')}>
                      <BookOpen className="h-3.5 w-3.5" /><span className="flex-1 text-left">All articles</span><span className="text-[10px]">{articles.length}</span>
                    </button>
                    {categories.map((c) => (
                      <button key={c.id} onClick={() => setActiveCat(c.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition', activeCat === c.id ? 'bg-teal/10 text-teal' : 'text-muted hover:bg-surface2')}>
                        <FileText className="h-3.5 w-3.5" /><span className="flex-1 truncate text-left">{c.name}</span><span className="text-[10px]">{c.count}</span>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="p-3.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Sparkles className="h-3.5 w-3.5 text-teal" /> AI knowledge retrieval</div>
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    Published articles are scored against each incoming conversation and suggested to agents automatically — and used to ground AI drafts.
                  </p>
                  <div className="mt-2 rounded-lg bg-surface2/60 px-2 py-1.5 text-[10.5px] text-faint">
                    {articles.filter((a) => a.visibility === 'public').length} public · {articles.filter((a) => a.visibility === 'internal').length} internal indexed
                  </div>
                </Card>
                <Card className="p-3.5">
                  <div className="text-[12px] font-semibold text-ink">Public help center</div>
                  <p className="mt-1 text-[11px] text-muted">Only articles marked public appear on your customer-facing help center.</p>
                  <Button size="sm" className="mt-2 w-full" onClick={() => window.open('/help', '_blank')} icon={<ExternalLink className="h-3.5 w-3.5" />}>Open help center</Button>
                </Card>
              </div>
            </div>
          )}
      </div>

      {/* reader */}
      <Modal open={!!reading} onClose={() => { setReading(null); const n = new URLSearchParams(params); n.delete('article'); setParams(n, { replace: true }); }}
        title={reading?.title || ''} description={reading ? `${catName(reading.categoryId)} · updated ${formatDate(reading.updatedAt)}` : ''}
        icon={<BookOpen className="h-4 w-4" />} size="lg"
        footer={reading && <>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/help?article=${reading.slug}`); push({ title: 'Public link copied', tone: 'success' }); }}>Copy link</Button>
          <Button size="sm" icon={<Edit3 className="h-3.5 w-3.5" />} onClick={() => { setEditing(reading); setReading(null); }} disabled={!canWrite}>Edit article</Button>
          <Button size="sm" variant="primary" onClick={() => setReading(null)}>Close</Button>
        </>}>
        {reading && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Badge tone={reading.visibility === 'public' ? 'teal' : 'slate'}>{reading.visibility}</Badge>
              <Badge tone="green">{reading.status}</Badge>
              <span className="text-[10.5px] text-faint">{reading.views} views · {reading.helpful} found helpful</span>
            </div>
            <article className="prose-rf space-y-2 text-[12.5px] leading-relaxed text-ink">
              {renderMarkdown(reading.body)}
            </article>
          </div>
        )}
      </Modal>

      {/* editor */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit article' : 'New article'} icon={<FileText className="h-4 w-4" />} size="xl"
        description="Markdown supported. Internal articles are visible only to your team."
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save} icon={<Save className="h-3.5 w-3.5" />} disabled={!editing?.title}>Save article</Button></>}>
        {editing && (
          <div className="space-y-3">
            <Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Article title" className="!text-[14px] !font-semibold" />
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={editing.categoryId || ''} onChange={(v) => setEditing({ ...editing, categoryId: v })} placeholder="Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              <Select value={editing.visibility || 'internal'} onChange={(v) => setEditing({ ...editing, visibility: v as any })} options={[{ value: 'internal', label: 'Internal only' }, { value: 'public', label: 'Public help center' }]} />
              <Select value={editing.status || 'published'} onChange={(v) => setEditing({ ...editing, status: v })} options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }]} />
            </div>
            <Textarea rows={16} value={editing.body || ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder={'## Section heading\n\nWrite your article in Markdown…'} className="!text-[12.5px] font-mono" />
            <Alert tone="info">Tip: AI retrieval uses the article title and body, so keep headings descriptive and answer the question in the first paragraph.</Alert>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function renderMarkdown(md: string) {
  const lines = String(md).split('\n');
  const out: React.ReactNode[] = [];
  let tableBuf: string[][] = [];
  const flushTable = () => {
    if (!tableBuf.length) return;
    const [head, , ...rows] = tableBuf;
    out.push(
      <div key={`t${out.length}`} className="my-2 overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-[11.5px]">
          <thead className="bg-surface2"><tr>{head.map((h, i) => <th key={i} className="px-2 py-1 text-left font-semibold text-ink">{h.trim()}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-2 py-1 text-muted">{c.trim()}</td>)}</tr>)}</tbody>
        </table>
      </div>,
    );
    tableBuf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('|')) { tableBuf.push(line.split('|').slice(1, -1)); return; }
    flushTable();
    if (!line) { out.push(<div key={i} className="h-1" />); return; }
    if (line.startsWith('### ')) { out.push(<h4 key={i} className="mt-2 text-[12.5px] font-semibold text-ink">{inline(line.slice(4))}</h4>); return; }
    if (line.startsWith('## ')) { out.push(<h3 key={i} className="mt-3 text-[13.5px] font-semibold text-ink">{inline(line.slice(3))}</h3>); return; }
    if (/^\d+\.\s/.test(line)) { out.push(<div key={i} className="ml-4 flex gap-1.5"><span className="text-faint">{line.match(/^\d+/)?.[0]}.</span><span>{inline(line.replace(/^\d+\.\s/, ''))}</span></div>); return; }
    if (line.startsWith('- ')) { out.push(<div key={i} className="ml-3 flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" /><span>{inline(line.slice(2))}</span></div>); return; }
    out.push(<p key={i}>{inline(line)}</p>);
  });
  flushTable();
  return out;
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-surface2 px-1 py-0.5 font-mono text-[11px] text-teal">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}
