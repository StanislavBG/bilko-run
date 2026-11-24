import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbAll, dbRun, initDb } from '../server/db.js';
import {
  isAppName, isDocKey, DOC_MAX_BYTES, USER_QUOTA_BYTES,
  putDoc, getDoc, listDocs, deleteDoc, usedBytes,
} from '../server/services/bilko-db.js';

const APP = 'notes-app';
const APP2 = 'other-app';
const USER = 'a@example.com';
const USER2 = 'b@example.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_docs');
});

describe('schema', () => {
  it('creates bilko_db_docs with its primary key and a user_email index', async () => {
    const cols = await dbAll<{ name: string; pk: number }>(`PRAGMA table_info(bilko_db_docs)`);
    expect(cols.map((c) => c.name).sort()).toEqual(
      ['app', 'body', 'bytes', 'key', 'kind', 'updated_at', 'user_email', 'version'].sort(),
    );
    expect(cols.filter((c) => Number(c.pk) > 0).map((c) => c.name).sort()).toEqual(['app', 'key', 'user_email']);
    const idx = await dbAll<{ name: string }>(`PRAGMA index_list(bilko_db_docs)`);
    const infos = await Promise.all(idx.map((i) => dbAll<{ name: string }>(`PRAGMA index_info("${i.name}")`)));
    expect(infos.some((cols) => cols.length === 1 && cols[0]!.name === 'user_email')).toBe(true);
  });

  it('rejects a kind other than json or text', async () => {
    await expect(dbRun(
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      APP, USER, 'k', 'blob', 'x', 1, 1, 0,
    )).rejects.toThrow();
  });
});

describe('validators and limits', () => {
  it('isAppName', () => {
    for (const ok of ['a', 'my-app', '0x', 'a'.repeat(64)]) expect(isAppName(ok)).toBe(true);
    for (const bad of ['', '-a', 'A', 'a_b', 'a.b', 'a'.repeat(65), 'a/b']) expect(isAppName(bad)).toBe(false);
  });
  it('isDocKey', () => {
    for (const ok of ['a', 'settings.json', 'a_b-c.d', 'a'.repeat(128)]) expect(isDocKey(ok)).toBe(true);
    for (const bad of ['', '.a', '_a', 'A', 'a/b', 'a b', 'a'.repeat(129)]) expect(isDocKey(bad)).toBe(false);
  });
  it('constants', () => {
    expect(DOC_MAX_BYTES).toBe(1_048_576);
    expect(USER_QUOTA_BYTES).toBe(104_857_600);
  });
});

describe('putDoc / getDoc', () => {
  it('creates at version 1 and bumps by one per write', async () => {
    const a = await putDoc({ app: APP, user: USER, key: 'k', kind: 'json', body: '{"a":1}' });
    expect(a).toMatchObject({ key: 'k', kind: 'json', version: 1, bytes: 7 });
    expect('updatedAt' in a && typeof a.updatedAt === 'number').toBe(true);
    const b = await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'hello' });
    expect(b).toMatchObject({ version: 2, kind: 'text', bytes: 5 });
    const got = await getDoc({ app: APP, user: USER, key: 'k' });
    expect(got).toMatchObject({ key: 'k', kind: 'text', body: 'hello', version: 2, bytes: 5 });
  });

  it('getDoc returns null for a missing key', async () => {
    expect(await getDoc({ app: APP, user: USER, key: 'nope' })).toBeNull();
  });

  it('ifVersion must match; a mismatch writes nothing', async () => {
    await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'one' });
    const bad = await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'two', ifVersion: 5 });
    expect(bad).toEqual({ error: 'version_mismatch', version: 1 });
    expect((await getDoc({ app: APP, user: USER, key: 'k' }))!.body).toBe('one');
    const ok = await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'two', ifVersion: 1 });
    expect(ok).toMatchObject({ version: 2 });
  });

  it('ifVersion 0 on a missing key creates; ifVersion 1 on a missing key mismatches', async () => {
    expect(await putDoc({ app: APP, user: USER, key: 'x', kind: 'text', body: 'a', ifVersion: 1 }))
      .toEqual({ error: 'version_mismatch', version: 0 });
    expect(await getDoc({ app: APP, user: USER, key: 'x' })).toBeNull();
    expect(await putDoc({ app: APP, user: USER, key: 'x', kind: 'text', body: 'a', ifVersion: 0 }))
      .toMatchObject({ version: 1 });
  });

  it('createOnly refuses an existing key', async () => {
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'a', createOnly: true }))
      .toMatchObject({ version: 1 });
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'b', createOnly: true }))
      .toEqual({ error: 'version_mismatch', version: 1 });
    expect((await getDoc({ app: APP, user: USER, key: 'k' }))!.body).toBe('a');
  });

  it('two writes with the same ifVersion: one wins, one gets version_mismatch', async () => {
    await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'base' });
    const results = await Promise.all([
      putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'left', ifVersion: 1 }),
      putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'right', ifVersion: 1 }),
    ]);
    const wins = results.filter((r) => !('error' in r));
    const losses = results.filter((r) => 'error' in r);
    expect(wins).toHaveLength(1);
    expect(losses).toEqual([{ error: 'version_mismatch', version: 2 }]);
    const got = await getDoc({ app: APP, user: USER, key: 'k' });
    expect(got!.version).toBe(2);
    expect(['left', 'right']).toContain(got!.body);
  });

  it('counts UTF-8 bytes, not string length', async () => {
    const r = await putDoc({ app: APP, user: USER, key: 'u', kind: 'text', body: 'é😀' });
    expect(r).toMatchObject({ bytes: 6 });
    expect(await usedBytes(USER)).toBe(6);
  });

  it('too_large over DOC_MAX_BYTES UTF-8 bytes writes nothing', async () => {
    const exact = 'a'.repeat(DOC_MAX_BYTES);
    expect(await putDoc({ app: APP, user: USER, key: 'big', kind: 'text', body: exact })).toMatchObject({ bytes: DOC_MAX_BYTES });
    // Fewer chars than the limit, more bytes than it: 'é' is 2 bytes.
    const multi = 'é'.repeat(DOC_MAX_BYTES / 2 + 1);
    expect(multi.length).toBeLessThan(DOC_MAX_BYTES);
    expect(await putDoc({ app: APP, user: USER, key: 'big2', kind: 'text', body: multi })).toEqual({ error: 'too_large' });
    expect(await getDoc({ app: APP, user: USER, key: 'big2' })).toBeNull();
  });

  it('quota_exceeded when usedBytes would pass USER_QUOTA_BYTES; an overwrite counts only the delta', async () => {
    // Stand-in row carrying most of the quota (bytes is the accounted size).
    await dbRun(
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      APP2, USER, 'filler', 'text', '', USER_QUOTA_BYTES - 10, 1, 0,
    );
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'a'.repeat(10) })).toMatchObject({ version: 1 });
    expect(await usedBytes(USER)).toBe(USER_QUOTA_BYTES);
    expect(await putDoc({ app: APP, user: USER, key: 'k2', kind: 'text', body: 'b' })).toEqual({ error: 'quota_exceeded' });
    expect(await getDoc({ app: APP, user: USER, key: 'k2' })).toBeNull();
    // Replacing the 10-byte doc with another 10-byte doc stays inside the quota.
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'c'.repeat(10) })).toMatchObject({ version: 2 });
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'c'.repeat(11) })).toEqual({ error: 'quota_exceeded' });
    expect((await getDoc({ app: APP, user: USER, key: 'k' }))!.body).toBe('c'.repeat(10));
    // Another user's quota is untouched.
    expect(await putDoc({ app: APP, user: USER2, key: 'k2', kind: 'text', body: 'b' })).toMatchObject({ version: 1 });
  });
});

describe('listDocs', () => {
  it('lists sorted keys with metadata only, filtered by prefix', async () => {
    await putDoc({ app: APP, user: USER, key: 'notes.b', kind: 'text', body: 'bb' });
    await putDoc({ app: APP, user: USER, key: 'notes.a', kind: 'json', body: '[]' });
    await putDoc({ app: APP, user: USER, key: 'notes_x', kind: 'text', body: 'x' });
    await putDoc({ app: APP, user: USER, key: 'settings', kind: 'json', body: '{}' });
    const all = await listDocs({ app: APP, user: USER });
    expect(all.map((d) => d.key)).toEqual(['notes.a', 'notes.b', 'notes_x', 'settings']);
    expect(Object.keys(all[0]!).sort()).toEqual(['bytes', 'key', 'kind', 'updatedAt', 'version']);
    expect(all[0]).toMatchObject({ key: 'notes.a', kind: 'json', bytes: 2, version: 1 });
    expect((await listDocs({ app: APP, user: USER, prefix: 'notes.' })).map((d) => d.key)).toEqual(['notes.a', 'notes.b']);
    // '_' and '%' in a prefix are literal, not LIKE wildcards.
    expect((await listDocs({ app: APP, user: USER, prefix: 'notes_' })).map((d) => d.key)).toEqual(['notes_x']);
    expect(await listDocs({ app: APP, user: USER, prefix: '%' })).toEqual([]);
  });
});

describe('deleteDoc', () => {
  it('deletes, honours ifVersion, and frees quota', async () => {
    await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'abc' });
    await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'abcd' });
    expect(await deleteDoc({ app: APP, user: USER, key: 'k', ifVersion: 1 })).toEqual({ error: 'version_mismatch', version: 2 });
    expect(await getDoc({ app: APP, user: USER, key: 'k' })).not.toBeNull();
    expect(await deleteDoc({ app: APP, user: USER, key: 'k', ifVersion: 2 })).toEqual({ deleted: true });
    expect(await getDoc({ app: APP, user: USER, key: 'k' })).toBeNull();
    expect(await usedBytes(USER)).toBe(0);
    expect(await deleteDoc({ app: APP, user: USER, key: 'k' })).toEqual({ deleted: false });
  });
});

describe('isolation between users and apps', () => {
  it('never reads, lists, overwrites or deletes another user or app', async () => {
    await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'mine' });
    await putDoc({ app: APP, user: USER2, key: 'k', kind: 'text', body: 'theirs!' });
    await putDoc({ app: APP2, user: USER, key: 'k', kind: 'text', body: 'other app' });

    expect((await getDoc({ app: APP, user: USER, key: 'k' }))!.body).toBe('mine');
    expect((await getDoc({ app: APP, user: USER2, key: 'k' }))!.body).toBe('theirs!');
    expect((await getDoc({ app: APP2, user: USER, key: 'k' }))!.body).toBe('other app');
    expect(await getDoc({ app: APP2, user: USER2, key: 'k' })).toBeNull();

    // Each row has its own version counter.
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'mine2', ifVersion: 1 })).toMatchObject({ version: 2 });
    expect((await getDoc({ app: APP, user: USER2, key: 'k' }))!.version).toBe(1);
    expect((await getDoc({ app: APP2, user: USER, key: 'k' }))!.version).toBe(1);

    expect((await listDocs({ app: APP, user: USER2 })).map((d) => d.bytes)).toEqual([7]);
    expect(await listDocs({ app: APP2, user: USER2 })).toEqual([]);

    expect(await deleteDoc({ app: APP2, user: USER2, key: 'k' })).toEqual({ deleted: false });
    expect(await deleteDoc({ app: APP, user: USER2, key: 'k' })).toEqual({ deleted: true });
    expect(await getDoc({ app: APP, user: USER, key: 'k' })).not.toBeNull();
    expect(await getDoc({ app: APP2, user: USER, key: 'k' })).not.toBeNull();

    // usedBytes spans the user's apps and only that user.
    expect(await usedBytes(USER)).toBe(5 + 9);
    expect(await usedBytes(USER2)).toBe(0);
  });
});
