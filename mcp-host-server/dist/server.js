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
 *   - usage_report               → per-project egress (bytes/requests), no Clerk JWT needed
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
import { readFile, writeFile, rm, mkdir, stat, cp, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { getHostDb, mcpRun, mcpGet, mcpAll, ensureGateTables } from './db.js';
import { runGates, gateSummary } from './gates/index.js';
import { SlugSchema, ProjectStatusSchema, RegistrySchema } from './contract/registry.js';
import { projectDir, parseBypass, parseRegistry } from './publish-request.js';
import { withPublishCheckout } from './publish-checkout.js';
const exec = promisify(execFile);
// Resolve the host repo root from this file's location.
// Layout: <HOST_ROOT>/mcp-host-server/dist/server.js  →  ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST_ROOT = resolve(__dirname, '..', '..');
const REGISTRY_JSON = resolve(HOST_ROOT, 'src/data/standalone-projects.json');
const HOST_CONTRACT = resolve(HOST_ROOT, 'docs/host-contract.md');
const PUBLIC_PROJECTS = resolve(HOST_ROOT, 'public/projects');
// Mirrors publish-checkout.ts's own default — that file isn't exported here
// because status just inspects the checkout, it doesn't drive it.
const PUBLISH_CHECKOUT_DIR = process.env.BILKO_PUBLISH_CHECKOUT || resolve(homedir(), '.local/state/bilko-host/publish-checkout');
// ── Manifest UPSERT ───────────────────────────────────────────────────────
async function upsertManifest(manifest) {
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
// ── Helpers ──────────────────────────────────────────────────────────────
async function readRegistry(root) {
    const raw = await readFile(resolve(root, 'src/data/standalone-projects.json'), 'utf8');
    return parseRegistry(raw);
}
async function writeRegistry(root, projects) {
    const validated = RegistrySchema.parse(projects);
    await writeFile(resolve(root, 'src/data/standalone-projects.json'), JSON.stringify(validated, null, 2) + '\n', 'utf8');
}
async function gitInHost(...args) {
    const { stdout } = await exec('git', args, { cwd: HOST_ROOT });
    return stdout.trim();
}
function ok(text) {
    return { content: [{ type: 'text', text }] };
}
function err(text) {
    return { content: [{ type: 'text', text: `ERROR: ${text}` }], isError: true };
}
function checkoutErr(outcome) {
    return err(`publish checkout failed at stage "${outcome.stage}": ${outcome.error}`);
}
function pushedLine(outcome) {
    return outcome.committed ? `pushed: ${outcome.sha}` : 'no changes to commit';
}
// ── Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
    name: 'bilko-host',
    version: '1.0.0',
});
// 1) get_host_contract ─────────────────────────────────────────────────
server.registerTool('get_host_contract', {
    title: 'Get host contract',
    description: 'Returns the bilko.run host/app contract (host-contract.md). Read this first when working on a sibling-repo app — it explains the three host kinds, what the host provides (auth, credits, kit, brand), what an app must implement, URL canonicalization, and the add/remove checklists.',
    inputSchema: {},
}, async () => {
    try {
        const text = await readFile(HOST_CONTRACT, 'utf8');
        return ok(text);
    }
    catch (e) {
        return err(`failed to read host contract at ${HOST_CONTRACT}: ${e.message}`);
    }
});
// 2) list_projects ─────────────────────────────────────────────────────
server.registerTool('list_projects', {
    title: 'List projects',
    description: 'Returns every project the bilko.run host currently knows about. Includes both react-route apps (in the host repo) and standalone apps (sibling repos, static-path/external). Use to check whether a slug is taken before registering.',
    inputSchema: {},
}, async () => {
    try {
        const standalone = await readRegistry(HOST_ROOT);
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
                `Sources: ${REGISTRY_JSON} (this process's local host checkout).`,
                `The authoritative copy lives on origin/main — this local copy can lag behind a publish made from another checkout.`,
            ],
            counts: { standalone: counts.standalone, public_projects_dirs: await counts.public_projects_dirs },
        };
        return ok(JSON.stringify(out, null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 3) register_static_project ────────────────────────────────────────────
server.registerTool('register_static_project', {
    title: 'Register a static-path app',
    description: 'Adds a static-path entry to the bilko.run host registry. Use this once per app, when you first deploy. The slug must be unique. After this call, the app shows up on /, /products, and ⌘K. The registry write, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main — never against the caller\'s own working tree.',
    inputSchema: {
        slug: SlugSchema.describe('URL slug, kebab-case. Example: "outdoor-hours". Path will be /projects/<slug>/.'),
        name: z.string().min(1).describe('Display name. Example: "OutdoorHours".'),
        tagline: z.string().min(1).describe('One-sentence pitch shown on cards.'),
        category: z.string().describe('Display category. Common: "AI Tool · Productivity", "AI Tool · Content", "AI Tool · Dev", "Game", "Data".'),
        status: ProjectStatusSchema.default('live'),
        year: z.number().int().describe('Year of the build, e.g. 2026.'),
        sourceRepo: z.string().optional().describe('e.g. "github.com/StanislavBG/outdoor-hours"'),
        localPath: z.string().optional().describe('e.g. "~/Projects/Outdoor-Hours"'),
        tags: z.array(z.string()).optional().describe('Up to ~3 short tags, e.g. ["Free", "WebGPU"].'),
    },
}, async ({ slug, name, tagline, category, status, year, sourceRepo, localPath, tags }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            if (projects.some(p => p.slug === slug)) {
                throw new Error(`slug "${slug}" already registered. Use unregister_project first if you want to replace it.`);
            }
            const entry = {
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
            await writeRegistry(root, projects);
            return {
                result: { slug },
                paths: ['src/data/standalone-projects.json'],
                message: `registry: add ${slug} (${name})`,
            };
        });
        if (!outcome.ok)
            return checkoutErr(outcome);
        return ok([`registered: ${slug} → /projects/${slug}/`, pushedLine(outcome)].join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 4) unregister_project ─────────────────────────────────────────────────
server.registerTool('unregister_project', {
    title: 'Unregister a static-path app',
    description: 'Removes a project from the host registry by slug. Does NOT delete the public/projects/<slug>/ directory — pass deleteAssets=true to also rm -rf those bytes. Use this when retiring an app or before re-registering with different metadata. The registry write, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main.',
    inputSchema: {
        slug: SlugSchema,
        deleteAssets: z.boolean().default(false).describe('Also remove public/projects/<slug>/.'),
    },
}, async ({ slug, deleteAssets }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            const next = projects.filter(p => p.slug !== slug);
            if (next.length === projects.length) {
                throw new Error(`slug "${slug}" not found in registry.`);
            }
            await writeRegistry(root, next);
            const paths = ['src/data/standalone-projects.json'];
            const removed = [];
            if (deleteAssets) {
                const dir = projectDir(resolve(root, 'public/projects'), slug);
                if (existsSync(dir)) {
                    await rm(dir, { recursive: true, force: true });
                    removed.push(dir);
                    paths.push(`public/projects/${slug}`);
                }
            }
            return { result: { removed }, paths, message: `registry: remove ${slug}` };
        });
        if (!outcome.ok)
            return checkoutErr(outcome);
        const lines = [`unregistered: ${slug}`];
        for (const dir of outcome.result.removed)
            lines.push(`removed: ${dir}`);
        lines.push(pushedLine(outcome));
        return ok(lines.join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 5) publish_static_project ─────────────────────────────────────────────
server.registerTool('publish_static_project', {
    title: 'Publish a static-path app build',
    description: 'Copies a built dist/ from a sibling repo into the host\'s public/projects/<slug>/. Runs five publish gates (manifest, budget, golden, a11y, audit) before copying. Any non-bypassed gate failure blocks the publish. Pass sourceRepoPath so the golden and audit gates can run. Pass bypass (comma-sep gate names) + bypassReason to override a specific gate — every bypass is audit-logged. The copy, registry check, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main — never against the caller\'s own working tree.',
    inputSchema: {
        slug: SlugSchema,
        distPath: z.string().describe('Absolute path to the built dist/ directory in the sibling repo. Example: "/home/bilko/Projects/Outdoor-Hours/dist".'),
        sourceRepoPath: z.string().optional().describe('Absolute path to the sibling repo root (e.g. "/home/bilko/Projects/Stack-Audit"). Required for golden and audit gates.'),
        bypass: z.string().optional().describe('Comma-separated gate names to skip, e.g. "a11y" or "golden,audit". Each bypass is logged.'),
        bypassReason: z.string().optional().describe('Required justification when bypass is set. Logged to publish_overrides.'),
        requireRegistered: z.boolean().default(true).describe('Refuse to publish a slug that isn\'t in the registry.'),
    },
}, async ({ slug, distPath, sourceRepoPath, bypass, bypassReason, requireRegistered }) => {
    try {
        // Sanity: dist exists and looks like a build.
        const distAbs = resolve(distPath);
        if (!existsSync(distAbs))
            return err(`distPath does not exist: ${distAbs}`);
        const stats = await stat(distAbs);
        if (!stats.isDirectory())
            return err(`distPath is not a directory: ${distAbs}`);
        if (!existsSync(resolve(distAbs, 'index.html'))) {
            return err(`distPath has no index.html — not a Vite build? (${distAbs})`);
        }
        // Run publish gates against distPath, outside the publish checkout/lock.
        const bypassResult = parseBypass(bypass, bypassReason);
        if ('error' in bypassResult) {
            return err(bypassResult.error);
        }
        const ctx = {
            slug,
            bundleDir: distAbs,
            sourceRepo: sourceRepoPath,
            bypass: bypassResult.gates,
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
                await mcpRun(`INSERT INTO publish_overrides (slug, gate, reason, admin_email, created_at) VALUES (?, ?, ?, ?, ?)`, [slug, s.name, bypassReason ?? '', ctx.adminEmail ?? 'unknown', Math.floor(Date.now() / 1000)]);
            }
            catch (dbErr) {
                console.error('[publish-override] DB write failed (non-fatal):', dbErr.message);
            }
        }
        if (!summary.ok) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: `publish blocked by gate(s): ${summary.failed.join(', ')}`,
                            gates: results,
                        }, null, 2),
                    }],
                isError: true,
            };
        }
        // Gates passed — copy + swap + commit + push, all inside the publish checkout.
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            if (requireRegistered) {
                const projects = await readRegistry(root);
                const p = projects.find(x => x.slug === slug);
                if (!p)
                    throw new Error(`slug "${slug}" is not registered. Call register_static_project first.`);
                if (p.host.kind !== 'static-path')
                    throw new Error(`slug "${slug}" is registered but not a static-path host (${p.host.kind}).`);
            }
            const publicProjects = resolve(root, 'public/projects');
            const target = projectDir(publicProjects, slug);
            const incoming = `${target}.incoming-${process.pid}`;
            const oldAside = `${target}.old-${process.pid}`;
            // Clean up any stale incoming dir from a previous failed attempt before
            // copying — a failure here must never touch `target`.
            await rm(incoming, { recursive: true, force: true });
            await mkdir(dirname(incoming), { recursive: true });
            await cp(distAbs, incoming, { recursive: true });
            if (existsSync(target)) {
                await rename(target, oldAside);
            }
            await rename(incoming, target);
            await rm(oldAside, { recursive: true, force: true });
            return { result: { target }, paths: [`public/projects/${slug}`], message: `publish: ${slug} build` };
        });
        if (!outcome.ok)
            return checkoutErr(outcome);
        // Write manifest row to host DB (best-effort — don't fail the publish if DB is down).
        if (ctx.manifest) {
            try {
                await upsertManifest(ctx.manifest);
            }
            catch (dbErr) {
                console.error('[manifest-upsert] DB write failed (non-fatal):', dbErr.message);
            }
        }
        const lines = [
            `gates: ${results.map(r => `${r.name}=${r.status}`).join(', ')}`,
            `published: ${distAbs} → public/projects/${slug}`,
            pushedLine(outcome),
        ];
        return ok(lines.join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 6) status ────────────────────────────────────────────────────────────
server.registerTool('status', {
    title: 'Host status',
    description: 'Returns the host repo\'s current git status (uncommitted files), the last 5 commits, and the current branch — plus the publish checkout\'s own HEAD sha and whether it matches origin/main. Use to verify a publish landed cleanly.',
    inputSchema: {},
}, async () => {
    try {
        const branch = await gitInHost('rev-parse', '--abbrev-ref', 'HEAD');
        const status = await gitInHost('status', '--short');
        const log = await gitInHost('log', '--oneline', '-5');
        let checkoutLines;
        if (!existsSync(PUBLISH_CHECKOUT_DIR)) {
            checkoutLines = ['publish checkout: not yet created (no publish has run from this host yet)'];
        }
        else {
            try {
                const { stdout: headOut } = await exec('git', ['rev-parse', 'HEAD'], { cwd: PUBLISH_CHECKOUT_DIR });
                const { stdout: originOut } = await exec('git', ['rev-parse', 'origin/main'], { cwd: PUBLISH_CHECKOUT_DIR });
                const head = headOut.trim();
                const origin = originOut.trim();
                checkoutLines = [
                    `publish checkout HEAD: ${head}`,
                    `publish checkout == origin/main: ${head === origin}`,
                ];
            }
            catch (e) {
                checkoutLines = [`publish checkout: failed to read git state: ${e.message}`];
            }
        }
        return ok([
            `branch: ${branch}`,
            '',
            'uncommitted:',
            status || '  (clean)',
            '',
            'last 5 commits:',
            log,
            '',
            ...checkoutLines,
        ].join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 7) usage_report ────────────────────────────────────────────────────────
//
// Query shape mirrors server/egress.ts's topEgress() (host repo, not this
// package — mcp-host-server has its own tsconfig/rootDir and no fastify
// dependency, so it reads the same table directly instead of importing
// across packages). If that SQL changes, update this too.
const STATIC_ROUTE_PREFIX = 'static:';
function dayKey(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}
server.registerTool('usage_report', {
    title: 'Per-project egress/usage report',
    description: 'Reads api_egress_daily directly through this MCP\'s own Turso client — no Clerk JWT, no browser, safe for cron/headless callers. Returns per-project static-asset egress (bytes out + request count, sorted by bytes descending, with bytesPerRequest) over a trailing window (default 7 days), plus the raw /api/* route rows reported separately (those are route *patterns*, not resolved to a project slug). ' +
        'IMPORTANT: these are capacity-signal numbers measured at the origin server, NOT Render billing figures — Render bills at the edge/CDN layer, which can differ. They also under-report by up to the in-process flush interval (60s) on every process restart, because the egress buffer is in-memory until flushed. ' +
        'static:_host and static:_other are surfaced explicitly rather than filtered out: _host currently absorbs top-level static dirs that belong to real projects but aren\'t served under /projects/<slug>/ (e.g. OutdoorHours\' large hourly-data tree at top-level /outdoor-hours/, plus /apps/ and /session-manager-operations/) — so _host is not purely host chrome today. _other is traffic to an unrecognised /projects/<x>/ slug. Also reports the earliest date present in the table so a caller can tell "no traffic in this window" apart from "metering only started on <date>".',
    inputSchema: {
        days: z.number().int().positive().default(7).describe('Trailing window size in days. Default 7.'),
    },
}, async ({ days }) => {
    try {
        const earliestRow = await mcpGet(`SELECT MIN(date) AS earliest FROM api_egress_daily`);
        const earliestDate = earliestRow?.earliest ?? null;
        if (!earliestDate) {
            return ok(JSON.stringify({
                empty: true,
                explanation: 'api_egress_daily has no rows in this database. Either this is a fresh/local dev DB that has never seen traffic, or the egress meter has not flushed yet (60s interval). This is not an error.',
                window: { requestedDays: days },
                static: [],
                api: [],
            }, null, 2));
        }
        const since = dayKey(Date.now() - days * 86_400_000);
        const through = dayKey(Date.now());
        const staticRows = await mcpAll(`SELECT SUBSTR(route, ${STATIC_ROUTE_PREFIX.length + 1}) AS slug,
                SUM(requests) AS requests, SUM(bytes) AS bytes
           FROM api_egress_daily
          WHERE date >= ? AND route LIKE 'static:%'
          GROUP BY slug
          ORDER BY bytes DESC`, [since]);
        const apiRows = await mcpAll(`SELECT method, route, SUM(requests) AS requests, SUM(bytes) AS bytes
           FROM api_egress_daily
          WHERE date >= ? AND route NOT LIKE 'static:%'
          GROUP BY method, route
          ORDER BY bytes DESC`, [since]);
        const withRate = (r) => ({
            ...r,
            bytesPerRequest: r.requests ? Math.round(r.bytes / r.requests) : 0,
        });
        const out = {
            empty: false,
            window: { requestedDays: days, sinceDate: since, throughDate: through },
            earliestDateInTable: earliestDate,
            static: staticRows.map(withRate),
            api: apiRows.map(withRate),
            notes: [
                'Capacity signal, not Render billing — measured at the origin, not the CDN edge.',
                'Under-reports by up to the flush interval (60s) on every process restart.',
                'static:_host absorbs some top-level static dirs that belong to real projects (e.g. outdoor-hours\' data tree, /apps/, /session-manager-operations/) — treat _host as inflated until that attribution gap is fixed in a follow-up.',
                '`api` rows are route PATTERNS (e.g. "/api/projects/:slug/feedback"), not resolved per-project — they are not folded into the per-slug `static` numbers.',
            ],
        };
        return ok(JSON.stringify(out, null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// ── Boot ─────────────────────────────────────────────────────────────────
async function main() {
    // Ensure gate tables exist (idempotent — CREATE TABLE IF NOT EXISTS).
    try {
        await ensureGateTables();
    }
    catch (e) {
        console.error('[boot] ensureGateTables failed (non-fatal):', e.message);
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
