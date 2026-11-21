import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, session } from './api';
import type { Org, User } from './types';

/* ---------------- Theme ---------------- */
type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('rf-theme') as Theme) || 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('rf-theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/* ---------------- Toasts ---------------- */
export interface Toast { id: string; title: string; description?: string; tone: 'success' | 'error' | 'info' | 'warning' }
const ToastContext = createContext<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: string) => void }>({ toasts: [], push: () => {}, dismiss: () => {} });
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((cur) => [...cur.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), t.tone === 'error' ? 7000 : 4200);
  }, [dismiss]);
  return <ToastContext.Provider value={{ toasts, push, dismiss }}>{children}</ToastContext.Provider>;
}

/* ---------------- Auth ---------------- */
interface AuthState {
  user: User | null; org: Org | null; teams: { id: string; name: string; color: string }[];
  loading: boolean; error: string | null; aiProvider: string;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  canWrite: boolean; canAdmin: boolean;
}
const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string; color: string }[]>([]);
  const [aiProvider, setAiProvider] = useState('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; org: Org; teams: any[]; aiProvider: string }>('/auth/me');
      setUser(data.user); setOrg(data.org); setTeams(data.teams || []); setAiProvider(data.aiProvider);
      setError(null);
    } catch (e) {
      setUser(null); setOrg(null);
      if (e instanceof ApiError && e.status === 401) {
        session.set(null);          // stale or missing session — start clean
        setError(null);
      } else {
        setError((e as Error).message);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: User; token?: string }>('/auth/login', { email, password });
    if (data.token) session.set(data.token);
    setUser(data.user);
    await refresh();
  }, [refresh]);

  const demoLogin = useCallback(async () => {
    const data = await api.post<{ user?: User; token?: string }>('/auth/demo');
    if (data?.token) session.set(data.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* already gone */ }
    session.set(null);
    setUser(null); setOrg(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, org, teams, loading, error, aiProvider, login, demoLogin, logout, refresh,
    canWrite: !!user && user.role !== 'readonly',
    canAdmin: !!user && ['super_admin', 'admin'].includes(user.role),
  }), [user, org, teams, loading, error, aiProvider, login, demoLogin, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------------- Realtime ---------------- */
export type RealtimeEvent =
  | { type: 'message.created'; conversationId: string; message: any; conversation: any }
  | { type: 'conversation.updated'; conversation: any }
  | { type: 'conversation.created'; id: string }
  | { type: 'conversation.read'; conversationId: string }
  | { type: 'typing'; conversationId: string; who: string; name?: string }
  | { type: 'conversations.bulk'; ids: string[]; action: string }
  | { type: 'ticket.created' | 'ticket.updated'; id: string };

const RealtimeContext = createContext<{ connected: boolean; subscribe: (fn: (e: RealtimeEvent) => void) => () => void; send: (msg: unknown) => void }>({
  connected: false, subscribe: () => () => {}, send: () => {},
});
export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ orgId, children }: { orgId?: string; children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(e: RealtimeEvent) => void>());
  const wsRef = useRef<WebSocket | null>(null);
  const retry = useRef(0);

  useEffect(() => {
    if (!orgId) return;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?org=${encodeURIComponent(orgId)}`);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); retry.current = 0; };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry.current = Math.min(retry.current + 1, 6);
        setTimeout(connect, 600 * retry.current);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'pong') return;
          listeners.current.forEach((fn) => fn(data));
        } catch { /* ignore */ }
      };
    };
    connect();
    return () => { closed = true; wsRef.current?.close(); };
  }, [orgId]);

  const subscribe = useCallback((fn: (e: RealtimeEvent) => void) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);
  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(msg));
  }, []);

  return <RealtimeContext.Provider value={{ connected, subscribe, send }}>{children}</RealtimeContext.Provider>;
}

/* ---------------- Global search / command palette ---------------- */
const CommandContext = createContext<{ open: boolean; setOpen: (v: boolean) => void; createOpen: boolean; setCreateOpen: (v: boolean) => void }>({ open: false, setOpen: () => {}, createOpen: false, setCreateOpen: () => {} });
export const useCommand = () => useContext(CommandContext);
export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setCreateOpen((v) => !v); }
      if (e.key === 'Escape') { setOpen(false); setCreateOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <CommandContext.Provider value={{ open, setOpen, createOpen, setCreateOpen }}>{children}</CommandContext.Provider>;
}
