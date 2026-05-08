#!/usr/bin/env node
/**
 * bilko-host MCP server
 *
 * Lets a Claude session in a sibling-repo (e.g. ~/Projects/Outdoor-Hours,
 * ~/Projects/Local-Score) register, publish, and inspect apps on the
 * bilko.run host without editing the host repo by hand.
 *
 * Spec / contract: ~/Projects/Bilko/docs/host-contract.md
 *
 * Tools:
 *   - get_host_contract          → returns the host contract markdown
 *   - list_projects              → returns every project the host knows about
 *   - register_static_project    → adds a static-path entry to the registry
 *   - unregister_project         → removes an entry by slug
 *   - publish_static_project     → copies built dist/ into host's public/projects/<slug>/
 *   - status                     → host git status (uncommitted files, last 5 commits)
 *
 * App sessions wire it up via .mcp.json:
 *   {
 *     "mcpServers": {
 *       "bilko-host": { "command": "node", "args": ["/abs/path/to/dist/server.js"] }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm, mkdir, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestSchema } from './manifest-schema.js';
import { getHostDb, mcpRun, ensureGateTables } from './db.js';
import { runGates, gateSummary, type GateContext } from './gates/index.js';

const exec = promisify(execFile);

// Resolve the host repo root from this file's location.
// Layout: <HOST_ROOT>/mcp-host-server/dist/server.js  →  ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST_ROOT = resolve(__dirname, '..', '..');
const REGISTRY_JSON = resolve(HOST_ROOT, 'src/data/standalone-projects.json');
const HOST_CONTRACT = resolve(HOST_ROOT, 'docs/host-contract.md');
const PUBLIC_PROJECTS = resolve(HOST_ROOT, 'public/projects');

// ── Manifest UPSERT ───────────────────────────────────────────────────────
async function upsertManifest(manifest: ReturnType<typeof ManifestSchema.parse>): Promise<void> {
  await getHostDb().execute({
    sql: `INSERT INTO app_manifests (
      slug, schema_version, app_version, built_at, git_sha, git_branch,
      host_kit_version, golden_path, golden_expect, health_path,
      bundle_size_gz, bundle_files, manifest_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      schema_version=excluded.schema_version,
      app_version=excluded.app_version,
      built_at=excluded.built_at,
      git_sha=excluded.git_sha,
      git_branch=excluded.git_branch,
      host_kit_version=excluded.host_kit_version,
      golden_path=excluded.golden_path,
      golden_expect=excluded.golden_expect,
      health_path=excluded.health_path,
      bundle_size_gz=excluded.bundle_size_gz,
      bundle_files=excluded.bundle_files,
      manifest_json=excluded.manifest_json,
      updated_at=excluded.updated_at`,
    args: [
      manifest.slug, manifest.schemaVersion, manifest.version, manifest.builtAt,
      manifest.gitSha, manifest.gitBranch, manifest.hostKit.version,
      manifest.golden.path, manifest.golden.expect, manifest.health.path ?? null,
      manifest.bundle.sizeBytesGz, manifest.bundle.fileCount,
      JSON.stringify(manifest), Math.floor(Date.now() / 1000),
    ],
  });
}

// ── Types matching projectsRegistry.ts ───────────────────────────────────
interface StaticHost {
  kind: 'static-path';
  path: string;
  sourceRepo?: string;
  localPath?: string;
}
interface ExternalHost {
  kind: 'external-url';
  url: string;
}
interface Project {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  status: 'live' | 'cooking' | 'archived';
  year: number;
  host: StaticHost | ExternalHost;
  tags?: readonly string[];
  thumbnail?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────
async function readRegistry(): Promise<Project[]> {
  const raw = await readFile(REGISTRY_JSON, 'utf8');
  return JSON.parse(raw) as Project[];
}

async function writeRegistry(projects: Project[]): Promise<void> {
  await writeFile(REGISTRY_JSON, JSON.stringify(projects, null, 2) + '\n', 'utf8');
}

async function gitInHost(...args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd: HOST_ROOT });
  return stdout.trim();
}

async function commitAndPush(message: string, paths: string[]): Promise<{ committed: boolean; pushed: boolean; details: string }> {
  // Stage only the paths we touched.
  await exec('git', ['add', '--', ...paths], { cwd: HOST_ROOT });
  // Anything to commit?
  const { stdout: status } = await exec('git', ['status', '--porcelain', '--', ...paths], { cwd: HOST_ROOT });
  if (!status.trim()) {
    return { committed: false, pushed: false, details: 'no changes to commit' };
  }
  await exec('git', ['commit', '-m', message], { cwd: HOST_ROOT });
  const lines: string[] = [`committed: ${message}`];
  // Push to both remotes per the host's CLAUDE.md rule.
  try {
    const a = await exec('git', ['push', 'origin', 'main'], { cwd: HOST_ROOT });
    lines.push(`origin: ${(a.stderr || a.stdout).trim().split('\n').slice(-1)[0]}`);
  } catch (e: unknown) {
    lines.push(`origin push FAILED: ${(e as Error).message}`);
  }
  try {
    const b = await exec('git', ['push', 'content-grade', 'main:master'], { cwd: HOST_ROOT });
    lines.push(`content-grade: ${(b.stderr || b.stdout).trim().split('\n').slice(-1)[0]}`);
  } catch (e: unknown) {
    lines.push(`content-grade push FAILED: ${(e as Error).message}`);
  }
  return { committed: true, pushed: true, details: lines.join('\n') };
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function err(text: string) {
  return { content: [{ type: 'text' as const, text: `ERROR: ${text}` }], isError: true };
}

// ── Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'bilko-host',
  version: '1.0.0',
});

// 1) get_host_contract ─────────────────────────────────────────────────
server.registerTool(
  'get_host_contract',
  {
    title: 'Get host contract',
    description:
      'Returns the bilko.run host/app contract (host-contract.md). Read this first when working on a sibling-repo app — it explains the three host kinds, what the host provides (auth, credits, kit, brand), what an app must implement, URL canonicalization, and the add/remove checklists.',
    inputSchema: {},
  },
  async () => {
    try {
      const text = await readFile(HOST_CONTRACT, 'utf8');
      return ok(text);
    } catch (e: unknown) {
      return err(`failed to read host contract at ${HOST_CONTRACT}: ${(e as Error).message}`);
    }
  },
);

// 2) list_projects ─────────────────────────────────────────────────────
server.registerTool(
  'list_projects',
  {
    title: 'List projects',
    description:
      'Returns every project the bilko.run host currently knows about. Includes both react-route apps (in the host repo) and standalone apps (sibling repos, static-path/external). Use to check whether a slug is taken before registering.',
    inputSchema: {},
  },
  async () => {
    try {
      const standalone = await readRegistry();
      const counts = {
        standalone: standalone.length,
        public_projects_dirs: existsSync(PUBLIC_PROJECTS)
          ? (await import('node:fs/promises')).readdir(PUBLIC_PROJECTS).then(arr => arr.length)
          : 0,
      };
      const out = {
        standalone,
        notes: [
          `react-route apps live in src/config/tools.ts and aren't returned here.`,
          `Sources: ${REGISTRY_JSON}`,
        ],
        counts: { standalone: counts.standalone, public_projects_dirs: await counts.public_projects_dirs },
      };
      return ok(JSON.stringify(out, null, 2));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 3) register_static_project ────────────────────────────────────────────
server.registerTool(
  'register_static_project',
  {
    title: 'Register a static-path app',
    description:
      'Adds a static-path entry to the bilko.run host registry. Use this once per app, when you first deploy. The slug must be unique. After this call, the app shows up on /, /products, and ⌘K. Set autoCommit=true to also commit + push to both remotes (origin + content-grade) so Render auto-deploys.',
    inputSchema: {
      slug: z.string().min(1).describe('URL slug, kebab-case. Example: "outdoor-hours". Path will be /projects/<slug>/.'),
      name: z.string().min(1).describe('Display name. Example: "OutdoorHours".'),
      tagline: z.string().min(1).describe('One-sentence pitch shown on cards.'),
      category: z.string().describe('Display category. Common: "AI Tool · Productivity", "AI Tool · Content", "AI Tool · Dev", "Game", "Data".'),
      status: z.enum(['live', 'cooking', 'archived']).default('live'),
      year: z.number().int().describe('Year of the build, e.g. 2026.'),
      sourceRepo: z.string().optional().describe('e.g. "github.com/StanislavBG/outdoor-hours"'),
      localPath: z.string().optional().describe('e.g. "~/Projects/Outdoor-Hours"'),
      tags: z.array(z.string()).optional().describe('Up to ~3 short tags, e.g. ["Free", "WebGPU"].'),
      autoCommit: z.boolean().default(true).describe('Also commit + push to both host remotes.'),
    },
  },
  async ({ slug, name, tagline, category, status, year, sourceRepo, localPath, tags, autoCommit }) => {
    try {
      const projects = await readRegistry();
      if (projects.some(p => p.slug === slug)) {
        return err(`slug "${slug}" already registered. Use unregister_project first if you want to replace it.`);
      }
      const entry: Project = {
        slug,
        name,
        tagline,
        category,
        status,
        year,
        host: {
          kind: 'static-path',
          path: `/projects/${slug}/`,
          ...(sourceRepo ? { sourceRepo } : {}),
          ...(localPath ? { localPath } : {}),
        },
        ...(tags && tags.length ? { tags } : {}),
      };
      projects.push(entry);
      await writeRegistry(projects);

      const lines = [`registered: ${slug} → /projects/${slug}/`];
      if (autoCommit) {
        const r = await commitAndPush(`registry: add ${slug} (${name})`, ['src/data/standalone-projects.json']);
        lines.push(r.details);
      } else {
        lines.push('(not committed — pass autoCommit=true to ship)');
      }
      return ok(lines.join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4) unregister_project ─────────────────────────────────────────────────
server.registerTool(
  'unregister_project',
  {
    title: 'Unregister a static-path app',
    description:
      'Removes a project from the host registry by slug. Does NOT delete the public/projects/<slug>/ directory — pass deleteAssets=true to also rm -rf those bytes. Use this when retiring an app or before re-registering with different metadata.',
    inputSchema: {
      slug: z.string().min(1),
      deleteAssets: z.boolean().default(false).describe('Also remove public/projects/<slug>/.'),
      autoCommit: z.boolean().default(true).describe('Also commit + push.'),
    },
  },
  async ({ slug, deleteAssets, autoCommit }) => {
    try {
      const projects = await readRegistry();
      const next = projects.filter(p => p.slug !== slug);
      if (next.length === projects.length) {
        return err(`slug "${slug}" not found in registry.`);
      }
      await writeRegistry(next);
      const paths = ['src/data/standalone-projects.json'];
      const lines = [`unregistered: ${slug}`];

      if (deleteAssets) {
        const dir = resolve(PUBLIC_PROJECTS, slug);
        if (existsSync(dir)) {
          await rm(dir, { recursive: true, force: true });
          lines.push(`removed: ${dir}`);
          paths.push(`public/projects/${slug}`);
        }
      }

      if (autoCommit) {
        const r = await commitAndPush(`registry: remove ${slug}`, paths);
        lines.push(r.details);
      } else {
        lines.push('(not committed — pass autoCommit=true to ship)');
      }
      return ok(lines.join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 5) publish_static_project ─────────────────────────────────────────────
server.registerTool(
  'publish_static_project',
  {
    title: 'Publish a static-path app build',
    description:
      'Copies a built dist/ from a sibling repo into the host\'s public/projects/<slug>/. Runs five publish gates (manifest, budget, golden, a11y, audit) before copying. Any non-bypassed gate failure blocks the publish. Pass sourceRepoPath so the golden and audit gates can run. Pass bypass (comma-sep gate names) + bypassReason to override a specific gate — every bypass is audit-logged.',
    inputSchema: {
      slug: z.string().min(1),
      distPath: z.string().describe('Absolute path to the built dist/ directory in the sibling repo. Example: "/home/bilko/Projects/Outdoor-Hours/dist".'),
      sourceRepoPath: z.string().optional().describe('Absolute path to the sibling repo root (e.g. "/home/bilko/Projects/Stack-Audit"). Required for golden and audit gates.'),
      bypass: z.string().optional().describe('Comma-separated gate names to skip, e.g. "a11y" or "golden,audit". Each bypass is logged.'),
      bypassReason: z.string().optional().describe('Required justification when bypass is set. Logged to publish_overrides.'),
      autoCommit: z.boolean().default(true),
      requireRegistered: z.boolean().default(true).describe('Refuse to publish a slug that isn\'t in the registry.'),
    },
  },
  async ({ slug, distPath, sourceRepoPath, bypass, bypassReason, autoCommit, requireRegistered }) => {
    try {
      // Sanity: dist exists and looks like a build.
      const distAbs = resolve(distPath);
      if (!existsSync(distAbs)) return err(`distPath does not exist: ${distAbs}`);
      const stats = await stat(distAbs);
      if (!stats.isDirectory()) return err(`distPath is not a directory: ${distAbs}`);
      if (!existsSync(resolve(distAbs, 'index.html'))) {
        return err(`distPath has no index.html — not a Vite build? (${distAbs})`);
      }

      // Sanity: slug registered (unless caller opts out).
      if (requireRegistered) {
        const projects = await readRegistry();
        const p = projects.find(x => x.slug === slug);
        if (!p) return err(`slug "${slug}" is not registered. Call register_static_project first.`);
        if (p.host.kind !== 'static-path') return err(`slug "${slug}" is registered but not a static-path host (${p.host.kind}).`);
      }

      // Run publish gates.
      const bypassSet = new Set((bypass ?? '').split(',').filter(Boolean));
      const ctx: GateContext = {
        slug,
        bundleDir: distAbs,
        sourceRepo: sourceRepoPath,
        bypass: bypassSet,
        adminEmail: undefined,
      };
      const results = await runGates(ctx);
      const summary = gateSummary(results);

      // Telemetry: log every gate outcome to stderr (MCP server can't use stdout).
      for (const r of results) {
        console.error(`[gate] ${slug}/${r.name}: ${r.status} — ${r.details}`);
      }

      // Audit-log every bypassed gate.
      const skipped = results.filter(r => r.status === 'skipped');
      for (const s of skipped) {
        try {
          await mcpRun(
            `INSERT INTO publish_overrides (slug, gate, reason, admin_email, created_at) VALUES (?, ?, ?, ?, ?)`,
            [slug, s.name, bypassReason ?? '', ctx.adminEmail ?? 'unknown', Math.floor(Date.now() / 1000)],
          );
        } catch (dbErr: unknown) {
          console.error('[publish-override] DB write failed (non-fatal):', (dbErr as Error).message);
        }
      }

      if (!summary.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: `publish blocked by gate(s): ${summary.failed.join(', ')}`,
              gates: results,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Gates passed — replace public/projects/<slug>/ atomically-ish (rm + cp -r).
      const target = resolve(PUBLIC_PROJECTS, slug);
      await rm(target, { recursive: true, force: true });
      await mkdir(dirname(target), { recursive: true });
      await exec('cp', ['-r', distAbs, target]);

      // Write manifest row to host DB (best-effort — don't fail the publish if DB is down).
      if (ctx.manifest) {
        try {
          await upsertManifest(ctx.manifest);
        } catch (dbErr: unknown) {
          console.error('[manifest-upsert] DB write failed (non-fatal):', (dbErr as Error).message);
        }
      }

      const lines = [
        `gates: ${results.map(r => `${r.name}=${r.status}`).join(', ')}`,
        `published: ${distAbs} → ${target}`,
      ];
      if (autoCommit) {
        const r = await commitAndPush(`publish: ${slug} build`, [`public/projects/${slug}`]);
        lines.push(r.details);
      } else {
        lines.push('(not committed — pass autoCommit=true to ship)');
      }
      return ok(lines.join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 6) status ────────────────────────────────────────────────────────────
server.registerTool(
  'status',
  {
    title: 'Host status',
    description:
      'Returns the host repo\'s current git status (uncommitted files), the last 5 commits, and the current branch. Use to verify a publish landed cleanly.',
    inputSchema: {},
  },
  async () => {
    try {
      const branch = await gitInHost('rev-parse', '--abbrev-ref', 'HEAD');
      const status = await gitInHost('status', '--short');
      const log = await gitInHost('log', '--oneline', '-5');
      return ok([
        `branch: ${branch}`,
        '',
        'uncommitted:',
        status || '  (clean)',
        '',
        'last 5 commits:',
        log,
      ].join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// ── Boot ─────────────────────────────────────────────────────────────────
async function main() {
  // Ensure gate tables exist (idempotent — CREATE TABLE IF NOT EXISTS).
  try {
    await ensureGateTables();
  } catch (e: unknown) {
    console.error('[boot] ensureGateTables failed (non-fatal):', (e as Error).message);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Don't write to stdout — that's the MCP transport. stderr only.
  console.error(`bilko-host MCP server listening on stdio (host root: ${HOST_ROOT})`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
