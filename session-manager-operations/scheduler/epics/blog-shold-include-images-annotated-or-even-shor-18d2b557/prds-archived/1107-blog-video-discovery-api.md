---
title: Blog API exposes video_url for posts that have a published video
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:31:54.125Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
planId: pl-mv1hdjm5-02147b
---
# Goal

Behavior: blog videos are self-contained HTML files at public/blog-videos/<slug>/index.html (served statically at /blog-videos/<slug>/). The server must discover which posts have one and add a `video_url` field to the public blog API so the frontend can show a player. Missing video paths must 404 instead of falling through to the SPA shell.

# Acceptance criteria

- [ ] New server/blog-videos.ts exports `scanBlogVideos(root: string): Set<string>` returning slugs of subdirectories of root that match /^[a-z0-9-]+$/ AND contain an index.html file; returns an empty set when root does not exist (never throws).
- [ ] server/blog-videos.ts exports `blogVideoUrl(slug: string, slugs: Set<string>): string | null` returning `/blog-videos/<slug>/` when present, else null.
- [ ] server/routes/blog.ts: `GET /api/blog` items and `GET /api/blog/:slug` include `video_url` (string or null); `registerBlogRoutes(app, opts?: { videosRoot?: string })` keeps working when called with no opts (default root resolution below).
- [ ] server/index.ts: the blog-videos root is `<distPath>/blog-videos` in production and `public/blog-videos` in dev, resolved BEFORE registerBlogRoutes is called; the not-found handler returns a plain 404 (not the SPA index.html) for any path starting with `/blog-videos/`.
- [ ] tests/blog-videos.test.ts covers: valid slug dir with index.html found; dir without index.html ignored; dir named with uppercase/dots ignored; missing root returns empty set; blogVideoUrl null/non-null cases.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-videos.ts
- server/routes/blog.ts
- server/index.ts
- tests/blog-videos.test.ts

# Implementation notes

Read first: server/routes/blog.ts (all, 68 lines); server/index.ts lines 110-125 (route registration) and 155-270 (distPath candidates at ~line 160-167, static plugin, setNotFoundHandler at ~259); tests/blog-cadence-gate.test.ts (test style).

Steps:
1. Write tests/blog-videos.test.ts first (red), using fs.mkdtempSync under os.tmpdir() to build fixture dirs.
2. Create server/blog-videos.ts with scanBlogVideos (readdirSync withFileTypes + existsSync(join(dir,'index.html')); wrap in try/catch → empty Set) and blogVideoUrl.
3. server/index.ts: `registerBlogRoutes(app)` runs at ~line 120 for every environment, but `distPath` is only computed inside the `if (isProd)` block (~160-167). Hoist the distPath candidate computation (or a small helper computing the same candidates) above line 120 so you can pass `{ videosRoot: isProd ? join(distPath,'blog-videos') : join(process.cwd(),'public','blog-videos') }`. Do not change the static plugin's behavior.
4. server/routes/blog.ts: compute the slug set once at registration (scan at boot — videos only change on deploy). Map rows to add `video_url: blogVideoUrl(row.slug, slugs)`. Default videosRoot when opts omitted: join(process.cwd(),'public','blog-videos').
5. In setNotFoundHandler, add before the SPA fallback: if path starts with '/blog-videos/' → `return reply.status(404).type('text/plain').send('Not found')`.
Keep SQL unchanged (parameterized). Egress metering will count /blog-videos/ under `_host` (server/egress.ts:166) — acceptable, do not change egress.

Do not touch: server/security-headers.ts, src/, scripts/ (sibling PRDs own them).

# Out of scope

- Uploading videos through an admin API
- DB schema changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-videos.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
