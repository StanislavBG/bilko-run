// Bilko-DB team membership API: an app's team is managed here without per-app host code.
// Team owners use their Clerk token; the site admin (Clerk session) or a registry-scope admin
// API key (agents, the bilko-host MCP) may start and manage any app's team. Admin principals
// manage membership only; they never become members.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ADMIN_EMAILS, verifyClerkToken } from '../clerk.js';
import { requireRegistryWriter } from '../services/admin-api-keys.js';
import { isAppName } from '../services/bilko-db.js';
import {
  getTeamRole,
  listTeam,
  normalizeMemberEmail,
  removeTeamMember,
  setTeamMember,
  type TeamRole,
} from '../services/bilko-db-team.js';
import { checkBilkoDbWrite } from './bilko-db.js';

type Caller =
  | { kind: 'admin'; actor: string }
  | { kind: 'member'; actor: string; email: string; role: TeamRole };

/**
 * Resolves who is calling, or sends a reply and returns null. A `Bearer bka_` key must pass
 * requireRegistryWriter (it sends 403 itself); otherwise a Clerk session is required (401),
 * and a non-admin must be on the app's team (403 not_member).
 */
async function resolveCaller(req: FastifyRequest, reply: FastifyReply, appName: string): Promise<Caller | null> {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer bka_')) {
    const actor = await requireRegistryWriter(req, reply);
    return actor ? { kind: 'admin', actor } : null;
  }
  const email = await verifyClerkToken(header);
  if (!email) {
    reply.code(401).send({ error: 'Sign in required.' });
    return null;
  }
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return { kind: 'admin', actor: email };
  const role = await getTeamRole({ app: appName, email });
  if (!role) {
    reply.code(403).send({ error: 'not_member' });
    return null;
  }
  return { kind: 'member', actor: email, email, role };
}

const isTeamRole = (v: unknown): v is TeamRole => v === 'owner' || v === 'member';

function bodyRole(body: unknown): unknown {
  let b = body;
  if (typeof b === 'string' || Buffer.isBuffer(b)) {
    try { b = JSON.parse(String(b)); } catch { return undefined; }
  }
  return b && typeof b === 'object' ? (b as { role?: unknown }).role : undefined;
}

export function registerBilkoDbTeamRoutes(app: FastifyInstance): void {
  app.get('/api/db/:app/team', async (req, reply) => {
    const { app: appName } = req.params as { app: string };
    if (!isAppName(appName)) return reply.code(400).send({ error: 'bad_app' });
    const caller = await resolveCaller(req, reply, appName);
    if (!caller) return reply;
    const members = await listTeam(appName);
    return reply.header('Cache-Control', 'private, no-store').send({
      app: appName,
      role: caller.kind === 'admin' ? 'admin' : caller.role,
      members: members.map((m) => ({ email: m.email, role: m.role, addedAt: new Date(m.addedAt).toISOString() })),
    });
  });

  app.put('/api/db/:app/team/members/:email', async (req, reply) => {
    const { app: appName, email: rawEmail } = req.params as { app: string; email: string };
    if (!isAppName(appName)) return reply.code(400).send({ error: 'bad_app' });
    const email = normalizeMemberEmail(rawEmail);
    if (email === null) return reply.code(400).send({ error: 'bad_email' });
    const role = bodyRole(req.body);
    if (!isTeamRole(role)) return reply.code(400).send({ error: 'bad_role' });
    const caller = await resolveCaller(req, reply, appName);
    if (!caller) return reply;
    if (caller.kind === 'member' && caller.role !== 'owner') return reply.code(403).send({ error: 'not_member' });
    if (!checkBilkoDbWrite(caller.actor, reply)) return reply;
    const r = await setTeamMember({ app: appName, email, role, by: caller.actor });
    if ('error' in r) return reply.code(409).send({ error: r.error });
    return reply.send({ email: r.email, role: r.role, created: r.created });
  });

  app.delete('/api/db/:app/team/members/:email', async (req, reply) => {
    const { app: appName, email: rawEmail } = req.params as { app: string; email: string };
    if (!isAppName(appName)) return reply.code(400).send({ error: 'bad_app' });
    const email = normalizeMemberEmail(rawEmail);
    if (email === null) return reply.code(400).send({ error: 'bad_email' });
    const caller = await resolveCaller(req, reply, appName);
    if (!caller) return reply;
    if (caller.kind === 'member' && caller.role !== 'owner' && caller.email !== email) {
      return reply.code(403).send({ error: 'not_member' });
    }
    if (!checkBilkoDbWrite(caller.actor, reply)) return reply;
    const r = await removeTeamMember({ app: appName, email });
    if ('error' in r) return reply.code(409).send({ error: r.error });
    if (!r.removed) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true });
  });
}
