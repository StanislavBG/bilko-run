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
 *   - register_external_project  → adds an external-url entry (app hosted on another domain)
 *   - unregister_project         → removes an entry by slug
 *   - update_project_listing      → owner-only edit of a project's /projects card content
 *   - get_project                → returns one registry entry by slug
 *   - publish_static_project     → copies built dist/ into host's public/projects/<slug>/
 *   - status                     → host git status (uncommitted files, last 5 commits)
 *   - usage_report               → per-project egress (bytes/requests), no Clerk JWT needed
 *   - errors_report              → grouped app_errors report via bilko.run admin API (BILKO_ADMIN_KEY, read-only)
 *   - error_detail               → one app_errors row by id via admin API (read-only)
 *   - traffic_report             → visitors, bot/human split, top pages/referrers via admin API (read-only)
 *   - funnel_report              → per-UTM revenue funnel (visits → paid → booked) via admin API (read-only)
 *   - flows_report               → per-app sessions, views, clicks, events and errors via admin API (read-only)
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
import { getHostDb, mcpRun, ensureGateTables } from './db.js';
import { errorsReport, errorDetail, baseUrl, adminGet, mapEgressToUsage, trafficReport, funnelReport, flowsReport } from './errors-report.js';
import { runGates, gateSummary, gateLines } from './gates/index.js';
import { SlugSchema, ProjectStatusSchema, RegistrySchema } from './contract/registry.js';
import { projectDir, parseBypass, parseRegistry } from './publish-request.js';
import { withPublishCheckout } from './publish-checkout.js';
import { readLatestRegistryRaw } from './registry-source.js';
import { updateListingInRegistry, buildRegistration, readListingFile, assertPublishOwner } from './listing-tool.js';
import { assertCallerOwnsSlug } from './ownership.js';
const exec = promisify(execFile);
// Resolve the host repo root from this file's location.
// Layout: <HOST_ROOT>/mcp-host-server/dist/server.js  →  ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST_ROOT = resolve(__dirname, '..', '..');
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
// Read tools use origin/main, not HOST_ROOT's tree, which lags until someone pulls.
async function readLatestRegistry() {
    return parseRegistry((await readLatestRegistryRaw(HOST_ROOT)).raw);
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
        const latest = await readLatestRegistryRaw(HOST_ROOT);
        const standalone = parseRegistry(latest.raw);
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
                latest.source === 'remote'
                    ? `Source: ${latest.ref}:src/data/standalone-projects.json (fetched just now).`
                    : `Source: ${latest.ref} (local working tree; could not read origin/main: ${latest.reason}). May lag behind origin/main.`,
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
    description: 'Adds a static-path entry to the bilko.run host registry. Use this once per app, when you first deploy. The slug must be unique. After this call, the app appears in ⌘K and the admin view of /projects; it is admin-only: public listing on /projects is the Bilko owner\'s call, made in a Bilko session. The new slug is bound to callerRepoPath, and only that repo can later publish, unregister, or edit it. The registry write, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main — never against the caller\'s own working tree.',
    inputSchema: {
        slug: SlugSchema.describe('URL slug, kebab-case. Example: "outdoor-hours". Path will be /projects/<slug>/.'),
        name: z.string().min(1).describe('Display name. Example: "OutdoorHours".'),
        tagline: z.string().min(1).describe('One-sentence pitch shown on cards.'),
        category: z.string().describe('Display category. Common: "AI Tool · Productivity", "AI Tool · Content", "AI Tool · Dev", "Game", "Data".'),
        status: ProjectStatusSchema.default('live'),
        year: z.number().int().describe('Year of the build, e.g. 2026.'),
        sourceRepo: z.string().optional().describe('e.g. "github.com/StanislavBG/outdoor-hours"'),
        callerRepoPath: z.string().min(1).describe('Absolute path to the repo registering this app, e.g. "/home/bilko/Projects/Outdoor-Hours". Bound as host.localPath (home collapsed to ~).'),
        tags: z.array(z.string()).optional().describe('Up to ~3 short tags, e.g. ["Free", "WebGPU"].'),
        displayName: z.string().min(1).max(60).optional().describe('Hub-only display name shown on the public /projects hub.'),
    },
}, async ({ slug, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            const entry = buildRegistration(projects, { slug, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName });
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
        return ok([`registered: ${slug} → /projects/${slug}/ (admin-only until the Bilko owner lists it)`, pushedLine(outcome)].join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 3b) register_external_project ─────────────────────────────────────────
server.registerTool('register_external_project', {
    title: 'Register an externally hosted app',
    description: 'Adds an external-url entry to the bilko.run host registry: for an app hosted on its own domain (e.g. https://<app>.replit.app), whose /projects card links straight to that URL. No bundle is published, so never call publish_static_project for it. url must be https://. Same rules as register_static_project otherwise: unique slug, admin-only until the Bilko owner lists it, and the slug is bound to callerRepoPath, so only that repo can later unregister it or edit its card (including url, via update_project_listing). The registry write, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main.',
    inputSchema: {
        slug: SlugSchema.describe('Kebab-case slug, unique in the registry. Example: "family-frame".'),
        url: z.string().url().describe('The app\'s live https:// URL, e.g. "https://family-frame.replit.app".'),
        name: z.string().min(1).describe('Display name. Example: "Family Frame".'),
        tagline: z.string().min(1).describe('One-sentence pitch shown on cards.'),
        category: z.string().describe('Display category. Common: "AI Tool · Productivity", "AI Tool · Content", "AI Tool · Dev", "Game", "Data".'),
        status: ProjectStatusSchema.default('live'),
        year: z.number().int().describe('Year of the build, e.g. 2026.'),
        sourceRepo: z.string().optional().describe('e.g. "github.com/StanislavBG/family-frame"'),
        callerRepoPath: z.string().min(1).describe('Absolute path to the repo registering this app, e.g. "/home/bilko/Projects/family-frame". Bound as host.localPath (home collapsed to ~).'),
        tags: z.array(z.string()).optional().describe('Up to ~3 short tags, e.g. ["Free", "PWA"].'),
        displayName: z.string().min(1).max(60).optional().describe('Hub-only display name shown on the public /projects hub.'),
    },
}, async ({ slug, url, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            const entry = buildRegistration(projects, { slug, url, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName });
            projects.push(entry);
            await writeRegistry(root, projects);
            return {
                result: { slug },
                paths: ['src/data/standalone-projects.json'],
                message: `registry: add ${slug} (${name}, external)`,
            };
        });
        if (!outcome.ok)
            return checkoutErr(outcome);
        return ok([`registered: ${slug} → ${url} (admin-only until the Bilko owner lists it)`, pushedLine(outcome)].join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 4) unregister_project ─────────────────────────────────────────────────
server.registerTool('unregister_project', {
    title: 'Unregister a static-path app',
    description: 'Removes a project from the host registry by slug. Only the repo bound to the slug (callerRepoPath must match host.localPath) may remove it. Does NOT delete the public/projects/<slug>/ directory — pass deleteAssets=true to also rm -rf those bytes. Use this when retiring an app or before re-registering with different metadata. The registry write, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main.',
    inputSchema: {
        slug: SlugSchema,
        callerRepoPath: z.string().min(1).describe('Absolute path to the repo that owns this slug.'),
        deleteAssets: z.boolean().default(false).describe('Also remove public/projects/<slug>/.'),
    },
}, async ({ slug, callerRepoPath, deleteAssets }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            const existing = projects.find(p => p.slug === slug);
            if (!existing) {
                throw new Error(`slug "${slug}" not found in registry.`);
            }
            assertCallerOwnsSlug(existing, callerRepoPath);
            const next = projects.filter(p => p.slug !== slug);
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
// 4b) update_project_listing ────────────────────────────────────────────
server.registerTool('update_project_listing', {
    title: 'Update a project listing',
    description: 'Change YOUR project\'s public card content (name, displayName, tagline, category, tags, status, thumbnail, listing{detail,metric,metricLabel,lang,audience,talkingPoints,offering,pricing,callToAction,avoidClaims,icon,shareImage}). icon and shareImage must be PNG files inside your project\'s own published bundle (a path like /projects/<slug>/icon.png): icon is square and is composited onto the generated share card; shareImage is exactly 1200x630 and replaces the generated card. offering/pricing/callToAction/avoidClaims tell promoters (e.g. Burrow) what kind of project this is, what the reader should do, and claims never to make. Only the repo bound to the slug (host.localPath) may call it. Visibility (public), slug and hosting are owned by Bilko and cannot be changed here. The patch is a JSON merge patch: send only what changes. Fields you leave out keep their value, and listing merges key by key, so {listing:{audience:"..."}} keeps avoidClaims and every other listing key. null deletes: {displayName:null} removes a field, {listing:{avoidClaims:null}} removes one listing key, {listing:null} removes the whole listing. Arrays (tags, talkingPoints, avoidClaims) are replaced whole. The result names any field the patch removed. Commits and pushes; bilko.run redeploys in ~1 minute.',
    inputSchema: {
        slug: SlugSchema,
        callerRepoPath: z.string().describe('Absolute path to your sibling repo root (must match the slug\'s host.localPath). Example: "/home/bilko/Projects/Outdoor-Hours".'),
        patch: z.record(z.string(), z.unknown()).describe('JSON merge patch of the fields to change: omitted fields and omitted listing keys are kept; null deletes an optional field or one listing key; arrays replace whole; url only for external-url entries'),
    },
}, async ({ slug, callerRepoPath, patch }) => {
    try {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
            const projects = await readRegistry(root);
            const { next, changed, removed } = updateListingInRegistry(projects, slug, callerRepoPath, patch);
            const message = `listing: update ${slug}`;
            if (!changed)
                return { result: { changed: false, removed }, paths: [], message };
            await writeRegistry(root, next);
            return { result: { changed: true, removed }, paths: ['src/data/standalone-projects.json'], message };
        });
        if (!outcome.ok)
            return checkoutErr(outcome);
        if (!outcome.result.changed)
            return ok(`no change: ${slug}`);
        const { removed } = outcome.result;
        return ok([
            `updated listing: ${slug}`,
            ...(removed.length > 0 ? [`removed: ${removed.join(', ')}`] : []),
            pushedLine(outcome),
        ].join('\n'));
    }
    catch (e) {
        return err(e.message);
    }
});
// 4c) get_project ───────────────────────────────────────────────────────
server.registerTool('get_project', {
    title: 'Get a project',
    description: 'Returns the full registry entry for one slug as JSON. Read-only; use it to see your current card before calling update_project_listing.',
    inputSchema: { slug: SlugSchema },
}, async ({ slug }) => {
    try {
        const projects = await readLatestRegistry();
        const entry = projects.find(p => p.slug === slug);
        if (!entry)
            return err(`slug "${slug}" not found in registry.`);
        return ok(JSON.stringify(entry, null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// Share assets the entry will have once bilko.listing.json is merged in: the
// file's listing keys win (null removes one), the registry entry fills the rest.
function declaredShareAssets(projects, slug, sourceRepoPath) {
    const patch = sourceRepoPath ? readListingFile(resolve(sourceRepoPath.replace(/^~(?=\/|$)/, homedir()))) : undefined;
    const patched = patch && typeof patch === 'object' ? patch.listing : undefined;
    if (patched === null)
        return undefined;
    const source = {
        ...projects.find(p => p.slug === slug)?.listing,
        ...(patched && typeof patched === 'object' && !Array.isArray(patched) ? patched : {}),
    };
    return { icon: source.icon ?? undefined, shareImage: source.shareImage ?? undefined };
}
// 5) publish_static_project ─────────────────────────────────────────────
server.registerTool('publish_static_project', {
    title: 'Publish a static-path app build',
    description: 'Only the repo bound to the slug may publish it (sourceRepoPath must match host.localPath; unregistered slugs are refused). Copies a built dist/ from a sibling repo into the host\'s public/projects/<slug>/. Runs six publish gates (manifest, budget, golden, a11y, audit, share-assets) before copying; valid declared share assets are excluded from the budget sum. Any non-bypassed gate failure blocks the publish. On success the result lists each gate\'s details under the gates line (budget: gate-measured KB gz vs manifest-reported KB vs budget). Pass sourceRepoPath so the golden and audit gates can run. Pass bypass (comma-sep gate names) + bypassReason to override a specific gate — every bypass is audit-logged. The copy, registry check, commit, and push to origin all happen inside an isolated publish checkout synced to origin/main — never against the caller\'s own working tree.',
    inputSchema: {
        slug: SlugSchema,
        distPath: z.string().describe('Absolute path to the built dist/ directory in the sibling repo. Example: "/home/bilko/Projects/Outdoor-Hours/dist".'),
        sourceRepoPath: z.string().optional().describe('Absolute path to the sibling repo root (e.g. "/home/bilko/Projects/Stack-Audit"). Required for golden and audit gates.'),
        bypass: z.string().optional().describe('Comma-separated gate names to skip, e.g. "a11y" or "golden,audit". Each bypass is logged.'),
        bypassReason: z.string().optional().describe('Required justification when bypass is set. Logged to publish_overrides.'),
    },
}, async ({ slug, distPath, sourceRepoPath, bypass, bypassReason }) => {
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
        // Cheap ownership check before gates, which execute commands in sourceRepoPath.
        // The check inside withPublishCheckout remains the authoritative re-check.
        const preRegistry = await readLatestRegistry();
        assertPublishOwner(preRegistry, slug, sourceRepoPath);
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
            listing: declaredShareAssets(preRegistry, slug, sourceRepoPath),
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
            const projects = await readRegistry(root);
            const p = projects.find(x => x.slug === slug);
            if (!p)
                throw new Error(`slug "${slug}" is not registered. Call register_static_project first.`);
            if (p.host.kind !== 'static-path')
                throw new Error(`slug "${slug}" is registered but not a static-path host (${p.host.kind}).`);
            assertCallerOwnsSlug(p, sourceRepoPath);
            // Listing file is validated before any bytes are copied, so a bad file aborts cleanly.
            let listingNext;
            let listingStatus = 'listing: no bilko.listing.json';
            const listingPatch = sourceRepoPath ? readListingFile(resolve(sourceRepoPath.replace(/^~(?=\/|$)/, homedir()))) : undefined;
            if (listingPatch !== undefined) {
                let res;
                try {
                    res = updateListingInRegistry(projects, slug, sourceRepoPath, listingPatch);
                }
                catch (e) {
                    throw new Error(`bilko.listing.json: ${e.message}`);
                }
                if (res.changed) {
                    listingNext = res.next;
                    listingStatus = 'listing: synced from bilko.listing.json'
                        + (res.removed.length > 0 ? ` (removed: ${res.removed.join(', ')})` : '');
                }
                else {
                    listingStatus = 'listing: unchanged';
                }
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
            const paths = [`public/projects/${slug}`];
            if (listingNext) {
                await writeRegistry(root, listingNext);
                paths.push('src/data/standalone-projects.json');
            }
            return { result: { target, listingStatus }, paths, message: `publish: ${slug} build` };
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
            ...gateLines(results),
            `published: ${distAbs} → public/projects/${slug}`,
            outcome.result.listingStatus,
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
// Reads the bilko.run admin API (GET /api/admin/egress), not a database, so
// the numbers are always the live host's — never a local dev DB's.
server.registerTool('usage_report', {
    title: 'Per-project egress/usage report',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/egress) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). Returns per-project static-asset egress (bytes out + request count, sorted by bytes descending, with bytesPerRequest) over a trailing window (default 7 days), plus the /api/* route rows reported separately (those are route *patterns*, not resolved to a project slug). The top-level `source` field is the base URL queried. ' +
        'IMPORTANT: these are capacity-signal numbers measured at the origin server, NOT Render billing figures — Render bills at the edge/CDN layer, which can differ. They also under-report by up to the in-process flush interval (60s) on every process restart. ' +
        'static:_host and static:_other are surfaced explicitly rather than filtered out: _host currently absorbs top-level static dirs that belong to real projects but aren\'t served under /projects/<slug>/ — so _host is not purely host chrome today. _other is traffic to an unrecognised /projects/<x>/ slug. Also reports the earliest date present in the table so a caller can tell "no traffic in this window" apart from "metering only started on <date>".',
    inputSchema: {
        days: z.number().int().positive().default(7).describe('Trailing window size in days. Default 7 (host caps at 90).'),
    },
}, async ({ days }) => {
    try {
        const body = await adminGet(`/api/admin/egress?days=${days}`);
        if (!body)
            return err('bilko.run returned 404 for /api/admin/egress');
        return ok(JSON.stringify(mapEgressToUsage(body, days), null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 8) errors_report ───────────────────────────────────────────────────────
server.registerTool('errors_report', {
    title: 'Grouped app_errors report',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/observability/errors) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). Returns errors grouped by app + signature over a trailing window (default 1 day), with counts, first/last seen, versions and a sample. env defaults to prod. The top-level `source` field is the base URL queried.',
    inputSchema: {
        days: z.number().int().default(1).describe('Trailing window in days. Default 1.'),
        app: z.string().optional().describe('Restrict to one app slug.'),
        env: z.enum(['prod', 'dev', 'test', 'all']).default('prod').describe('Environment filter. Default prod.'),
        limit: z.number().int().optional().describe('Max groups to return.'),
    },
}, async ({ days, app, env, limit }) => {
    try {
        const report = await errorsReport({ days, app, env, limit });
        return ok(JSON.stringify({ source: baseUrl(), ...report }, null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 9) error_detail ────────────────────────────────────────────────────────
server.registerTool('error_detail', {
    title: 'One app_errors row',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/observability/errors/:id) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). The top-level `source` field is the base URL queried.',
    inputSchema: {
        id: z.number().int().positive().describe('app_errors row id.'),
    },
}, async ({ id }) => {
    try {
        const detail = await errorDetail(id);
        if (!detail)
            return err(`error ${id} not found`);
        return ok(JSON.stringify({ source: baseUrl(), ...detail }, null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 10) traffic_report ─────────────────────────────────────────────────────
server.registerTool('traffic_report', {
    title: 'Visitor traffic report',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/traffic) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key). Returns, for a trailing window: human vs bot visitors and hits (bots are UA-flagged), human visitors seen only once (undeclared-bot/bounce signal), bilko_vid cookie uniques, per-page and per-project hits + uniques, a per-visitor-class breakdown (`byClass`, `topPagesByClass`: human, search_crawler, ai_crawler, ai_user_agent, api_client, script), top referrers, countries, devices, and the date each metric became valid. ' +
        'Visitors are a salted IP+user-agent hash, not a cookie. Per-visitor IP/UA/email rows are omitted. The top-level `source` field is the base URL queried.',
    inputSchema: {
        days: z.number().int().positive().default(30).describe('Trailing window in days. Default 30 (host caps at 90).'),
        slug: z.string().optional().describe('Restrict to one /projects/<slug>/ app.'),
        excludeSelf: z.boolean().default(false).describe("Drop the owner's own signed-in visits."),
    },
}, async ({ days, slug, excludeSelf }) => {
    try {
        return ok(JSON.stringify(await trafficReport({ days, slug, excludeSelf }), null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 11) funnel_report ──────────────────────────────────────────────────────
server.registerTool('funnel_report', {
    title: 'Per-UTM revenue funnel',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/funnel) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key). Returns, for sessions that landed with the given utm_source since a date: visits (sessions), sign_ins, checkout_start, paid (visitors) and booked (service bookings). Admin and bot traffic are excluded. The top-level `source` field is the base URL queried.',
    inputSchema: {
        utmSource: z.string().min(1).describe('utm_source to attribute, e.g. "burrow".'),
        since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Start date YYYY-MM-DD (UTC). Host default: 7 days ago.'),
    },
}, async ({ utmSource, since }) => {
    try {
        return ok(JSON.stringify(await funnelReport({ utmSource, since }), null, 2));
    }
    catch (e) {
        return err(e.message);
    }
});
// 12) flows_report ───────────────────────────────────────────────────────
server.registerTool('flows_report', {
    title: 'Per-app flows',
    description: 'Read-only. Calls the bilko.run admin API (GET /api/admin/flows) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key). Returns per-app sessions, views, clicks, events and errors, so a sibling can see page- or lesson-level drop-off. Admin and bot traffic are handled as the host does. The top-level `source` field is the base URL queried.',
    inputSchema: {
        days: z.number().int().min(1).max(30).optional().describe('Window in days (1-30). Host default applies if omitted.'),
        app: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,59}$/i).optional().describe('Limit to one app slug, e.g. "academy".'),
    },
}, async ({ days, app }) => {
    try {
        return ok(JSON.stringify(await flowsReport({ days, app }), null, 2));
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
