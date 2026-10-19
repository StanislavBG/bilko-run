---
title: Social-card metadata resolver: per-path title/description/image from the project registry and blog posts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T21:49:56.184Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
disposition: new-head
planId: pl-mv2xgl7c-32470c
---
# Goal

primitive: add server/og-meta.ts, a pure module that decides the Open Graph / Twitter card metadata for any bilko.run path and rewrites an HTML document's head to carry it. Today every shared bilko.run link on X shows a stale "Bilko — AI Advisory for Small Business" title with a PageRoast image, because the base index.html is stale and no static-path project bundle carries OG tags. This module derives the card from the live registry (src/data/standalone-projects.json) and blog seed posts, so a new or renamed project is always current with no hand-maintained list.

# Acceptance criteria

- [ ] server/og-meta.ts exports `interface OgMeta { title: string; description: string; url: string; image: string }`, `injectOgMeta(html: string, meta: OgMeta): string`, `resolveOg(path: string, ctx: OgContext): OgMeta | null`, `interface OgContext { projects: readonly OgProject[]; blogPosts: readonly { slug: string; title: string; excerpt: string }[] }` and `loadOgProjects(file?: string): OgProject[]` (reads src/data/standalone-projects.json with fs, keeps slug/name/displayName/tagline/category).
- [ ] injectOgMeta removes any existing <title>, meta name=description, every meta property=og:* and every meta name=twitter:* tag (any attribute order, self-closing or not), then inserts one block before </head> with <title>, description, og:type=website, og:site_name=bilko.run, og:title, og:description, og:url, og:image, og:image:width=1200, og:image:height=630, twitter:card=summary_large_image, twitter:site=@BilkoBibitkov, twitter:title, twitter:description, twitter:image; all values HTML-attribute-escaped (& < > " ').
- [ ] resolveOg maps: '/' to the site default (title 'bilko.run — Small AI tools, one at a time', image https://bilko.run/og/default.png); '/projects', '/blog', '/pricing' to their own titles with the default image; '/projects/<slug>/' and '/projects/<slug>/index.html' to that registry project (title '<displayName ?? name> — bilko.run', description = tagline, url https://bilko.run/projects/<slug>/, image https://bilko.run/og/<slug>.png); '/products/session-manager' and '/products/session-manager/manual' to the session-manager registry entry with og:url equal to the requested canonical path; '/blog/<slug>' to that post (title, excerpt, default image); query strings ignored; anything else, including an unknown slug or a slug not matching ^[a-z0-9-]+$, returns null.
- [ ] No hard-coded project names or taglines in server/og-meta.ts other than the site default and the three section pages; every project card comes from the OgContext.
- [ ] tests/og-meta.test.ts covers: injection replaces stale tags exactly once each (assert the old 'AI Advisory for Small Business' title and og-bilko.png are gone); escaping of a tagline containing quotes and &; resolveOg for '/', '/projects/page-roast/', '/projects/page-roast/index.html?x=1', '/products/session-manager', '/blog/<slug>', unknown slug, and a traversal-looking path '/projects/..%2f/'; and that loadOgProjects() on the real registry returns an entry for every slug in it with a non-empty tagline.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/og-meta.ts
- tests/og-meta.test.ts

# Implementation notes

Read first: index.html lines 1-25 (the stale tags to be replaced); server/index.ts lines 218-250 (current OG_OVERRIDES — copy its /projects, /blog, /pricing titles/descriptions into resolveOg); src/data/standalone-projects.json (first two entries — fields slug, name, displayName?, tagline, category, host); server/blog-posts.ts lines 14-23 (SeedBlogPost shape).

Steps:
1. Create server/og-meta.ts. Pure functions, no Fastify import. Site constants: SITE='https://bilko.run'; DEFAULT_IMAGE=`${SITE}/og/default.png`; default title 'bilko.run — Small AI tools, one at a time'; default description 'A studio of one shipping small AI tools: trading bots that trade in public, a weather report, a live GitHub dashboard, a session scheduler and a free AI academy. Most are free or open source.'
2. loadOgProjects(file = resolve(process.cwd(), 'src/data/standalone-projects.json')): readFileSync + JSON.parse; map to OgProject {slug, name, displayName?, tagline, category}. The server runs from repo root on Render (cwd = repo root) — also try resolve(__dirname-equivalent via fileURLToPath(import.meta.url), '../../src/data/standalone-projects.json') and '../src/data/...' as fallbacks, first that exists (mirror the distCandidates pattern in server/index.ts ~line 129). Throw a clear Error if none exists.
3. resolveOg: strip ?query and #hash; decode nothing (treat raw path); match with anchored regexes. Project lookup only by exact slug equality against ctx.projects.
4. injectOgMeta: regex-remove tags case-insensitively, then insert the block right before the first </head>. If no </head>, return html unchanged.
5. tests/og-meta.test.ts with vitest (import from '../server/og-meta.js', matching the import style of tests/static-cache.test.ts).

Do not touch: server/index.ts, server/security-headers.ts, index.html (sibling PRDs own them).

# Out of scope

- Rendering PNG images (sibling PRD og-image-renderer)
- Wiring into Fastify routes/hooks (PRD og-wire-routes)
- Editing index.html or deleting old PNGs

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/og-meta.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
