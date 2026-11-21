import { useState } from 'react';
import { ArrowRight, Check, Loader2, Lock, Mail, Sparkles, Zap, Inbox, MessageSquare, Bot, Plug, BarChart3, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/store';
import { ApiError } from '../lib/api';
import { Input, Button } from '../components/ui';
import { cn } from '../lib/utils';

const DEMO_ACCOUNTS = [
  { email: 'amina@northwind.io', name: 'Amina Rauf', role: 'Admin' },
  { email: 'daniel@northwind.io', name: 'Daniel Okafor', role: 'Agent' },
  { email: 'sam@northwind.io', name: 'Sam Whitfield', role: 'Read-only' },
];

export default function Login({ notice, onRetry }: { notice?: string | null; onRetry?: () => void }) {
  const { login, demoLogin } = useAuth();
  const [email, setEmail] = useState('amina@northwind.io');
  const [password, setPassword] = useState('replyflow');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const describe = (err: unknown) => {
    const e = err as ApiError;
    if (e?.status === 0) return 'Cannot reach the ReplyFlow server. It may still be starting up — wait a few seconds and try again.';
    if (e?.status === 401) return 'Incorrect email or password.';
    return e?.message || 'Something went wrong. Please try again.';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('login'); setError(null);
    try { await login(email, password); }
    catch (err) { setError(describe(err)); }
    finally { setBusy(null); }
  };

  const demo = async () => {
    setBusy('demo'); setError(null);
    try { await demoLogin(); }
    catch (err) { setError(describe(err)); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* left: brand panel */}
      <div className="relative hidden flex-1 overflow-hidden rf-gradient-navy p-10 lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(33,184,166,0.35), transparent 45%), radial-gradient(circle at 85% 70%, rgba(76,125,240,0.28), transparent 50%)' }} />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-teal text-navy">
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none"><path d="M8 24V8h9.2c3.6 0 6 2.1 6 5.4 0 2.5-1.4 4.3-3.6 5l4 5.6h-4.4l-3.6-5.2H12V24H8zm4-8.6h4.8c1.8 0 2.9-1 2.9-2.6s-1.1-2.6-2.9-2.6H12v5.2z" fill="currentColor" /></svg>
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-white">ReplyFlow</span>
            <span className="block text-[10px] text-white/50">Every conversation. One workspace.</span>
          </span>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-white">
            Every customer conversation, finally in one calm place.
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">
            Email, live chat, WhatsApp, Instagram and marketplace messages — unified into a single inbox with AI that drafts, summarises and triages while your team stays in control.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {[
              [Inbox, 'Unified omnichannel inbox'],
              [Bot, 'AI drafts with human approval'],
              [Plug, '15+ channel integrations'],
              [BarChart3, 'SLA & CSAT reporting'],
              [MessageSquare, 'Live chat widget included'],
              [ShieldCheck, 'Multi-tenant isolation'],
            ].map(([Icon, label]: any) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                <Icon className="h-3.5 w-3.5 text-teal" />
                <span className="text-[11px] font-medium text-white/80">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 text-[11px] text-white/40">
            <Zap className="h-3 w-3" /> Works with your real channels — demo data is always clearly labelled.
          </div>
        </div>
      </div>

      {/* right: form */}
      <div className="flex flex-1 items-center justify-center bg-bg px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-5 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy text-teal">
              <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none"><path d="M8 24V8h9.2c3.6 0 6 2.1 6 5.4 0 2.5-1.4 4.3-3.6 5l4 5.6h-4.4l-3.6-5.2H12V24H8zm4-8.6h4.8c1.8 0 2.9-1 2.9-2.6s-1.1-2.6-2.9-2.6H12v5.2z" fill="currentColor" /></svg>
            </span>
            <span className="text-[16px] font-semibold text-ink">ReplyFlow</span>
          </div>

          {notice && (
            <div className="mb-4 rounded-lg border border-warning/35 bg-warning/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
              <div className="font-semibold text-warning">Connection problem</div>
              <div className="mt-0.5 text-muted">{notice}</div>
              {onRetry && (
                <button onClick={() => onRetry()} className="mt-1.5 text-[11px] font-semibold text-teal hover:underline">
                  Retry connection
                </button>
              )}
            </div>
          )}
          <h2 className="text-[21px] font-semibold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1 text-[12.5px] text-muted">Sign in to your Northwind Support workspace.</p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-muted">Work email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="!h-10 pl-9" required autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-muted">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="!h-10 pl-9" required autoComplete="current-password" />
              </div>
            </div>
            {error && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{error}</div>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'login'} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
              Sign in
            </Button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-line" /><span className="text-[10.5px] font-medium uppercase tracking-wide text-faint">or</span><span className="h-px flex-1 bg-line" />
          </div>

          <Button size="lg" className="w-full" loading={busy === 'demo'} onClick={demo} icon={<Sparkles className="h-3.5 w-3.5" />}>
            Explore the demo workspace
          </Button>

          <div className="mt-4 rounded-xl border border-line bg-surface p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Demo accounts — password: replyflow</div>
            <div className="mt-1.5 space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} onClick={() => { setEmail(a.email); setPassword('replyflow'); }}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px] transition hover:bg-surface2', email === a.email && 'bg-surface2')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', email === a.email ? 'bg-teal' : 'bg-line-strong')} />
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className="text-faint">{a.email}</span>
                  <span className="ml-auto rounded bg-surface2 px-1.5 py-0.5 text-[9.5px] text-muted">{a.role}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-faint">
              Roles are enforced server-side — try the read-only account to see permissions in action.
            </p>
          </div>

          <p className="mt-4 text-center text-[10.5px] leading-relaxed text-faint">
            Sessions use httpOnly cookies. Passwords are hashed with bcrypt.<br />All demo data is generated and clearly labelled.
          </p>
        </div>
      </div>
    </div>
  );
}
