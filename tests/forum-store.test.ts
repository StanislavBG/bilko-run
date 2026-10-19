import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbAll, dbRun, initDb } from '../server/db.js';
import {
  addPost, createThread, ensureForumSeed, getForumIndex, getMemberByEmail, getThread,
  listLogbook, setHandle, setHidden, signLogbook, toPublicMember,
} from '../server/services/forum.js';

const HOST = 'host@example.com';

async function member(email: string, handle: string, now = 1000) {
  const r = await setHandle(email, handle, now);
  if (!r.ok) throw new Error(r.msg);
  return (await getMemberByEmail(email))!;
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  for (const t of ['forum_posts', 'forum_logbook', 'forum_threads', 'forum_members']) {
    await dbRun(`DELETE FROM ${t}`);
  }
});

describe('forum seed', () => {
  it('is idempotent and seeds only bilko + 3 threads', async () => {
    await ensureForumSeed(HOST, 5000);
    await ensureForumSeed(HOST, 9000);
    const members = await dbAll<{ handle: string }>('SELECT handle FROM forum_members');
    expect(members.map((m) => m.handle)).toEqual(['bilko']);
    const threads = await dbAll<{ id: string }>('SELECT id FROM forum_threads ORDER BY id');
    expect(threads.map((t) => t.id)).toEqual(['brought', 'log', 'sm']);
    const posts = await dbAll<{ id: string }>('SELECT id FROM forum_posts');
    expect(posts).toHaveLength(2);
    expect((await listLogbook()).length).toBe(0);
    const idx = await getForumIndex({ now: 5000 });
    expect(idx.threads.map((t) => t.id)).toEqual(['sm']);
    expect(idx.threads[0].isStarter).toBe(true);
    expect(idx.threads[0].replies).toBe(0);
    expect(idx.brought.replies).toBe(0);
    expect(idx.newestMember).toBe('bilko');
  });
});

describe('handles', () => {
  it('creates, renames, rejects taken (case-insensitive) and invalid', async () => {
    const a = await setHandle('a@x.com', 'Alice', 1);
    expect(a.ok && a.member.handle).toBe('Alice');
    const same = await setHandle('a@x.com', 'ALICE', 2); // own case change is fine
    expect(same.ok).toBe(true);
    const renamed = await setHandle('a@x.com', 'alice2', 3);
    expect(renamed.ok && renamed.member.handle).toBe('alice2');
    const taken = await setHandle('b@x.com', 'ALICE2', 4);
    expect(taken).toMatchObject({ ok: false, error: 'taken' });
    expect(await setHandle('b@x.com', 'no spaces', 4)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await setHandle('b@x.com', 'admin', 4)).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rename shows on old posts', async () => {
    const m = await member('a@x.com', 'oldname');
    const t = await createThread(m.id, { board: 'show', title: 'Hello there', body: 'first' }, 2000);
    if (!t.ok) throw new Error(t.msg);
    await setHandle('a@x.com', 'newname', 3000);
    const th = await getThread(t.id);
    expect(th!.posts[0].author.handle).toBe('newname');
    expect(th!.starterHandle).toBe('newname');
  });

  it('toPublicMember has no email key', async () => {
    const m = await member('secret@x.com', 'pub_user');
    await signLogbook(m.id, { msg: 'hi', from: '' });
    const pm = await toPublicMember(m);
    expect(Object.keys(pm).sort()).toEqual(['handle', 'joinedAt', 'no', 'posts']);
    expect(JSON.stringify(pm)).not.toContain('secret@x.com');
    expect(pm.posts).toBe(1);
    expect(JSON.stringify(m)).not.toContain('secret@x.com');
  });
});

describe('threads and posts', () => {
  it('orders posts, counts replies, bumps last_post_at', async () => {
    const a = await member('a@x.com', 'alice');
    const b = await member('b@x.com', 'bobby');
    const t = await createThread(a.id, { board: 'tools', title: 'Thread one', body: 'opening' }, 1000);
    const u = await createThread(a.id, { board: 'tools', title: 'Thread two', body: 'other' }, 2000);
    if (!t.ok || !u.ok) throw new Error('create failed');
    expect(await addPost(b.id, t.id, { body: 'reply 1' }, 3000)).toMatchObject({ ok: true });
    await addPost(a.id, t.id, { body: 'reply 2' }, 4000);

    const th = await getThread(t.id);
    expect(th!.posts.map((p) => p.body)).toEqual(['opening', 'reply 1', 'reply 2']);
    expect(th!.earlier).toBe(0);
    const page = await getThread(t.id, { limit: 1 });
    expect(page!.posts.map((p) => p.body)).toEqual(['reply 2']);
    expect(page!.earlier).toBe(2);

    const idx = await getForumIndex({ now: 4000 });
    expect(idx.threads.map((x) => x.id)).toEqual([t.id, u.id]);
    expect(idx.threads[0]).toMatchObject({ replies: 2, lastByHandle: 'alice', lastAt: 4000, isNew: true });
    const old = await getForumIndex({ now: 4000 + 25 * 3600 * 1000 });
    expect(old.threads[0].isNew).toBe(false);
    expect((await getForumIndex({ board: 'show', now: 4000 })).threads).toHaveLength(0);
  });

  it('validates input and rejects logbook / hidden threads', async () => {
    await ensureForumSeed(HOST, 100);
    const a = await member('a@x.com', 'alice');
    expect(await createThread(a.id, { board: 'nope', title: 'Valid title', body: 'x' })).toMatchObject({ ok: false });
    expect(await createThread(a.id, { board: 'show', title: 'ab', body: 'x' })).toMatchObject({ ok: false });
    expect(await addPost(a.id, 'log', { body: 'x' })).toMatchObject({ ok: false, error: 'locked' });
    expect(await addPost(a.id, 'missing', { body: 'x' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await addPost(a.id, 'sm', { body: '   ' })).toMatchObject({ ok: false, error: 'invalid' });
    await setHidden('thread', 'sm', true);
    expect(await addPost(a.id, 'sm', { body: 'x' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await getThread('sm')).toBeNull();
  });

  it('brought threads require a valid came and are tallied', async () => {
    await ensureForumSeed(HOST, 100);
    const a = await member('a@x.com', 'alice');
    expect(await addPost(a.id, 'brought', { body: 'hi' })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await addPost(a.id, 'brought', { body: 'hi', came: 'Carrier pigeon' })).toMatchObject({ ok: false });
    expect(await addPost(a.id, 'brought', { body: 'hi', came: 'GitHub' }, 500)).toMatchObject({ ok: true });
    const idx = await getForumIndex({ now: 500 });
    expect(idx.brought.replies).toBe(1);
    expect(idx.brought.lastAt).toBe(500);
    expect(idx.brought.tally.find((t) => t.label === 'GitHub')!.count).toBe(1);
  });

  it('hidden post is excluded from thread and counts', async () => {
    const a = await member('a@x.com', 'alice');
    const t = await createThread(a.id, { board: 'show', title: 'Hidden test', body: 'opening' }, 1000);
    if (!t.ok) throw new Error('create failed');
    const p = await addPost(a.id, t.id, { body: 'to hide' }, 2000);
    if (!p.ok) throw new Error('post failed');
    expect((await toPublicMember(a)).posts).toBe(2);
    expect(await setHidden('post', p.id, true)).toBe(true);
    expect((await getThread(t.id))!.posts.map((x) => x.body)).toEqual(['opening']);
    expect((await getForumIndex()).threads[0].replies).toBe(0);
    expect((await toPublicMember(a)).posts).toBe(1);
  });
});

describe('log-book', () => {
  it('numbers sequentially, newest first, enforces limits, honours hidden', async () => {
    const a = await member('a@x.com', 'alice');
    const ids: number[] = [];
    for (const [i, msg] of ['one', 'two', 'three', 'four'].entries()) {
      const r = await signLogbook(a.id, { msg, from: i === 0 ? 'Leeds' : '' }, 1000 + i);
      if (!r.ok) throw new Error(r.msg);
      ids.push(r.id);
    }
    const list = await listLogbook();
    expect(list.map((l) => [l.no, l.msg])).toEqual([[4, 'four'], [3, 'three'], [2, 'two'], [1, 'one']]);
    expect(list[3].from).toBe('Leeds');
    expect(list[0].from).toBeNull();
    expect((await listLogbook({ before: ids[2], limit: 1 })).map((l) => l.msg)).toEqual(['two']);

    expect(await signLogbook(a.id, { msg: 'x'.repeat(140) })).toMatchObject({ ok: true });
    expect(await signLogbook(a.id, { msg: 'x'.repeat(141) })).toMatchObject({ ok: false, error: 'invalid' });
    expect(await signLogbook(a.id, { msg: '' })).toMatchObject({ ok: false });
    expect(await signLogbook(a.id, { msg: 'ok', from: 'y'.repeat(33) })).toMatchObject({ ok: false });

    await setHidden('logbook', ids[1], true);
    const idx = await getForumIndex();
    expect(idx.logbook.count).toBe(4);
    expect(idx.logbook.preview).toHaveLength(3);
    expect((await listLogbook()).some((l) => l.msg === 'two')).toBe(false);
  });
});
