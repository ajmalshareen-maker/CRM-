import { useEffect, useState } from 'react';
import { Building2, ExternalLink, Globe, Mail, Users } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/utils';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Progress, SearchInput, Skeleton } from '../components/ui';

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get<{ companies: any[] }>('/companies').then((d) => setCompanies(d.companies)).finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.domain?.includes(q.toLowerCase()));
  const maxLtv = Math.max(1, ...companies.map((c) => c.ltv));

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Companies" description="Group customers by account to see revenue, volume and open work at a glance."
        actions={<SearchInput value={q} onChange={setQ} placeholder="Search companies…" className="w-56" />} />

      <div className="p-4 sm:p-6">
        {loading ? <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
          : filtered.length === 0 ? <EmptyState icon={<Building2 className="h-5 w-5" />} title="No companies yet" description="Companies are linked to customers so you can report on accounts rather than individuals." />
          : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ['Accounts', companies.length],
                  ['Customers', companies.reduce((a, c) => a + c.customers, 0)],
                  ['Total MRR', money(companies.reduce((a, c) => a + (c.mrr || 0), 0))],
                  ['Conversations', companies.reduce((a, c) => a + c.conversations, 0)],
                ].map(([l, v]) => (
                  <Card key={l as string} className="p-3.5">
                    <div className="text-[10.5px] uppercase tracking-wide text-faint">{l}</div>
                    <div className="mt-1 text-[19px] font-semibold text-ink">{v}</div>
                  </Card>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map((c) => (
                  <Card key={c.id} className="p-4 transition hover:shadow-lift">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white" style={{ background: c.color }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-[13.5px] font-semibold text-ink">{c.name}</h3>
                          <Badge tone={c.plan === 'Enterprise' ? 'violet' : c.plan === 'Scale' ? 'blue' : 'teal'} className="!text-[9.5px]">{c.plan}</Badge>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                          <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{c.domain}</span>
                          <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{c.customers} customers</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-ink">{money(c.mrr)}</div>
                        <div className="text-[9.5px] text-faint">MRR</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-surface2/60 py-1.5"><div className="text-[12.5px] font-semibold text-ink">{c.conversations}</div><div className="text-[9px] text-faint">Conversations</div></div>
                      <div className="rounded-lg bg-surface2/60 py-1.5"><div className="text-[12.5px] font-semibold text-ink">{money(c.ltv)}</div><div className="text-[9px] text-faint">Customer LTV</div></div>
                      <div className="rounded-lg bg-surface2/60 py-1.5"><div className="text-[12.5px] font-semibold text-ink">{c.industry}</div><div className="text-[9px] text-faint">Industry</div></div>
                    </div>
                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-faint"><span>Share of customer value</span><span>{Math.round((c.ltv / maxLtv) * 100)}%</span></div>
                      <Progress value={(c.ltv / maxLtv) * 100} tone="teal" />
                    </div>
                    {c.notes && <p className="mt-2 text-[10.5px] leading-snug text-faint">{c.notes}</p>}
                  </Card>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
