// Registry API over Bilko-DB: the bilko-host MCP writes project entries here instead of
// committing src/data/standalone-projects.json. Reads take requireAdmin (read keys allowed);
// writes take requireRegistryWriter. Every successful write refreshes the in-memory snapshot,
// so the site, catalog, OG cards and forwarding change at once.
import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../clerk.js';
import { dbAll } from '../db.js';
import { requireRegistryWriter } from '../services/admin-api-keys.js';
import { deleteProject, putProject } from '../services/registry-db.js';
import { refreshRegistry } from '../registry-runtime.js';
import { RegistryProjectSchema } from '../../mcp-host-server/src/contract/registry.js';

const LOG_LIMIT = 100;

type ProjectRow = { entry_json: string; version: number };
type LogRow = {
  id: number;
  slug: string | null;
  action: string;
  before_json: string | null;
  after_json: string | null;
  actor: string;
  at: number;
};

const parseJson = (s: string | null): unknown => (s == null ? null : JSON.parse(s));

/** undefined when absent, a non-negative integer, or NaN for anything else. */
function parseIfVersion(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : NaN;
}

export function registerAdminRegistryRoutes(app: FastifyInstance): void {
  app.get('/api/admin/registry', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const rows = await dbAll<ProjectRow>(
      `SELECT entry_json, version FROM bilko_db_projects ORDER BY position ASC, slug ASC`,
    );
    return {
      projects: rows.map((r) => ({
        entry: RegistryProjectSchema.parse(JSON.parse(r.entry_json)),
        version: Number(r.version),
      })),
    };
  });

  app.get('/api/admin/registry/log', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { slug } = (req.query ?? {}) as { slug?: unknown };
    if (slug !== undefined && typeof slug !== 'string') {
      reply.status(400).send({ error: 'slug must be a string.' });
      return;
    }
    const cols = 'id, slug, action, before_json, after_json, actor, at';
    const rows = slug
      ? await dbAll<LogRow>(
          `SELECT ${cols} FROM bilko_db_project_log WHERE slug = ? ORDER BY id DESC LIMIT ?`, slug, LOG_LIMIT)
      : await dbAll<LogRow>(`SELECT ${cols} FROM bilko_db_project_log ORDER BY id DESC LIMIT ?`, LOG_LIMIT);
    return {
      rows: rows.map((r) => ({
        id: Number(r.id),
        slug: r.slug,
        action: r.action,
        before: parseJson(r.before_json),
        after: parseJson(r.after_json),
        actor: r.actor,
        at: Number(r.at),
      })),
    };
  });

  app.put('/api/admin/registry/:slug', async (req, reply) => {
    const actor = await requireRegistryWriter(req, reply);
    if (!actor) return;
    const { slug } = req.params as { slug: string };
    const body = (req.body ?? {}) as { entry?: unknown; ifVersion?: unknown };
    const ifVersion = parseIfVersion(body.ifVersion);
    if (Number.isNaN(ifVersion)) {
      reply.status(400).send({ error: 'invalid_request', issues: ['ifVersion: must be a non-negative integer'] });
      return;
    }
    if (body.entry === undefined || body.entry === null || typeof body.entry !== 'object' || Array.isArray(body.entry)) {
      reply.status(400).send({ error: 'invalid_entry', issues: ['entry: required object'] });
      return;
    }
    const shape = RegistryProjectSchema.safeParse(body.entry);
    if (!shape.success) {
      const issues = shape.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
      reply.status(400).send({ error: 'invalid_entry', issues });
      return;
    }
    if (shape.data.slug !== slug) {
      reply.status(400).send({
        error: 'invalid_entry',
        issues: [`slug: entry.slug "${shape.data.slug}" does not match the URL slug "${slug}"`],
      });
      return;
    }
    const result = await putProject(body.entry, actor, ifVersion);
    if ('error' in result) {
      if (result.error === 'version_mismatch') {
        reply.status(409).send({ error: 'version_mismatch', version: result.version });
      } else {
        reply.status(400).send({ error: 'invalid_entry', issues: result.issues });
      }
      return;
    }
    await refreshRegistry();
    return { slug: result.entry.slug, version: result.version };
  });

  app.delete('/api/admin/registry/:slug', async (req, reply) => {
    const actor = await requireRegistryWriter(req, reply);
    if (!actor) return;
    const { slug } = req.params as { slug: string };
    const query = (req.query ?? {}) as { ifVersion?: unknown };
    const body = (req.body ?? {}) as { ifVersion?: unknown };
    const ifVersion = parseIfVersion(query.ifVersion ?? (typeof body === 'object' ? body.ifVersion : undefined));
    if (Number.isNaN(ifVersion)) {
      reply.status(400).send({ error: 'invalid_request', issues: ['ifVersion: must be a non-negative integer'] });
      return;
    }
    const result = await deleteProject(slug, actor, ifVersion);
    if ('error' in result) {
      if (result.error === 'version_mismatch') {
        reply.status(409).send({ error: 'version_mismatch', version: result.version });
      } else {
        reply.status(404).send({ error: 'not_found' });
      }
      return;
    }
    await refreshRegistry();
    return { ok: true };
  });
}
