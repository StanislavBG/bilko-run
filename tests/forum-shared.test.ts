import { describe, it, expect } from 'vitest';
import {
  FORUM_BOARDS,
  FORUM_CAME_VIA,
  FORUM_LIMITS,
  FORUM_RESERVED_HANDLES,
  forumAvatarColor,
  isForumBoardId,
  normalizeHandle,
  validateHandle,
} from '../shared/forum.js';

describe('validateHandle', () => {
  it('empty', () => {
    expect(validateHandle('   ')).toEqual({
      ok: false,
      msg: '3–20 characters · letters, numbers, _ and -',
      tone: 'n',
      reason: 'empty',
    });
  });
  it('bad chars', () => {
    const r = validateHandle('no spaces');
    expect(r).toMatchObject({ ok: false, tone: 'bad', reason: 'chars', msg: 'Only letters, numbers, _ and - . No spaces.' });
  });
  it('too short / too long', () => {
    expect(validateHandle('ab')).toMatchObject({ ok: false, reason: 'short', msg: 'At least 3 characters.' });
    expect(validateHandle('a'.repeat(21))).toMatchObject({ ok: false, reason: 'long', msg: 'Keep it to 20 characters.' });
    expect(validateHandle('a'.repeat(20)).ok).toBe(true);
  });
  it('same as current handle, case-insensitive', () => {
    expect(validateHandle('NightOwl', 'nightowl')).toMatchObject({
      ok: true,
      tone: 'n',
      reason: 'same',
      msg: "That's your current handle.",
    });
  });
  it('reserved, case-insensitive', () => {
    for (const h of ['admin', 'ADMIN', 'Moderator', 'Bilko_Run', 'you']) {
      expect(validateHandle(h)).toMatchObject({ ok: false, tone: 'bad', reason: 'reserved' });
    }
  });
  it('free', () => {
    expect(validateHandle('  nightowl ')).toEqual({ ok: true, msg: '✓ @nightowl is free.', tone: 'good' });
  });
});

describe('constants', () => {
  it('reserved handles and normalize', () => {
    for (const h of ['admin', 'mod', 'moderator', 'root', 'support', 'forum', 'bilko_run', 'bilko', 'staff', 'system', 'anonymous', 'you']) {
      expect(FORUM_RESERVED_HANDLES).toContain(h);
    }
    expect(normalizeHandle('  FooBar ')).toBe('foobar');
  });
  it('limits and tags', () => {
    expect(FORUM_LIMITS).toEqual({ handleMin: 3, handleMax: 20, titleMin: 4, titleMax: 90, bodyMax: 5000, logMsgMax: 140, logFromMax: 32 });
    expect(FORUM_CAME_VIA).toHaveLength(6);
  });
});

describe('isForumBoardId', () => {
  it('accepts every board, rejects others', () => {
    for (const b of FORUM_BOARDS) expect(isForumBoardId(b.id)).toBe(true);
    expect(isForumBoardId('nope')).toBe(false);
    expect(isForumBoardId(undefined)).toBe(false);
    expect(isForumBoardId(5)).toBe(false);
  });
});

describe('forumAvatarColor', () => {
  const palette = ['oklch(0.66 0.18 45)', 'oklch(0.28 0.012 80)', 'oklch(0.55 0.13 240)', 'oklch(0.55 0.12 145)', 'oklch(0.52 0.16 30)'];
  it('is deterministic, case-insensitive and in the palette', () => {
    for (const h of ['bilko', 'moth', 'r0b', 'lena_k', 'x']) {
      expect(palette).toContain(forumAvatarColor(h));
      expect(forumAvatarColor(h)).toBe(forumAvatarColor(h.toUpperCase()));
    }
  });
  it('matches the design hash', () => {
    // 'a' = 97, 97 % 5 = 2
    expect(forumAvatarColor('a')).toBe(palette[2]);
  });
});
