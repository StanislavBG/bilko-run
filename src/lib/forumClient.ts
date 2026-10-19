/**
 * Typed browser client for the site Forum (`/api/forum/*`, see
 * server/routes/forum.ts) plus the display formatters the forum pages share.
 *
 * Authed calls take a Clerk `getToken` rather than reading auth state, so the
 * module has no React or Clerk import. Calls never throw: a failure resolves
 * to `{ ok: false, status, code?, error }` with the HTTP status preserved
 * (401, 403 `needs_handle`, 409, 429, 400 ...). Timestamps are epoch-ms.
 */

import { API } from '../data/api.js';

export {
  FORUM_BOARDS,
  FORUM_CAME_VIA,
  FORUM_LIMITS,
  forumAvatarColor,
  validateHandle,
} from '../../shared/forum.js';
export type { ForumBoardId, HandleCheck } from '../../shared/forum.js';

export type TokenGetter = () => Promise<string | null>;

export interface ForumMember {
  no: number;
  handle: string;
  joinedAt: number;
  posts: number;
}

export interface ForumLogEntry {
  no: number;
  id: number;
  handle: string;
  msg: string;
  from: string | null;
  at: number;
}

export interface ForumThreadSummary {
  id: string;
  title: string;
  board: string;
  starterHandle: string;
  isStarter: boolean;
  replies: number;
  views: number;
  lastByHandle: string;
  lastAt: number;
  isNew: boolean;
}

export interface ForumIndex {
  logbook: { count: number; preview: ForumLogEntry[]; lastAt: number | null };
  brought: { replies: number; tally: { label: string; count: number }[]; lastAt: number | null };
  threads: ForumThreadSummary[];
  newestMember: string | null;
  online: { handles: string[]; lurkers: number };
}

export interface ForumPost {
  id: string;
  body: string;
  came: string | null;
  at: number;
  author: ForumMember;
}

export interface ForumThread {
  id: string;
  kind: string;
  board: string;
  title: string;
  lede: string | null;
  pinned: boolean;
  isStarter: boolean;
  views: number;
  createdAt: number;
  lastAt: number;
  starterHandle: string;
  posts: ForumPost[];
  earlier: number;
}

export interface ForumMe {
  signedIn: boolean;
  member: ForumMember | null;
  /** Present only when signed in. */
  isHost?: boolean;
}

export interface ForumHandleCheck {
  ok: boolean;
  msg: string;
  tone: 'n' | 'bad' | 'good';
}

export interface ForumError {
  ok: false;
  status: number;
  code?: string;
  error: string;
}

export type ForumResult<T> = ({ ok: true } & T) | ForumError;

export type ModerateKind = 'thread' | 'post' | 'logbook';

interface ClientOptions {
  fetchImpl?: typeof fetch;
}

async function authHeaders(getToken: TokenGetter): Promise<Record<string, string>> {
  const token = await Promise.resolve().then(getToken).catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; getToken?: TokenGetter },
  opts: ClientOptions,
): Promise<ForumResult<T>> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const headers: Record<string, string> = init.getToken ? await authHeaders(init.getToken) : {};
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await f(`${API}/forum${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: typeof data?.code === 'string' ? data.code : undefined,
        error: typeof data?.error === 'string' ? data.error : data?.msg ?? `Request failed (${res.status}).`,
      };
    }
    return { ...(data ?? {}), ok: true } as { ok: true } & T;
  } catch {
    return { ok: false, status: 0, error: 'Network error — check your connection and try again.' };
  }
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

// ── Reads ───────────────────────────────────────────────────────────────────

export const fetchForumIndex = (board?: string, opts: ClientOptions = {}) =>
  request<ForumIndex>(`/index${qs({ board })}`, {}, opts);

export const fetchThread = (id: string, before?: number, opts: ClientOptions = {}) =>
  request<ForumThread>(`/threads/${encodeURIComponent(id)}${qs({ before })}`, {}, opts);

export const fetchLogbook = (before?: number, opts: ClientOptions = {}) =>
  request<{ entries: ForumLogEntry[] }>(`/logbook${qs({ before })}`, {}, opts);

export const fetchMe = (getToken: TokenGetter, opts: ClientOptions = {}) =>
  request<ForumMe>('/me', { getToken }, opts);

/** Anonymous-safe; the token is not sent, so "same as current" is not detected. */
export const checkHandle = (handle: string, opts: ClientOptions = {}) =>
  request<ForumHandleCheck>(`/handle-check${qs({ handle })}`, {}, opts);

// ── Writes ──────────────────────────────────────────────────────────────────

export const saveHandle = (getToken: TokenGetter, handle: string, opts: ClientOptions = {}) =>
  request<{ member: ForumMember }>('/handle', { method: 'POST', getToken, body: { handle } }, opts);

export const signLogbook = (
  getToken: TokenGetter,
  entry: { msg: string; from: string },
  opts: ClientOptions = {},
) => request<{ id: number }>('/logbook', { method: 'POST', getToken, body: entry }, opts);

export const createThread = (
  getToken: TokenGetter,
  input: { board: string; title: string; body: string },
  opts: ClientOptions = {},
) => request<{ id: string }>('/threads', { method: 'POST', getToken, body: input }, opts);

export const addPost = (
  getToken: TokenGetter,
  threadId: string,
  input: { body: string; came?: string | null },
  opts: ClientOptions = {},
) =>
  request<{ id: string }>(
    `/threads/${encodeURIComponent(threadId)}/posts`,
    { method: 'POST', getToken, body: input },
    opts,
  );

export const moderate = (
  getToken: TokenGetter,
  input: { kind: ModerateKind; id: string | number; hidden: boolean },
  opts: ClientOptions = {},
) => request<Record<string, never>>('/moderate', { method: 'POST', getToken, body: input }, opts);

// ── Formatters ──────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 60 * MIN;

const monthDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** 'just now' · '5 min ago' · '3 h ago' · 'Yesterday' · 'Oct 19'. */
export function formatForumWhen(ms: number, now: number = Date.now()): string {
  const diff = Math.max(now - ms, 0);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < 24 * HOUR) return `${Math.floor(diff / HOUR)} h ago`;
  if (diff < 48 * HOUR) return 'Yesterday';
  return monthDay(new Date(ms));
}

/** 'Oct 19 · 09:12' (24-hour clock). */
export function formatLogWhen(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${monthDay(d)} · ${hh}:${mm}`;
}

/** 'No. 0001'. */
export function formatEntryNo(n: number): string {
  return `No. ${String(n).padStart(4, '0')}`;
}
