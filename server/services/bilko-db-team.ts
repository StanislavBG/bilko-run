// Bilko-DB app teams: the members of an app's team and their roles. Team documents and images
// reuse bilko_db_docs / bilko_db_images with teamPrincipal(app) in user_email, so versioning,
// quota and image code stay one implementation; this module only stores who is on the team.
import { dbAll, dbGet, txGet, txRun } from '../db.js';
import { EMAIL_RE } from '../clerk.js';
import { serializedWrite } from './bilko-db.js';

export type TeamRole = 'owner' | 'member';

export const TEAM_MAX_MEMBERS = 100;
const EMAIL_MAX_LEN = 254;

export interface TeamMember {
  email: string;
  role: TeamRole;
  addedAt: number;
}

export type SetTeamMemberResult =
  | { email: string; role: TeamRole; created: boolean }
  | { error: 'last_owner' }
  | { error: 'team_full' };

export type RemoveTeamMemberResult = { removed: boolean } | { error: 'last_owner' };

/** The Bilko-DB user_email principal for an app's team. Has no '@', so never equals a verified email. */
export function teamPrincipal(app: string): string {
  return 'team:' + app;
}

/** Trimmed, lowercased email, or null when it is not a plausible email of at most 254 chars. */
export function normalizeMemberEmail(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const e = s.trim().toLowerCase();
  if (e.length === 0 || e.length > EMAIL_MAX_LEN || !EMAIL_RE.test(e)) return null;
  return e;
}

function requireEmail(s: string): string {
  const e = normalizeMemberEmail(s);
  if (e === null) throw new TypeError('bilko-db-team: invalid member email');
  return e;
}

export async function getTeamRole(opts: { app: string; email: string }): Promise<TeamRole | null> {
  const email = normalizeMemberEmail(opts.email);
  if (email === null) return null;
  const row = await dbGet<{ role: TeamRole }>(
    `SELECT role FROM bilko_db_team_members WHERE app = ? AND email = ?`,
    opts.app, email,
  );
  return row ? row.role : null;
}

export async function listTeam(app: string): Promise<TeamMember[]> {
  const rows = await dbAll<{ email: string; role: TeamRole; added_at: number }>(
    `SELECT email, role, added_at FROM bilko_db_team_members WHERE app = ? ORDER BY email`,
    app,
  );
  return rows.map((r) => ({ email: String(r.email), role: r.role, addedAt: Number(r.added_at) }));
}

/**
 * Adds a member or changes their role. Refuses to demote the only owner and to add a member
 * past TEAM_MAX_MEMBERS. Throws TypeError on an invalid email (callers validate first).
 */
export async function setTeamMember(opts: {
  app: string;
  email: string;
  role: TeamRole;
  by: string;
}): Promise<SetTeamMemberResult> {
  const { app, role, by } = opts;
  const email = requireEmail(opts.email);
  return serializedWrite(async (tx): Promise<SetTeamMemberResult> => {
    const cur = await txGet<{ role: TeamRole }>(
      tx,
      `SELECT role FROM bilko_db_team_members WHERE app = ? AND email = ?`,
      app, email,
    );
    if (cur) {
      if (cur.role === 'owner' && role !== 'owner') {
        const owners = await txGet<{ n: number }>(
          tx,
          `SELECT COUNT(*) AS n FROM bilko_db_team_members WHERE app = ? AND role = 'owner'`,
          app,
        );
        if (Number(owners?.n ?? 0) <= 1) return { error: 'last_owner' };
      }
      if (cur.role !== role) {
        await txRun(
          tx,
          `UPDATE bilko_db_team_members SET role = ? WHERE app = ? AND email = ?`,
          role, app, email,
        );
      }
      return { email, role, created: false };
    }
    const count = await txGet<{ n: number }>(
      tx,
      `SELECT COUNT(*) AS n FROM bilko_db_team_members WHERE app = ?`,
      app,
    );
    if (Number(count?.n ?? 0) >= TEAM_MAX_MEMBERS) return { error: 'team_full' };
    await txRun(
      tx,
      `INSERT INTO bilko_db_team_members (app, email, role, added_by, added_at) VALUES (?, ?, ?, ?, ?)`,
      app, email, role, by, Date.now(),
    );
    return { email, role, created: true };
  });
}

/** Removes a member. Refuses to remove the only owner. An invalid email removes nothing. */
export async function removeTeamMember(opts: { app: string; email: string }): Promise<RemoveTeamMemberResult> {
  const { app } = opts;
  const email = normalizeMemberEmail(opts.email);
  if (email === null) return { removed: false };
  return serializedWrite(async (tx): Promise<RemoveTeamMemberResult> => {
    const cur = await txGet<{ role: TeamRole }>(
      tx,
      `SELECT role FROM bilko_db_team_members WHERE app = ? AND email = ?`,
      app, email,
    );
    if (!cur) return { removed: false };
    if (cur.role === 'owner') {
      const owners = await txGet<{ n: number }>(
        tx,
        `SELECT COUNT(*) AS n FROM bilko_db_team_members WHERE app = ? AND role = 'owner'`,
        app,
      );
      if (Number(owners?.n ?? 0) <= 1) return { error: 'last_owner' };
    }
    await txRun(tx, `DELETE FROM bilko_db_team_members WHERE app = ? AND email = ?`, app, email);
    return { removed: true };
  });
}
