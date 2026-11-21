import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Mail, MapPin, Phone, Plus, Search, ShoppingBag, Tag, Users, MessageSquare, Ticket as TicketIcon, NotebookPen, X, Filter } from 'lucide-react';
import { api, qs } from '../lib/api';
import { cn, formatDate, money, statusMeta, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, SearchInput, Select, Skeleton, Textarea } from '../components/ui';
import { ChannelIcon } from '../components/ChannelIcon';

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const { canWrite } = useAuth();
  const { push } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [allTags, setAllTags] = useState<{ name: string; color: string }[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', companyId: '', location: '', tags: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [sort, setSort] = useState('recent');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ customers: any[] }>(`/customers${qs({ q, tag })}`);
      setCustomers(d.customers);
    } finally { setLoading(false); }
  }, [q, tag]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get<any>('/settings').then((d) => setAllTags(d.tags));
    api.get<any>('/companies').then((d) => setCompanies(d.companies));
  }, []);

  const openCustomer = async (id: string) => {
    const d = await api.get(`/customers/${id}`);
    setDetail(d);
    const n = new URLSearchParams(params); n.set('id', id); setParams(n, { replace: true });
  };

  useEffect(() => { const id = params.get('id'); if (id) openCustomer(id).catch(() => {}); }, []);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/customers', {
        ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        companyId: form.companyId || undefined,
      });
      setCreateOpen(false); setForm({ name: '', email: '', phone: '', companyId: '', location: '', tags: '' });
      push({ title: 'Customer created', tone: 'success' }); load();
    } catch (e) { push({ title: 'Could not create customer', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!note.trim() || !detail) return;
    await api.post(`/customers/${detail.customer.id}/notes`, { title: 'Note added', body: note });
    setNote(''); push({ title: 'Note added to timeline', tone: 'success' });
    openCustomer(detail.customer.id);
  };

  const sorted = [...customers].sort((a, b) => {
    if (sort === 'ltv') return b.ltv - a.ltv;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'conversations') return b.conversations - a.conversations;
    return new Date(b.lastTouch || b.createdAt).getTime() - new Date(a.lastTouch || a.createdAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Customers" description="A single profile for every person who contacts you — across every channel."
        actions={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)} disabled={!canWrite}>New customer</Button>} />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email or phone…" className="max-w-xs" />
        <Select size="sm" value={tag} onChange={setTag} className="w-36" placeholder="All tags"
          options={[{ value: '', label: 'All tags' }, ...allTags.map((t) => ({ value: t.name, label: t.name }))]} />
        <Select size="sm" value={sort} onChange={setSort} className="w-40"
          options={[{ value: 'recent', label: 'Recent activity' }, { value: 'ltv', label: 'Lifetime value' }, { value: 'conversations', label: 'Conversations' }, { value: 'name', label: 'Name A–Z' }]} />
        <span className="ml-auto text-[11px] text-faint">{customers.length} customers</span>
      </div>

      <div className="rf-scroll flex-1 p-4">
        {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          : customers.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} title="No customers found" description="Customers appear here automatically when they contact any connected channel, or you can add them manually."
            action={<Button size="sm" variant="primary" onClick={() => setCreateOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>Add customer</Button>} />
          : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((c) => (
                <Card key={c.id} className="group cursor-pointer p-3.5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => openCustomer(c.id)}>
                  <div className="flex items-start gap-2.5">
                    <Avatar name={c.name} color={c.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-[13px] font-semibold text-ink">{c.name}</h3>
                        {c.openTickets > 0 && <Badge tone="amber" className="!py-0 !text-[9px]">{c.openTickets} open</Badge>}
                      </div>
                      <p className="truncate text-[11px] text-muted">{c.email}</p>
                      {c.company && <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-faint"><Building2 className="h-2.5 w-2.5" />{c.company}</p>}
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-ink">{money(c.ltv)}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {c.tags?.slice(0, 3).map((t: string) => <Badge key={t} tone="teal" className="!text-[9.5px]">{t}</Badge>)}
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-surface2/60 py-1.5 text-center">
                    <div><div className="text-[12px] font-semibold text-ink">{c.conversations}</div><div className="text-[9px] text-faint">Convos</div></div>
                    <div><div className="text-[12px] font-semibold text-ink">{c.openTickets}</div><div className="text-[9px] text-faint">Open</div></div>
                    <div><div className="text-[12px] font-semibold text-ink">{c.lastTouch ? timeAgo(c.lastTouch).replace(' ago', '') : '—'}</div><div className="text-[9px] text-faint">Last touch</div></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New customer" icon={<Users className="h-4 w-4" />} size="md"
        description="Emails are treated as verified identifiers — duplicates are rejected."
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={create} disabled={!form.name}>Create customer</Button></>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Full name *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Location</label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" /></div>
          </div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Company</label>
            <Select value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} placeholder="No company" options={companies.map((c) => ({ value: c.id, label: c.name }))} /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Tags (comma separated)</label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, Wholesale" /></div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => { setDetail(null); const n = new URLSearchParams(params); n.delete('id'); setParams(n, { replace: true }); }}
        title={detail?.customer?.name || ''} description={detail?.customer?.email} icon={<Users className="h-4 w-4" />} size="xl">
        {detail && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ['Lifetime value', money(detail.customer.ltv)],
                ['Conversations', detail.conversations.length],
                ['Tickets', detail.tickets.length],
                ['Orders', detail.orders.length],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-line bg-surface2/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-faint">{l}</div>
                  <div className="text-[15px] font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-line p-3 text-[12px]">
                <div className="mb-1.5 text-[11px] font-semibold text-ink">Contact details</div>
                <DetailRow icon={<Mail className="h-3 w-3" />} v={detail.customer.email} />
                <DetailRow icon={<Phone className="h-3 w-3" />} v={detail.customer.phone} />
                <DetailRow icon={<MapPin className="h-3 w-3" />} v={detail.customer.location} />
                <DetailRow icon={<Building2 className="h-3 w-3" />} v={detail.customer.company_name} />
                <DetailRow icon={<Tag className="h-3 w-3" />} v={detail.customer.tags?.join(', ') || '—'} />
                <DetailRow icon={<Users className="h-3 w-3" />} v={`Customer since ${formatDate(detail.customer.created_at)}`} />
              </div>

              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 text-[11px] font-semibold text-ink">Orders</div>
                {detail.orders.length === 0 && <p className="text-[11px] text-faint">No orders synced. Connect Shopify or a marketplace to enrich this profile.</p>}
                {detail.orders.slice(0, 4).map((o: any) => (
                  <div key={o.id} className="flex items-center gap-1.5 border-t border-line/60 py-1 text-[11px] first:border-0">
                    <ShoppingBag className="h-3 w-3 text-faint" />
                    <span className="font-medium text-ink">{o.number}</span>
                    <span className="text-faint">{formatDate(o.placed_at)}</span>
                    <span className="ml-auto font-semibold text-ink">{money(o.total, o.currency)}</span>
                    <Badge tone={o.status === 'refunded' ? 'red' : o.status === 'fulfilled' ? 'green' : 'blue'} className="!py-0 !text-[9px]">{o.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><MessageSquare className="h-3 w-3" /> Conversations</div>
                {detail.conversations.map((c: any) => (
                  <div key={c.id} className="border-t border-line/60 py-1 first:border-0">
                    <div className="truncate text-[11.5px] text-ink">{c.subject}</div>
                    <div className="flex items-center gap-1 text-[10px] text-faint">
                      <ChannelIcon type={c.channelType} size="xs" /> {timeAgo(c.lastMessageAt)} · <Badge tone={statusMeta[c.status]?.tone as any} className="!py-0 !text-[8.5px]">{c.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><TicketIcon className="h-3 w-3" /> Tickets</div>
                {detail.tickets.length === 0 && <p className="text-[11px] text-faint">No tickets for this customer.</p>}
                {detail.tickets.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-1.5 border-t border-line/60 py-1 text-[11px] first:border-0">
                    <span className="font-mono text-[10px] text-faint">#{t.number}</span>
                    <span className="truncate text-ink">{t.subject}</span>
                    <Badge tone={statusMeta[t.status]?.tone as any} className="ml-auto !py-0 !text-[9px]">{t.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink"><NotebookPen className="h-3 w-3" /> Activity timeline</div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {detail.activity.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2 border-t border-line/60 py-1 text-[11px] first:border-0">
                    <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', a.type === 'order' ? 'bg-info' : a.type === 'conversation' ? 'bg-teal' : 'bg-warning')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-ink">{a.title}</div>
                      <div className="text-[9.5px] text-faint">{timeAgo(a.created_at)}{a.meta && JSON.parse(a.meta || '{}').body ? ` · ${JSON.parse(a.meta).body}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="!h-8 !text-[12px]" />
                <Button size="sm" onClick={addNote} disabled={!note.trim()}>Add</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ icon, v }: { icon: React.ReactNode; v?: string }) {
  return (
    <div className="flex items-center gap-1.5 border-t border-line/60 py-0.5 first:border-0">
      <span className="text-faint">{icon}</span>
      <span className="truncate text-ink">{v || '—'}</span>
    </div>
  );
}
