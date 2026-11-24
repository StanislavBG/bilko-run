import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbAll, dbRun, initDb } from '../server/db.js';
import {
  teamPrincipal, TEAM_MAX_MEMBERS, normalizeMemberEmail,
  getTeamRole, listTeam, setTeamMember, removeTeamMember,
} from '../server/services/bilko-db-team.js';

const APP = 'threewinds';
const APP2 = 'other-app';
const OWNER = 'owner@example.com';
const BY = 'admin@example.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_team_members');
});

describe('schema', () => {
  it('creates bilko_db_team_members keyed by (app, email) and rejects an unknown role', async () => {
    const cols = await dbAll<{ name: string; pk: number }>(`PRAGMA table_info(bilko_db_team_members)`);
    expect(cols.map((c) => c.name).sort()).toEqual(['added_at', 'added_by', 'app', 'email', 'role']);
    expect(cols.filter((c) => Number(c.pk) > 0).map((c) => c.name).sort()).toEqual(['app', 'email']);
    await expect(dbRun(
      `INSERT INTO bilko_db_team_members (app, email, role, added_by, added_at) VALUES (?, ?, ?, ?, ?)`,
      APP, 'x@example.com', 'admin', BY, 0,
    )).rejects.toThrow();
  });
});

describe('helpers', () => {
  it('teamPrincipal never looks like an email', () => {
    expect(teamPrincipal('threewinds')).toBe('team:threewinds');
    expect(teamPrincipal('threewinds')).not.toContain('@');
  });
  it('TEAM_MAX_MEMBERS', () => {
    expect(TEAM_MAX_MEMBERS).toBe(100);
  });
  it('normalizeMemberEmail', () => {
    expect(normalizeMemberEmail('  Alice@Example.COM ')).toBe('alice@example.com');
    for (const bad of ['', 'no-at', 'a@b', 'a b@c.d', `${'a'.repeat(250)}@b.co`, 42, null, undefined]) {
      expect(normalizeMemberEmail(bad as unknown as string)).toBeNull();
    }
  });
});

describe('setTeamMember / listTeam / getTeamRole', () => {
  it('adds members and lists them sorted by email', async () => {
    const a = await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    expect(a).toEqual({ email: OWNER, role: 'owner', created: true });
    await setTeamMember({ app: APP, email: 'carol@example.com', role: 'member', by: OWNER });
    await setTeamMember({ app: APP, email: 'bob@example.com', role: 'member', by: OWNER });
    const list = await listTeam(APP);
    expect(list.map((m) => [m.email, m.role])).toEqual([
      ['bob@example.com', 'member'],
      ['carol@example.com', 'member'],
      [OWNER, 'owner'],
    ]);
    expect(typeof list[0]!.addedAt).toBe('number');
    expect(await getTeamRole({ app: APP, email: OWNER })).toBe('owner');
    expect(await getTeamRole({ app: APP, email: 'bob@example.com' })).toBe('member');
    expect(await getTeamRole({ app: APP, email: 'nobody@example.com' })).toBeNull();
    expect(await getTeamRole({ app: APP, email: 'not an email' })).toBeNull();
  });

  it('changes a role in place and keeps the first added_by', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    await setTeamMember({ app: APP, email: 'bob@example.com', role: 'member', by: OWNER });
    const r = await setTeamMember({ app: APP, email: 'bob@example.com', role: 'owner', by: 'someone@example.com' });
    expect(r).toEqual({ email: 'bob@example.com', role: 'owner', created: false });
    expect(await getTeamRole({ app: APP, email: 'bob@example.com' })).toBe('owner');
    const rows = await dbAll<{ added_by: string }>(
      `SELECT added_by FROM bilko_db_team_members WHERE app = ? AND email = ?`, APP, 'bob@example.com',
    );
    expect(rows[0]!.added_by).toBe(OWNER);
  });

  it('maps mixed-case and padded emails to one member', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    const r = await setTeamMember({ app: APP, email: '  Bob@Example.COM ', role: 'member', by: OWNER });
    expect(r).toEqual({ email: 'bob@example.com', role: 'member', created: true });
    const r2 = await setTeamMember({ app: APP, email: 'BOB@example.com', role: 'member', by: OWNER });
    expect(r2).toEqual({ email: 'bob@example.com', role: 'member', created: false });
    expect((await listTeam(APP)).length).toBe(2);
    expect(await getTeamRole({ app: APP, email: ' BOB@EXAMPLE.COM' })).toBe('member');
  });

  it('refuses to demote the only owner', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    expect(await setTeamMember({ app: APP, email: OWNER, role: 'member', by: OWNER })).toEqual({ error: 'last_owner' });
    expect(await getTeamRole({ app: APP, email: OWNER })).toBe('owner');
    await setTeamMember({ app: APP, email: 'bob@example.com', role: 'owner', by: OWNER });
    expect(await setTeamMember({ app: APP, email: OWNER, role: 'member', by: OWNER }))
      .toEqual({ email: OWNER, role: 'member', created: false });
  });

  it('refuses member 101', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    for (let i = 1; i < TEAM_MAX_MEMBERS; i++) {
      const r = await setTeamMember({ app: APP, email: `m${i}@example.com`, role: 'member', by: OWNER });
      expect(r).toMatchObject({ created: true });
    }
    expect((await listTeam(APP)).length).toBe(100);
    expect(await setTeamMember({ app: APP, email: 'extra@example.com', role: 'member', by: OWNER }))
      .toEqual({ error: 'team_full' });
    // A role change on a full team still works.
    expect(await setTeamMember({ app: APP, email: 'm1@example.com', role: 'owner', by: OWNER }))
      .toMatchObject({ created: false, role: 'owner' });
  });

  it('keeps two apps isolated', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    await setTeamMember({ app: APP2, email: 'other@example.com', role: 'owner', by: BY });
    expect(await getTeamRole({ app: APP2, email: OWNER })).toBeNull();
    expect((await listTeam(APP)).map((m) => m.email)).toEqual([OWNER]);
    expect((await listTeam(APP2)).map((m) => m.email)).toEqual(['other@example.com']);
    // APP2's owner does not count toward APP's owner total.
    expect(await removeTeamMember({ app: APP, email: OWNER })).toEqual({ error: 'last_owner' });
  });
});

describe('removeTeamMember', () => {
  it('removes members and refuses to remove the only owner', async () => {
    await setTeamMember({ app: APP, email: OWNER, role: 'owner', by: BY });
    await setTeamMember({ app: APP, email: 'bob@example.com', role: 'member', by: OWNER });
    expect(await removeTeamMember({ app: APP, email: ' Bob@Example.com' })).toEqual({ removed: true });
    expect(await removeTeamMember({ app: APP, email: 'bob@example.com' })).toEqual({ removed: false });
    expect(await removeTeamMember({ app: APP, email: OWNER })).toEqual({ error: 'last_owner' });
    expect(await getTeamRole({ app: APP, email: OWNER })).toBe('owner');
    await setTeamMember({ app: APP, email: 'carol@example.com', role: 'owner', by: OWNER });
    expect(await removeTeamMember({ app: APP, email: OWNER })).toEqual({ removed: true });
    expect((await listTeam(APP)).map((m) => m.email)).toEqual(['carol@example.com']);
  });
});
