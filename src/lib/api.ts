export class ApiError extends Error {
  status: number;
  code?: string;
  payload: Record<string, unknown>;
  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.code = payload.code as string | undefined;
  }
}

/**
 * Session token fallback.
 *
 * httpOnly cookies are the primary mechanism, but they are silently rejected in
 * some embedding contexts (sandboxed iframes / opaque origins), where a login can
 * otherwise look successful and still leave the app signed out. When the server
 * hands back a token we keep it here and send it as a Bearer header, so the
 * session works everywhere. Cookies stay the source of truth when available.
 */
const TOKEN_KEY = 'rf_token';

export const session = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable — cookie-only mode */ }
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.get();
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Distinguish "the server isn't running" from "the request was rejected".
    throw new ApiError(0, 'Cannot reach the ReplyFlow server. It may still be starting up — retrying in a moment.', { offline: true });
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data || {});
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  download: (path: string) => {
    const token = session.get();
    // window.open cannot carry headers, so pass the token in the query string.
    const sep = path.includes('?') ? '&' : '?';
    window.open(`/api${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`, '_blank');
  },
};

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};
