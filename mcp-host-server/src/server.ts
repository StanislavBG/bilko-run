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
 *   - set_listing_media          → owner-only upload of card media (video, shareImage, icon), hosted by bilko.run
 *   - set_app_backend            → owner-only set/clear of host.backend (origin /projects/<slug>/api/* forwards to)
 *   - app_team                   → owner-only list/set/remove of an app's Bilko-DB team via /api/db/<slug>/team
 *   - get_project                → returns one registry entry by slug
 *   - publish_static_project     → copies built dist/ into host's public/projects/<slug>/
 *   - status                     → host git status (uncommitted files, last 5 commits)
 *   - usage_report               → per-project egress (bytes/requests), no Clerk JWT needed
 *   - errors_report              → grouped app_errors report via bilko.run admin API (BILKO_ADMIN_KEY, read-only)
 *   - error_detail               → one app_errors row by id via admin API (read-only)
 *   - traffic_report             → visitors, bot/human split, top pages/referrers via admin API (read-only)
 *   - funnel_report              → per-UTM revenue funnel (visits → paid → booked) via admin API (read-only)
 *   - flows_report               → per-app sessions, views, clicks, events and errors via admin API (read-only)
 *   - sessions_report            → per-session landing, source, owner/bot flags and timelines via admin API (read-only, no emails)
 *   - git_viewer_report          → hosted Git Viewer portfolio totals, git_viewer subscriptions and rows via admin API (read-only, no emails)
 *
 * The four visitor reports (traffic, funnel, flows, sessions) live in report-tools.ts and count real visitors by
 * default: the owner and automation are excluded unless the caller opts in.
 * git_viewer_report lives in git-viewer-report.ts; its totals leave out the showcase logins.
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
import { rm, mkdir, stat, cp, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { ManifestSchema } from './manifest-schema.js';
import { getHostDb, mcpRun, ensureGateTables } from './db.js';
import { errorsReport, errorDetail, baseUrl, adminGet, mapEgressToUsage } from './errors-report.js';
import { registerReportTools } from './report-tools.js';
import { registerGitViewerReportTool } from './git-viewer-report.js';
import { ok, err } from './tool-result.js';
import { runGates, gateSummary, gateLines, type GateContext } from './gates/index.js';
import { SlugSchema, ProjectStatusSchema, type RegistryProject } from './contract/registry.js';
import { projectDir, parseBypass, parseRegistry } from './publish-request.js';
import { withPublishCheckout, type PublishOutcome, type LocalMainSync } from './publish-checkout.js';
import { readLatestRegistryRaw } from './registry-source.js';
import { buildRegistration, readListingFile, assertPublishOwner, planPublishListing, registerProjectLive, updateListingLive, unregisterProjectLive } from './listing-tool.js';
import { setListingMedia } from './listing-media-tool.js';
import { setAppBackend } from './app-backend-tool.js';
import { appTeam } from './app-team-tool.js';
import { readHostContract } from './host-contract.js';

export { readHostContract };

const exec = promisify(execFile);

// Resolve the host repo root from this file's location.
// Layout: <HOST_ROOT>/mcp-host-server/dist/server.js  →  ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST_ROOT = resolve(__dirname, '..', '..');
const HOST_CONTRACT = resolve(HOST_ROOT, 'docs/host-contract.md');
const PUBLIC_PROJECTS = resolve(HOST_ROOT, 'public/projects');

// Mirrors publish-checkout.ts's own default — that file isn't exported here
// because status just inspects the checkout, it doesn't drive it.
const PUBLISH_CHECKOUT_DIR =
  process.env.BILKO_PUBLISH_CHECKOUT || resolve(homedir(), '.local/state/bilko-host/publish-checkout');

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

// ── Helpers ──────────────────────────────────────────────────────────────
// Read tools get the registry from the Bilko-DB registry API (live), not from a file.
async function readLatestRegistry(): Promise<RegistryProject[]> {
  return parseRegistry((await readLatestRegistryRaw(HOST_ROOT)).raw);
}

async function gitInHost(...args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd: HOST_ROOT });
  return stdout.trim();
}

function checkoutErr<T>(outcome: PublishOutcome<T> & { ok: false }) {
  return err(`publish checkout failed at stage "${outcome.stage}": ${outcome.error}`);
}
function pushedLine<T>(outcome: PublishOutcome<T> & { ok: true }): string {
  if (!outcome.committed) return 'no changes to commit';
  const pushed = `pushed: ${outcome.sha}`;
  return outcome.localMain ? `${pushed}\n${localMainLine(outcome.localMain)}` : pushed;
}
// One line: did the best-effort catch-up after the push bring the host checkout's local main along?
function localMainLine(sync: LocalMainSync): string {
  const detail = sync.detail ? ` — ${sync.detail}` : '';
  if (sync.synced) return `local main: synced${detail}`;
  const exit = sync.exitCode === null ? 'no exit code' : `exit ${sync.exitCode}`;
  return `local main: not synced (${exit})${detail}`;
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
      'Returns the Bilko map (docs/map.md) followed by the bilko.run host contract (host-contract.md). Read this first when working on a sibling-repo app — it explains the three host kinds, what the host provides (auth, credits, kit, brand), what an app must implement, URL canonicalization, and the add/remove checklists.',
    inputSchema: {},
  },
  async () => {
    try {
      return ok(readHostContract(HOST_ROOT));
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
          `react-route apps live in src/data/projectsRegistry.ts and aren't returned here.`,
          `Source: bilko.run ${latest.ref} (Bilko-DB registry API).`,
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
      'Adds a static-path entry to the bilko.run host registry. Use this once per app, when you first deploy. The slug must be unique. After this call, the app appears in ⌘K and the admin view of /projects; it is admin-only: public listing on /projects is the Bilko owner\'s call, made in a Bilko session. The new slug is bound to callerRepoPath, and only that repo can later publish, unregister, or edit it. The registry write goes through the Bilko-DB registry API, so the change is live on bilko.run immediately, with no deploy wait.',
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
  },
  async ({ slug, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName }) => {
    try {
      await registerProjectLive({ slug, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName });
      return ok(`registered: ${slug} → /projects/${slug}/ (admin-only until the Bilko owner lists it)\nlive on bilko.run now; no deploy wait`);
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 3b) register_external_project ─────────────────────────────────────────
server.registerTool(
  'register_external_project',
  {
    title: 'Register an externally hosted app',
    description:
      'Adds an external-url entry to the bilko.run host registry: for an app hosted on its own domain (e.g. https://<app>.replit.app), whose /projects card links straight to that URL. No bundle is published, so never call publish_static_project for it. url must be https://. Same rules as register_static_project otherwise: unique slug, admin-only until the Bilko owner lists it, and the slug is bound to callerRepoPath, so only that repo can later unregister it or edit its card (including url, via update_project_listing). The registry write goes through the Bilko-DB registry API, so the change is live on bilko.run immediately, with no deploy wait.',
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
  },
  async ({ slug, url, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName }) => {
    try {
      await registerProjectLive({ slug, url, name, tagline, category, status, year, sourceRepo, callerRepoPath, tags, displayName });
      return ok(`registered: ${slug} → ${url} (admin-only until the Bilko owner lists it)\nlive on bilko.run now; no deploy wait`);
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
      'Removes a project from the host registry by slug. Only the repo bound to the slug (callerRepoPath must match host.localPath) may remove it. Does NOT delete the public/projects/<slug>/ directory — pass deleteAssets=true to also rm -rf those bytes. Use this when retiring an app or before re-registering with different metadata. The registry removal goes through the Bilko-DB registry API and is live on bilko.run immediately, with no deploy wait; only deleteAssets=true commits and pushes (the bundle directory removal).',
    inputSchema: {
      slug: SlugSchema,
      callerRepoPath: z.string().min(1).describe('Absolute path to the repo that owns this slug.'),
      deleteAssets: z.boolean().default(false).describe('Also remove public/projects/<slug>/.'),
    },
  },
  async ({ slug, callerRepoPath, deleteAssets }) => {
    try {
      await unregisterProjectLive(slug, callerRepoPath);
      const lines = [`unregistered: ${slug}`, 'live on bilko.run now; no deploy wait'];
      if (deleteAssets) {
        const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
          const dir = projectDir(resolve(root, 'public/projects'), slug);
          if (!existsSync(dir)) return { result: { removed: [] as string[] }, paths: [], message: `assets: remove ${slug}` };
          await rm(dir, { recursive: true, force: true });
          return { result: { removed: [dir] }, paths: [`public/projects/${slug}`], message: `assets: remove ${slug}` };
        });
        if (!outcome.ok) return checkoutErr(outcome);
        for (const dir of outcome.result.removed) lines.push(`removed: ${dir}`);
        lines.push(pushedLine(outcome));
      }
      return ok(lines.join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4b) update_project_listing ────────────────────────────────────────────
server.registerTool(
  'update_project_listing',
  {
    title: 'Update a project listing',
    description:
      'Change YOUR project\'s public card content (name, displayName, tagline, category, tags, status, thumbnail, listing{detail,metric,metricLabel,lang,audience,talkingPoints,offering,pricing,callToAction,avoidClaims,icon,shareImage,video}). icon, shareImage and video each take either a path inside your project\'s own published bundle (like /projects/<slug>/icon.png) or a hosted path returned by set_listing_media (/projects/<slug>/_media/<sha256>.<ext>); this tool never uploads files, so to upload card media from a local file (any host kind, external-url included) use set_listing_media. icon is a square PNG composited onto the generated share card; shareImage is a PNG exactly 1200x630 that replaces the generated card. video is an .mp4 or .webm file that plays muted and looping on the active /projects card, with the share image as its poster; X/LinkedIn link previews keep the PNG. offering/pricing/callToAction/avoidClaims tell promoters (e.g. Burrow) what kind of project this is, what the reader should do, and claims never to make. Only the repo bound to the slug (host.localPath) may call it. Visibility (public), slug and hosting are owned by Bilko and cannot be changed here. The patch is a JSON merge patch: send only what changes. Fields you leave out keep their value, and listing merges key by key, so {listing:{audience:"..."}} keeps avoidClaims and every other listing key. null deletes: {displayName:null} removes a field, {listing:{avoidClaims:null}} removes one listing key, {listing:null} removes the whole listing. Arrays (tags, talkingPoints, avoidClaims) are replaced whole. The result names any field the patch removed. The change goes through the Bilko-DB registry API and is live on bilko.run immediately, with no deploy wait.',
    inputSchema: {
      slug: SlugSchema,
      callerRepoPath: z.string().describe('Absolute path to your sibling repo root (must match the slug\'s host.localPath). Example: "/home/bilko/Projects/Outdoor-Hours".'),
      patch: z.record(z.string(), z.unknown()).describe('JSON merge patch of the fields to change: omitted fields and omitted listing keys are kept; null deletes an optional field or one listing key; arrays replace whole; url only for external-url entries'),
    },
  },
  async ({ slug, callerRepoPath, patch }) => {
    try {
      const { changed, removed } = await updateListingLive(slug, callerRepoPath, patch);
      if (!changed) return ok(`no change: ${slug}`);
      return ok([
        `updated listing: ${slug}`,
        ...(removed.length > 0 ? [`removed: ${removed.join(', ')}`] : []),
        'live on bilko.run now; no deploy wait',
      ].join('\n'));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4b2) set_listing_media ───────────────────────────────────────────────
const MediaFileSchema = z.string().min(1).nullable().optional();
server.registerTool(
  'set_listing_media',
  {
    title: 'Set listing card media',
    description:
      'Upload YOUR project\'s /projects card media from local files: video, shareImage and icon. Works for static-path and external-url slugs alike; this is the one way to give an external-url card media. Only the repo bound to the slug (host.localPath) may call it. Each value is an absolute path to a local file, or null to remove that field from the listing; fields you leave out are kept. File limits: icon is a square PNG 128-1024 px, up to 512 KB; shareImage is a PNG exactly 1200x630, up to 5 MB; video is an MP4 or WebM, up to 8 MB. The bytes are hosted by bilko.run (served at /projects/<slug>/_media/<sha256>.<ext>), not committed to any repo; only the hosted path is written into the registry, through the Bilko-DB registry API, and the card shows it on bilko.run at once, with no commit and no deploy wait.',
    inputSchema: {
      slug: SlugSchema,
      callerRepoPath: z.string().describe('Absolute path to your sibling repo root (must match the slug\'s host.localPath). Example: "/home/bilko/Projects/Outdoor-Hours".'),
      media: z.object({
        video: MediaFileSchema.describe('Absolute path to an .mp4 or .webm file (up to 8 MB), or null to remove the card video.'),
        shareImage: MediaFileSchema.describe('Absolute path to a 1200x630 PNG (up to 5 MB), or null to remove the share image.'),
        icon: MediaFileSchema.describe('Absolute path to a square PNG 128-1024 px (up to 512 KB), or null to remove the icon.'),
      }).describe('At least one of video, shareImage, icon. A file path sets the field; null removes it; omitted fields are kept.'),
    },
  },
  async ({ slug, callerRepoPath, media }) => {
    try {
      const result = await setListingMedia({ slug, callerRepoPath, media }, { hostRoot: HOST_ROOT, baseUrl: baseUrl() });
      return result.ok ? ok(result.text) : err(result.text);
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4b3) set_app_backend ─────────────────────────────────────────────────
server.registerTool(
  'set_app_backend',
  {
    title: 'Set the app backend origin',
    description:
      'Sets or clears the origin bilko.run forwards /projects/<slug>/api/* to (host.backend in the registry). Static-path slugs only. origin is a bare https origin with no path, query, hash or credentials, e.g. "https://api.example.com"; null clears it. Only the repo bound to the slug (callerRepoPath must match host.localPath) may call it, because the forwarder passes users\' Authorization headers to that origin. Writes host.backend through the Bilko-DB registry API; the forwarder rebuilds its map on every registry change, so it takes effect on bilko.run at once (GET /api/health shows appBackends.<slug> = "registry"). An APP_BACKENDS entry on Render, if any, overrides it for that slug.',
    inputSchema: {
      slug: SlugSchema,
      callerRepoPath: z.string().describe('Absolute path to your sibling repo root (must match the slug\'s host.localPath). Example: "/home/bilko/Projects/Outdoor-Hours".'),
      origin: z.string().min(1).nullable().describe('Bare https origin to forward /projects/<slug>/api/* to, e.g. "https://api.example.com"; null clears the backend.'),
    },
  },
  async ({ slug, callerRepoPath, origin }) => {
    try {
      const result = await setAppBackend({ slug, callerRepoPath, origin }, { hostRoot: HOST_ROOT, baseUrl: baseUrl() });
      return result.ok ? ok(result.text) : err(result.text);
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4b4) app_team ────────────────────────────────────────────────────────
server.registerTool(
  'app_team',
  {
    title: 'Manage an app team',
    description:
      'Lists, adds/updates or removes members of an app\'s Bilko-DB team. action "list" calls GET /api/db/<slug>/team; "set" calls PUT /api/db/<slug>/team/members/<email> with JSON { role: "owner" | "member" }; "remove" calls DELETE /api/db/<slug>/team/members/<email>. Only the repo bound to the slug (callerRepoPath must match host.localPath) may call it. Authenticates with the registry-scope admin key from BILKO_REGISTRY_KEY, else the file at BILKO_REGISTRY_KEY_FILE, else ~/.config/bilko-host/registry-key (the owner mints it); BILKO_HOST_URL overrides https://bilko.run. Failures report the HTTP status and the API error code (not_member, last_owner, team_full, bad_email, bad_role, not_found).',
    inputSchema: {
      slug: SlugSchema,
      callerRepoPath: z.string().describe('Absolute path to your sibling repo root (must match the slug\'s host.localPath).'),
      action: z.enum(['list', 'set', 'remove']).describe('"list" the team, "set" a member\'s role (adds them if new), or "remove" a member.'),
      email: z.string().min(3).optional().describe('Member email; required for "set" and "remove".'),
      role: z.enum(['owner', 'member']).optional().describe('Member role; required for "set".'),
    },
  },
  async ({ slug, callerRepoPath, action, email, role }) => {
    try {
      const result = await appTeam({ slug, callerRepoPath, action, email, role }, { hostRoot: HOST_ROOT });
      return result.ok ? ok(result.text) : err(result.text);
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 4c) get_project ───────────────────────────────────────────────────────
server.registerTool(
  'get_project',
  {
    title: 'Get a project',
    description: 'Returns the full registry entry for one slug as JSON. Read-only; use it to see your current card before calling update_project_listing.',
    inputSchema: { slug: SlugSchema },
  },
  async ({ slug }) => {
    try {
      const projects = await readLatestRegistry();
      const entry = projects.find(p => p.slug === slug);
      if (!entry) return err(`slug "${slug}" not found in registry.`);
      return ok(JSON.stringify(entry, null, 2));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// Share assets the entry will have once bilko.listing.json is merged in: the
// file's listing keys win (null removes one), the registry entry fills the rest.
function declaredShareAssets(
  projects: RegistryProject[],
  slug: string,
  sourceRepoPath: string | undefined,
): { icon?: string; shareImage?: string; video?: string } | undefined {
  const patch = sourceRepoPath ? readListingFile(resolve(sourceRepoPath.replace(/^~(?=\/|$)/, homedir()))) : undefined;
  const patched = patch && typeof patch === 'object' ? (patch as { listing?: unknown }).listing : undefined;
  if (patched === null) return undefined;
  const source: { icon?: string | null; shareImage?: string | null; video?: string | null } = {
    ...projects.find(p => p.slug === slug)?.listing,
    ...(patched && typeof patched === 'object' && !Array.isArray(patched) ? patched : {}),
  };
  return { icon: source.icon ?? undefined, shareImage: source.shareImage ?? undefined, video: source.video ?? undefined };
}

// 5) publish_static_project ─────────────────────────────────────────────
server.registerTool(
  'publish_static_project',
  {
    title: 'Publish a static-path app build',
    description:
      'Only the repo bound to the slug may publish it (sourceRepoPath must match host.localPath; unregistered slugs are refused). Copies a built dist/ from a sibling repo into the host\'s public/projects/<slug>/. Runs six publish gates (manifest, budget, golden, a11y, audit, share-assets) before copying; the budget gate has no size budget: it reports the measured gzipped size and fails only when one file is over GitHub\'s 100 MiB per-file limit. Any non-bypassed gate failure blocks the publish. On success the result lists each gate\'s details under the gates line (budget: gate-measured KB gz, manifest-reported KB and the largest file). Pass sourceRepoPath so the golden and audit gates can run. Pass bypass (comma-sep gate names) + bypassReason to override a specific gate — every bypass is audit-logged. The registration, kind and ownership checks read the live Bilko-DB registry API; the copy, commit, and push of the bytes to origin happen inside an isolated publish checkout synced to origin/main — never against the caller\'s own working tree. A changed bilko.listing.json is written live through the registry API after the bytes are pushed. Card media (video, shareImage, icon) can also be uploaded without a publish via set_listing_media, which bilko.run hosts outside the bundle.',
    inputSchema: {
      slug: SlugSchema,
      distPath: z.string().describe('Absolute path to the built dist/ directory in the sibling repo. Example: "/home/bilko/Projects/Outdoor-Hours/dist".'),
      sourceRepoPath: z.string().optional().describe('Absolute path to the sibling repo root (e.g. "/home/bilko/Projects/Stack-Audit"). Required for golden and audit gates.'),
      bypass: z.string().optional().describe('Comma-separated gate names to skip, e.g. "a11y" or "golden,audit". Each bypass is logged.'),
      bypassReason: z.string().optional().describe('Required justification when bypass is set. Logged to publish_overrides.'),
    },
  },
  async ({ slug, distPath, sourceRepoPath, bypass, bypassReason }) => {
    try {
      // Sanity: dist exists and looks like a build.
      const distAbs = resolve(distPath);
      if (!existsSync(distAbs)) return err(`distPath does not exist: ${distAbs}`);
      const stats = await stat(distAbs);
      if (!stats.isDirectory()) return err(`distPath is not a directory: ${distAbs}`);
      if (!existsSync(resolve(distAbs, 'index.html'))) {
        return err(`distPath has no index.html — not a Vite build? (${distAbs})`);
      }

      // Cheap ownership check before gates, which execute commands in sourceRepoPath.
      // planPublishListing re-checks ownership against the registry it reads before writing.
      const preRegistry = await readLatestRegistry();
      assertPublishOwner(preRegistry, slug, sourceRepoPath);

      // Run publish gates against distPath, outside the publish checkout/lock.
      const bypassResult = parseBypass(bypass, bypassReason);
      if ('error' in bypassResult) {
        return err(bypassResult.error);
      }
      const ctx: GateContext = {
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

      // Gates passed. Registration, kind and ownership come from the live registry API, not a file
      // in the checkout; the listing file is validated before any bytes are copied.
      const liveProjects = await readLatestRegistry();
      const listingPatch = sourceRepoPath ? readListingFile(resolve(sourceRepoPath.replace(/^~(?=\/|$)/, homedir()))) : undefined;
      const plan = planPublishListing(liveProjects, slug, sourceRepoPath, listingPatch);

      // Copy + swap + commit + push the bytes, all inside the publish checkout.
      const outcome = await withPublishCheckout({ hostRoot: HOST_ROOT }, async (root) => {
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

      if (!outcome.ok) return checkoutErr(outcome);

      // The bytes are pushed; now the listing, live through the registry API.
      let listingStatus = 'listing: no bilko.listing.json';
      if (plan.hasFile) {
        listingStatus = 'listing: unchanged';
        if (plan.changed) {
          try {
            const written = await updateListingLive(slug, sourceRepoPath, listingPatch);
            if (written.changed) {
              listingStatus = 'listing: synced from bilko.listing.json (live)'
                + (written.removed.length > 0 ? ` (removed: ${written.removed.join(', ')})` : '');
            }
          } catch (e: unknown) {
            return err(`bytes are published (public/projects/${slug}), but the listing write failed: ${(e as Error).message}`);
          }
        }
      }

      // Write manifest row to host DB (best-effort — don't fail the publish if DB is down).
      if (ctx.manifest) {
        try {
          await upsertManifest(ctx.manifest);
        } catch (dbErr: unknown) {
          console.error('[manifest-upsert] DB write failed (non-fatal):', (dbErr as Error).message);
        }
      }

      const lines = [
        ...gateLines(results),
        `published: ${distAbs} → public/projects/${slug}`,
        listingStatus,
        pushedLine(outcome),
      ];
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
      'Returns the host repo\'s current git status (uncommitted files), the last 5 commits, and the current branch — plus the publish checkout\'s own HEAD sha and whether it matches origin/main. Use to verify a publish landed cleanly.',
    inputSchema: {},
  },
  async () => {
    try {
      const branch = await gitInHost('rev-parse', '--abbrev-ref', 'HEAD');
      const status = await gitInHost('status', '--short');
      const log = await gitInHost('log', '--oneline', '-5');

      let checkoutLines: string[];
      if (!existsSync(PUBLISH_CHECKOUT_DIR)) {
        checkoutLines = ['publish checkout: not yet created (no publish has run from this host yet)'];
      } else {
        try {
          const { stdout: headOut } = await exec('git', ['rev-parse', 'HEAD'], { cwd: PUBLISH_CHECKOUT_DIR });
          const { stdout: originOut } = await exec('git', ['rev-parse', 'origin/main'], { cwd: PUBLISH_CHECKOUT_DIR });
          const head = headOut.trim();
          const origin = originOut.trim();
          checkoutLines = [
            `publish checkout HEAD: ${head}`,
            `publish checkout == origin/main: ${head === origin}`,
          ];
        } catch (e: unknown) {
          checkoutLines = [`publish checkout: failed to read git state: ${(e as Error).message}`];
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
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 7) usage_report ────────────────────────────────────────────────────────
//
// Reads the bilko.run admin API (GET /api/admin/egress), not a database, so
// the numbers are always the live host's — never a local dev DB's.
server.registerTool(
  'usage_report',
  {
    title: 'Per-project egress/usage report',
    description:
      'Read-only. Calls the bilko.run admin API (GET /api/admin/egress) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). Returns per-project static-asset egress (bytes out + request count, sorted by bytes descending, with bytesPerRequest) over a trailing window (default 7 days), plus the /api/* route rows reported separately (those are route *patterns*, not resolved to a project slug). The top-level `source` field is the base URL queried. ' +
      'IMPORTANT: these are capacity-signal numbers measured at the origin server, NOT Render billing figures — Render bills at the edge/CDN layer, which can differ. They also under-report by up to the in-process flush interval (60s) on every process restart. ' +
      'static:_host and static:_other are surfaced explicitly rather than filtered out: _host currently absorbs top-level static dirs that belong to real projects but aren\'t served under /projects/<slug>/ — so _host is not purely host chrome today. _other is traffic to an unrecognised /projects/<x>/ slug. Also reports the earliest date present in the table so a caller can tell "no traffic in this window" apart from "metering only started on <date>".',
    inputSchema: {
      days: z.number().int().positive().default(7).describe('Trailing window size in days. Default 7 (host caps at 90).'),
    },
  },
  async ({ days }) => {
    try {
      const body = await adminGet(`/api/admin/egress?days=${days}`);
      if (!body) return err('bilko.run returned 404 for /api/admin/egress');
      return ok(JSON.stringify(mapEgressToUsage(body, days), null, 2));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 8) errors_report ───────────────────────────────────────────────────────
server.registerTool(
  'errors_report',
  {
    title: 'Grouped app_errors report',
    description:
      'Read-only. Calls the bilko.run admin API (GET /api/admin/observability/errors) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). Returns errors grouped by app + signature over a trailing window (default 1 day), with counts, first/last seen, versions and a sample. env defaults to prod. The top-level `source` field is the base URL queried.',
    inputSchema: {
      days: z.number().int().default(1).describe('Trailing window in days. Default 1.'),
      app: z.string().optional().describe('Restrict to one app slug.'),
      env: z.enum(['prod', 'dev', 'test', 'all']).default('prod').describe('Environment filter. Default prod.'),
      limit: z.number().int().optional().describe('Max groups to return.'),
    },
  },
  async ({ days, app, env, limit }) => {
    try {
      const report = await errorsReport({ days, app, env, limit });
      return ok(JSON.stringify({ source: baseUrl(), ...report }, null, 2));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 9) error_detail ────────────────────────────────────────────────────────
server.registerTool(
  'error_detail',
  {
    title: 'One app_errors row',
    description:
      'Read-only. Calls the bilko.run admin API (GET /api/admin/observability/errors/:id) with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key; a read-only personal key from /admin/secrets). The top-level `source` field is the base URL queried.',
    inputSchema: {
      id: z.number().int().positive().describe('app_errors row id.'),
    },
  },
  async ({ id }) => {
    try {
      const detail = await errorDetail(id);
      if (!detail) return err(`error ${id} not found`);
      return ok(JSON.stringify({ source: baseUrl(), ...detail }, null, 2));
    } catch (e: unknown) {
      return err((e as Error).message);
    }
  },
);

// 10)-13) traffic_report, funnel_report, flows_report, sessions_report ────────
registerReportTools(server);

// 14) git_viewer_report ─────────────────────────────────────────────────
registerGitViewerReportTool(server);

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
