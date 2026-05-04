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
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);

// Resolve the host repo root from this file's location.
// Layout: <HOST_ROOT>/mcp-host-server/dist/server.js  →  ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST_ROOT = resolve(__dirname, '..', '..');
const REGISTRY_JSON = resolve(HOST_ROOT, 'src/data/standalone-projects.json');
const HOST_CONTRACT = resolve(HOST_ROOT, 'docs/host-contract.md');
const PUBLIC_PROJECTS = resolve(HOST_ROOT, 'public/projects');

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
  } catch (e: any) {
    lines.push(`origin push FAILED: ${e.message}`);
  }
  try {
    const b = await exec('git', ['push', 'content-grade', 'main:master'], { cwd: HOST_ROOT });
    lines.push(`content-grade: ${(b.stderr || b.stdout).trim().split('\n').slice(-1)[0]}`);
  } catch (e: any) {
    lines.push(`content-grade push FAILED: ${e.message}`);
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
    } catch (e: any) {
      return err(`failed to read host contract at ${HOST_CONTRACT}: ${e.message}`);
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
    } catch (e: any) {
      return err(e.message);
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
    } catch (e: any) {
      return err(e.message);
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
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// 5) publish_static_project ─────────────────────────────────────────────
server.registerTool(
  'publish_static_project',
  {
    title: 'Publish a static-path app build',
    description:
      'Copies a built dist/ from a sibling repo into the host\'s public/projects/<slug>/. Replaces any previous bytes for that slug. Optionally commits + pushes the host so Render auto-deploys. Run this AFTER your `vite build` succeeds in the sibling. The slug must already be registered (call register_static_project first if needed).',
    inputSchema: {
      slug: z.string().min(1),
      distPath: z.string().describe('Absolute path to the built dist/ directory in the sibling repo. Example: "/home/bilko/Projects/Outdoor-Hours/dist".'),
      autoCommit: z.boolean().default(true),
      requireRegistered: z.boolean().default(true).describe('Refuse to publish a slug that isn\'t in the registry.'),
    },
  },
  async ({ slug, distPath, autoCommit, requireRegistered }) => {
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

      // Replace public/projects/<slug>/ atomically-ish (rm + cp -r).
      const target = resolve(PUBLIC_PROJECTS, slug);
      await rm(target, { recursive: true, force: true });
      await mkdir(dirname(target), { recursive: true });
      await exec('cp', ['-r', distAbs, target]);

      const lines = [`published: ${distAbs} → ${target}`];
      if (autoCommit) {
        const r = await commitAndPush(`publish: ${slug} build`, [`public/projects/${slug}`]);
        lines.push(r.details);
      } else {
        lines.push('(not committed — pass autoCommit=true to ship)');
      }
      return ok(lines.join('\n'));
    } catch (e: any) {
      return err(e.message);
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
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ── Boot ─────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Don't write to stdout — that's the MCP transport. stderr only.
  console.error(`bilko-host MCP server listening on stdio (host root: ${HOST_ROOT})`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
