import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RealtimeProvider, ThemeProvider, ToastProvider, CommandProvider, useAuth, useTheme } from './lib/store';
import { Shell } from './components/Layout';
import { CommandPalette } from './components/CommandPalette';
import { Toasts } from './components/Toasts';
import Login from './pages/Login';
import { Skeleton } from './components/ui';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Conversations = lazy(() => import('./pages/Conversations'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Customers = lazy(() => import('./pages/Customers'));
const Companies = lazy(() => import('./pages/Companies'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Automations = lazy(() => import('./pages/Automations'));
const Reports = lazy(() => import('./pages/Reports'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Integrations = lazy(() => import('./pages/Integrations'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const LiveChatWidget = lazy(() => import('./pages/LiveChatWidget'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));

function PageFallback() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function AuthGate() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-navy text-teal">
            <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none"><path d="M8 24V8h9.2c3.6 0 6 2.1 6 5.4 0 2.5-1.4 4.3-3.6 5l4 5.6h-4.4l-3.6-5.2H12V24H8zm4-8.6h4.8c1.8 0 2.9-1 2.9-2.6s-1.1-2.6-2.9-2.6H12v5.2z" fill="currentColor" /></svg>
          </span>
          <p className="text-[12.5px] text-muted">Loading your workspace…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Login notice={error} onRetry={refresh} />;
  return <AppShell />;
}

function AppShell() {
  const { org } = useAuth();
  return (
    <RealtimeProvider orgId={org?.id}>
      <Shell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/team" element={<TeamManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/widget" element={<LiveChatWidget />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Shell>
      <CommandPalette />
    </RealtimeProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CommandProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/help" element={<HelpCenter />} />
                <Route path="*" element={<AuthGate />} />
              </Routes>
            </BrowserRouter>
            <Toasts />
          </CommandProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
