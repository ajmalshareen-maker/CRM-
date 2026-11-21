import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Mail, MessageCircle, Search, Sparkles, ThumbsUp } from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn } from '../lib/utils';
import { Badge, Button, EmptyState, Input, SearchInput, Skeleton } from '../components/ui';
import { renderMarkdown } from './KnowledgeBase';

export default function HelpCenter() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openArticle, setOpenArticle] = useState<any>(null);
  const [cat, setCat] = useState<string | null>(null);

  useEffect(() => {
    api.get<any>('/public/help-center/northwind').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const allArticles = useMemo(() => (data?.categories || []).flatMap((c: any) => c.articles.map((a: any) => ({ ...a, category: c.name }))), [data]);
  const filtered = useMemo(() => allArticles.filter((a: any) => (!q || `${a.title} ${a.body}`.toLowerCase().includes(q.toLowerCase())) && (!cat || a.category === cat)), [allArticles, q, cat]);

  const brand = data?.org?.brandColor || '#21B8A6';

  if (loading) return <div className="p-8"><Skeleton className="mx-auto h-40 max-w-2xl" /></div>;

  return (
    <div className="min-h-full bg-bg">
      {/* header */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-5 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[11px] font-bold text-white" style={{ background: brand }}>{data.org.logoInitials}</span>
          <div>
            <div className="text-[13.5px] font-semibold text-ink">{data.org.name}</div>
            <div className="text-[10px] text-faint">Help center</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { location.href = '/'; }}>Agent app <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
        </div>
      </header>

      {openArticle ? (
        <main className="mx-auto max-w-3xl px-5 py-6">
          <button onClick={() => setOpenArticle(null)} className="mb-4 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />All articles</button>
          <Badge tone="teal">{openArticle.category}</Badge>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{openArticle.title}</h1>
          <p className="mt-1 text-[11.5px] text-faint">Updated {new Date(openArticle.updated_at).toLocaleDateString()}</p>
          <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink">{renderMarkdown(openArticle.body)}</div>
          <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-center">
            <p className="text-[12.5px] font-medium text-ink">Was this article helpful?</p>
            <div className="mt-2 flex justify-center gap-2">
              <Button size="sm" icon={<ThumbsUp className="h-3.5 w-3.5" />} onClick={() => alert('Thanks for the feedback!')}>Yes</Button>
              <Button size="sm" variant="ghost" onClick={() => alert('Thanks — we will improve this article.')}>Not really</Button>
            </div>
          </div>
        </main>
      ) : (
        <>
          <section className="relative overflow-hidden border-b border-line" style={{ background: `radial-gradient(700px 300px at 20% -30%, ${brand}22, transparent 65%), var(--rf-surface)` }}>
            <div className="mx-auto max-w-5xl px-5 py-10 text-center">
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">How can we help you today?</h1>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted">Search our knowledge base for instant answers, or start a chat with the team.</p>
              <div className="mx-auto mt-4 max-w-md">
                <SearchInput value={q} onChange={setQ} placeholder="Search articles — e.g. refund, tracking, SSO…" className="[&_input]:!h-11 [&_input]:!text-[13.5px]" />
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {['Refund', 'Tracking', 'Return label', 'SSO', 'WhatsApp'].map((t) => (
                  <button key={t} onClick={() => setQ(t)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-muted transition hover:border-teal hover:text-teal">{t}</button>
                ))}
              </div>
            </div>
          </section>

          <main className="mx-auto max-w-5xl px-5 py-6">
            {q && (
              <div className="mb-4">
                <h2 className="text-[13px] font-semibold text-ink">{filtered.length} results for “{q}”</h2>
              </div>
            )}
            {!q && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.categories.map((c: any) => (
                  <button key={c.id} onClick={() => setCat(cat === c.name ? null : c.name)}
                    className={cn('rounded-xl border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-lift', cat === c.name ? 'border-teal' : 'border-line')}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${brand}18`, color: brand }}><BookOpen className="h-4 w-4" /></span>
                    <h3 className="mt-2 text-[12.5px] font-semibold text-ink">{c.name}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{c.description}</p>
                    <p className="mt-1 text-[10px] text-faint">{c.articles.length} articles</p>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {filtered.map((a: any) => (
                <button key={a.id} onClick={() => setOpenArticle(a)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition hover:border-line-strong hover:shadow-soft">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{a.title}</span>
                    <span className="block truncate text-[10.5px] text-faint">{a.category} · {a.views} views</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                </button>
              ))}
              {filtered.length === 0 && <EmptyState icon={<Search className="h-5 w-5" />} title="No articles match" description="Try a different search term, or contact the team below." />}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal"><MessageCircle className="h-4 w-4" /></span>
                <h3 className="mt-2 text-[12.5px] font-semibold text-ink">Chat with support</h3>
                <p className="mt-0.5 text-[11px] text-muted">Use the chat bubble on any page of our store — average reply under 4 minutes.</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info"><Mail className="h-4 w-4" /></span>
                <h3 className="mt-2 text-[12.5px] font-semibold text-ink">Email us</h3>
                <p className="mt-0.5 text-[11px] text-muted">support@{data.org.slug}.io — we reply within one business day.</p>
              </div>
            </div>
          </main>
          <footer className="border-t border-line py-4 text-center text-[10.5px] text-faint">
            Powered by <span className="font-semibold text-muted">ReplyFlow</span> · Every conversation. One workspace.
          </footer>
        </>
      )}
    </div>
  );
}
