import { useEffect, useState } from 'react';
import { Check, Clock, Mail, Plus, Shield, UserPlus, Users, UsersRound, Zap, Copy, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn, roleLabels, timeAgo } from '../lib/utils';
import { useAuth, useToast } from '../lib/store';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Dropdown, EmptyState, Input, MenuItem, MenuLabel, Modal, PageHeader, Progress, Select, Skeleton, Tabs, Toggle } from '../components/ui';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Full control including billing, security and workspace deletion.',
  admin: 'Manage channels, team, automations and settings. Cannot delete the workspace.',
  team_manager: 'Assign work, manage teams and view reports. Cannot change billing.',
  agent: 'Handle conversations and tickets in assigned inboxes.',
  readonly: 'View conversations and reports without making changes.',
};

const PERMISSIONS = [
  ['View conversations', ['super_admin', 'admin', 'team_manager', 'agent', 'readonly']],
  ['Reply & send messages', ['super_admin', 'admin', 'team_manager', 'agent']],
  ['Assign & change status', ['super_admin', 'admin', 'team_manager', 'agent']],
  ['Manage automations', ['super_admin', 'admin', 'team_manager']],
  ['Manage team & roles', ['super_admin', 'admin', 'team_manager']],
  ['Connect integrations', ['super_admin', 'admin']],
  ['API keys & webhooks', ['super_admin', 'admin']],
  ['Billing & plan', ['super_admin', 'admin']],
  ['Security settings', ['super_admin']],
];

export default function TeamManagement() {
  const { user, canAdmin, canWrite, teams: myTeams } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<{ users: any[]; teams: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'agent', title: '', teamIds: [] as string[] });
  const [teamForm, setTeamForm] = useState({ name: '', description: '', color: '#21B8A6', memberIds: [] as string[], leadUserId: '' });
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState<{ email: string; password: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.get<any>('/team').then(setData).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    setBusy(true);
    try {
      const d = await api.post<any>('/team/invite', form);
      setInvited({ email: form.email, password: d.tempPassword });
      setInviteOpen(false); setForm({ name: '', email: '', role: 'agent', title: '', teamIds: [] });
      push({ title: 'Invitation created', description: 'Share the temporary password securely.', tone: 'success' }); load();
    } catch (e) { push({ title: 'Could not invite', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(false); }
  };

  const createTeam = async () => {
    setBusy(true);
    try {
      await api.post('/team/teams', teamForm);
      setTeamOpen(false); setTeamForm({ name: '', description: '', color: '#21B8A6', memberIds: [], leadUserId: '' });
      push({ title: 'Team created', tone: 'success' }); load();
    } catch (e) { push({ title: 'Could not create team', description: (e as Error).message, tone: 'error' }); }
    finally { setBusy(false); }
  };

  const updateRole = async (id: string, role: string) => {
    try { await api.patch(`/team/${id}`, { role }); push({ title: 'Role updated', tone: 'success' }); load(); }
    catch (e) { push({ title: 'Could not update role', description: (e as Error).message, tone: 'error' }); }
  };
  const toggleAvailability = async (u: any) => {
    const next = u.status === 'online' ? 'offline' : 'online';
    await api.patch(`/team/${u.id}`, { status: next }); load();
  };

  const users = data?.users || [];
  const teams = data?.teams || [];

  return (
    <div className="rf-scroll h-full">
      <PageHeader title="Team Management" description="Roles, teams, workload and availability — with role-based access control."
        actions={canAdmin || user?.role === 'team_manager' ? <>
          <Button size="sm" icon={<UsersRound className="h-3.5 w-3.5" />} onClick={() => setTeamOpen(true)}>New team</Button>
          <Button size="sm" variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setInviteOpen(true)}>Invite teammate</Button>
        </> : undefined}>
        <div className="mt-2.5"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'members', label: 'Members', count: users.length },
          { value: 'teams', label: 'Teams', count: teams.length },
          { value: 'roles', label: 'Roles & permissions' },
        ]} /></div>
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-6">
        {tab === 'members' && (
          loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                      <th className="px-4 py-2 font-semibold">Teammate</th><th className="px-3 py-2 font-semibold">Role</th>
                      <th className="px-3 py-2 font-semibold">Teams</th><th className="px-3 py-2 text-right font-semibold">Open</th>
                      <th className="px-3 py-2 text-right font-semibold">Resolved</th><th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Access</th>
                    </tr></thead>
                    <tbody className="divide-y divide-line">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-surface2/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={u.name} color={u.avatar_color} size="sm" status={u.status} />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-ink">{u.name} {u.id === user?.id && <span className="text-[10px] text-faint">(you)</span>}</div>
                                <div className="truncate text-[10.5px] text-faint">{u.email} · {u.title || roleLabels[u.role]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {canAdmin ? (
                              <Dropdown width="w-48" trigger={<button className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink hover:border-line-strong">{roleLabels[u.role]} <Check className="ml-auto h-2.5 w-2.5 opacity-0" /></button>}>
                                {() => Object.entries(roleLabels).map(([k, l]) => (
                                  <MenuItem key={k} active={u.role === k} onClick={() => updateRole(u.id, k)}>{l}</MenuItem>
                                ))}
                              </Dropdown>
                            ) : <Badge tone="slate">{roleLabels[u.role]}</Badge>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {u.teams?.length ? u.teams.map((t: string) => <span key={t} className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">{t}</span>) : <span className="text-[10.5px] text-faint">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-ink">{u.assigned}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted">{u.resolved}</td>
                          <td className="px-3 py-2.5"><Badge tone={u.status === 'online' ? 'green' : u.status === 'away' ? 'amber' : 'slate'} dot>{u.status}</Badge></td>
                          <td className="px-3 py-2.5">
                            {canAdmin ? (
                              <button onClick={() => toggleAvailability(u)} className="text-[10.5px] text-muted hover:text-teal">
                                {u.status === 'online' ? 'Set offline' : 'Set online'}
                              </button>
                            ) : <span className="text-[10.5px] text-faint">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
        )}

        {tab === 'teams' && (
          <div className="grid gap-3 md:grid-cols-2">
            {teams.map((t: any) => (
              <Card key={t.id} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: t.color }}><UsersRound className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[13px] font-semibold text-ink">{t.name}</h3>
                      <Badge tone="slate">{t.openConversations} open</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{t.description}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-faint"><Clock className="h-2.5 w-2.5" />{t.businessHours}</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {t.memberIds.slice(0, 5).map((id: string) => {
                      const m = users.find((u) => u.id === id);
                      return m ? <Avatar key={id} name={m.name} color={m.avatar_color} size="xs" className="ring-2 ring-surface" /> : null;
                    })}
                  </div>
                  <span className="text-[10.5px] text-faint">{t.memberIds.length} members</span>
                  {t.leadUserId && <span className="ml-auto text-[10.5px] text-muted">Lead: {users.find((u) => u.id === t.leadUserId)?.name}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'roles' && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(roleLabels).map(([k, l]) => (
                <Card key={k} className="p-3.5">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-teal" />
                    <h3 className="text-[12.5px] font-semibold text-ink">{l}</h3>
                    <Badge tone="slate" className="ml-auto">{users.filter((u) => u.role === k).length}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{ROLE_DESCRIPTIONS[k]}</p>
                </Card>
              ))}
            </div>
            <Card className="overflow-hidden">
              <CardHeader title="Permission matrix" subtitle="Role-based access control enforced server-side on every request" icon={<Shield className="h-4 w-4" />} />
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="border-b border-line bg-surface2/40 text-left text-[10.5px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-2 font-semibold">Capability</th>
                    {Object.values(roleLabels).map((l) => <th key={l} className="px-2 py-2 text-center font-semibold">{l}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {PERMISSIONS.map(([label, roles]: any) => (
                      <tr key={label}>
                        <td className="px-4 py-2 text-ink">{label}</td>
                        {Object.keys(roleLabels).map((r) => (
                          <td key={r} className="px-2 py-2 text-center">
                            {roles.includes(r) ? <Check className="mx-auto h-3.5 w-3.5 text-success" /> : <X className="mx-auto h-3.5 w-3.5 text-faint/50" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Alert tone="info" title="Enforced on the server">
              Every API route re-checks the caller's role and organisation. Read-only users cannot send messages, change status or modify settings — the UI hides those controls and the API rejects the request.
            </Alert>
          </div>
        )}
      </div>

      {/* invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite teammate" icon={<UserPlus className="h-4 w-4" />} size="md"
        description="They receive a temporary password and a welcome notification inside ReplyFlow."
        footer={<><Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={invite} disabled={!form.name || !form.email}>Send invitation</Button></>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Full name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Work email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Job title</label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Support Agent" /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Role</label>
            <Select value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={Object.entries(roleLabels).map(([v, l]) => ({ value: v, label: l }))} />
            <p className="mt-1 text-[10.5px] text-faint">{ROLE_DESCRIPTIONS[form.role]}</p></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Teams</label>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t: any) => (
                <button key={t.id} onClick={() => setForm({ ...form, teamIds: form.teamIds.includes(t.id) ? form.teamIds.filter((x) => x !== t.id) : [...form.teamIds, t.id] })}
                  className={cn('rounded-lg border px-2 py-1 text-[11px] transition', form.teamIds.includes(t.id) ? 'border-teal bg-teal/10 text-teal' : 'border-line text-muted hover:text-ink')}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!invited} onClose={() => setInvited(null)} title="Invitation ready" icon={<Mail className="h-4 w-4" />} size="sm"
        footer={<Button variant="primary" onClick={() => setInvited(null)}>Done</Button>}>
        <p className="text-[12.5px] text-muted">Share these credentials with <b className="text-ink">{invited?.email}</b> over a secure channel. The password is shown only once.</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface2/50 px-3 py-2">
          <code className="flex-1 font-mono text-[12.5px] text-ink">{invited?.password}</code>
          <button onClick={() => { navigator.clipboard?.writeText(invited!.password); push({ title: 'Password copied', tone: 'success' }); }} className="rounded p-1 text-muted hover:text-teal"><Copy className="h-3.5 w-3.5" /></button>
        </div>
      </Modal>

      {/* team modal */}
      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Create team" icon={<UsersRound className="h-4 w-4" />} size="md"
        footer={<><Button variant="ghost" onClick={() => setTeamOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={createTeam} disabled={!teamForm.name}>Create team</Button></>}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Team name</label><Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="e.g. Marketplace Desk" /></div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Description</label><Input value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Colour</label>
              <div className="flex gap-1.5">{['#21B8A6', '#4C7DF0', '#F0A43C', '#E45B65', '#B07CE8', '#16A673'].map((c) => (
                <button key={c} onClick={() => setTeamForm({ ...teamForm, color: c })} className={cn('h-7 w-7 rounded-lg ring-2 ring-offset-1', teamForm.color === c ? 'ring-ink' : 'ring-transparent')} style={{ background: c }} />
              ))}</div></div>
            <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Team lead</label>
              <Select value={teamForm.leadUserId} onChange={(v) => setTeamForm({ ...teamForm, leadUserId: v })} placeholder="None" options={users.map((u) => ({ value: u.id, label: u.name }))} /></div>
          </div>
          <div><label className="mb-1 block text-[11.5px] font-medium text-muted">Members</label>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => (
                <button key={u.id} onClick={() => setTeamForm({ ...teamForm, memberIds: teamForm.memberIds.includes(u.id) ? teamForm.memberIds.filter((x) => x !== u.id) : [...teamForm.memberIds, u.id] })}
                  className={cn('flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] transition', teamForm.memberIds.includes(u.id) ? 'border-teal bg-teal/10 text-teal' : 'border-line text-muted hover:text-ink')}>
                  <Avatar name={u.name} color={u.avatar_color} size="xs" className="!h-4 !w-4 !text-[8px]" />{u.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
