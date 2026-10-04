---
title: Readability checker: fail marketing language and project links that don't match a real tile
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T21:09:42.355Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
dependsOn: [blog-distribution-objective-policy]
planId: pl-musvxkkz-0193ba
---
# Goal

behavior: enforce in code the owner's rule that blog posts (which will also be cross-posted to LinkedIn) use no marketing language and only real URLs, so the project landing page does the converting. Extend scripts/blog-readability.ts so a draft fails on any phrase in blog.config.yaml `distribution.marketing_blocklist`, and on any bilko.run project link whose slug or host kind doesn't match src/data/standalone-projects.json.

# Acceptance criteria

- [ ] `scripts/blog-readability.ts` result gains `marketingHits: string[]` (case-insensitive whole-phrase matches on prose from `stripNonProse`, using `distribution.marketing_blocklist` loaded from blog.config.yaml, falling back to an in-file DEFAULT list identical to the config's) and `pass` is false when non-empty.
- [ ] `findLinkIssues` (or a new exported `findProjectLinkIssues(markdown, registry)`) adds issue kind `'unknown-project-link'` for any `https://bilko.run/projects/<slug>/` or `https://bilko.run/products/<slug>` link whose slug is not in the registry, or whose path form doesn't match that entry's `host.kind` (static-path needs /projects/<slug>/ with trailing slash; react-route needs /products/<slug>); registry read from src/data/standalone-projects.json.
- [ ] The CLI prints marketing hits and unknown project links in its report like existing issue kinds.
- [ ] `tests/blog-readability.test.ts` covers: a blocklisted phrase fails; a clean draft passes; an unregistered slug fails; a static-path link missing the trailing slash fails; a registered static-path link passes.
- [ ] Every currently seeded live post still passes: run the checker over the existing posts the same way `tests/blog-plain-language.test.ts` does; if any seeded post now fails, list it in the commit message and the run report rather than editing post content.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts

# Implementation notes

Read first: scripts/blog-readability.ts (whole file, 266 lines: DEFAULT_THRESHOLDS ~line 40, stripNonProse ~68, findLinkIssues ~126, analyzeReadability ~157, loadThresholdsFromConfig ~207, main ~243), tests/blog-readability.test.ts (style), tests/blog-plain-language.test.ts (how seeded posts are checked), src/data/standalone-projects.json (entry shape: slug, host.kind).

Steps: 1. Add marketing blocklist to thresholds + analysis. 2. Add project-link validation with the registry passed in (keep the function pure; the CLI/loader reads the JSON). 3. Wire both into `pass` and the CLI report. 4. Tests. Gate last.

Do not touch: .claude/skills/ (sibling PRD owns config/docs), server/, scripts/blog-cadence-*.

# Out of scope

- Live HTTP checking of links (a sibling PRD does that)
- Editing existing post content

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-readability.test.ts tests/blog-plain-language.test.ts tests/blog-rewrites.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
