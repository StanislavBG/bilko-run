/**
 * Single source of truth for the bilko.run Forum: boards, "came via" tags,
 * handle rules and avatar colour. Used by the Fastify server and the React
 * client. Pure data and pure functions — no fs, env, DOM or server/src imports.
 */

export const FORUM_BOARDS = [
  { id: 'porch', name: 'The porch' },
  { id: 'tools', name: 'Tools talk' },
  { id: 'bugs', name: 'Bugs & wishes' },
  { id: 'show', name: 'Show & tell' },
  { id: 'back', name: 'The back room' },
] as const;

export type ForumBoardId = (typeof FORUM_BOARDS)[number]['id'];

export function isForumBoardId(x: unknown): x is ForumBoardId {
  return typeof x === 'string' && FORUM_BOARDS.some((b) => b.id === x);
}

export const FORUM_CAME_VIA = [
  'Hacker News',
  'A friend',
  'GitHub',
  'Twitter / X',
  'Search',
  'Lost & wandering',
] as const;

export const FORUM_LIMITS = {
  handleMin: 3,
  handleMax: 20,
  titleMin: 4,
  titleMax: 90,
  bodyMax: 5000,
  logMsgMax: 140,
  logFromMax: 32,
} as const;

/** Lowercase handles nobody may claim. */
export const FORUM_RESERVED_HANDLES: readonly string[] = [
  'admin',
  'mod',
  'moderator',
  'root',
  'support',
  'forum',
  'bilko_run',
  'bilko',
  'staff',
  'system',
  'anonymous',
  'you',
];

export function normalizeHandle(h: string): string {
  return h.trim().toLowerCase();
}

export interface HandleCheck {
  ok: boolean;
  msg: string;
  tone: 'n' | 'bad' | 'good';
  reason?: 'empty' | 'chars' | 'short' | 'long' | 'reserved' | 'same';
}

const HANDLE_RE = /^[A-Za-z0-9_-]+$/;

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Format check only; availability against the DB is the server's job. */
export function validateHandle(raw: string, currentHandle?: string | null): HandleCheck {
  const h = raw.trim();
  if (!h) {
    return { ok: false, msg: '3–20 characters · letters, numbers, _ and -', tone: 'n', reason: 'empty' };
  }
  if (!HANDLE_RE.test(h)) {
    return { ok: false, msg: 'Only letters, numbers, _ and - . No spaces.', tone: 'bad', reason: 'chars' };
  }
  if (h.length < FORUM_LIMITS.handleMin) {
    return { ok: false, msg: 'At least 3 characters.', tone: 'bad', reason: 'short' };
  }
  if (h.length > FORUM_LIMITS.handleMax) {
    return { ok: false, msg: 'Keep it to 20 characters.', tone: 'bad', reason: 'long' };
  }
  const lower = h.toLowerCase();
  if (currentHandle && lower === currentHandle.toLowerCase()) {
    return { ok: true, msg: "That's your current handle.", tone: 'n', reason: 'same' };
  }
  if (FORUM_RESERVED_HANDLES.includes(lower)) {
    return {
      ok: false,
      msg: `@${h} is taken. Try @${h}_${(hashStr(h) % 90) + 10}?`,
      tone: 'bad',
      reason: 'reserved',
    };
  }
  return { ok: true, msg: `✓ @${h} is free.`, tone: 'good' };
}

const AVATAR_COLORS = [
  'oklch(0.66 0.18 45)',
  'oklch(0.28 0.012 80)',
  'oklch(0.55 0.13 240)',
  'oklch(0.55 0.12 145)',
  'oklch(0.52 0.16 30)',
] as const;

export function forumAvatarColor(handle: string): string {
  return AVATAR_COLORS[hashStr(handle.toLowerCase()) % AVATAR_COLORS.length];
}
