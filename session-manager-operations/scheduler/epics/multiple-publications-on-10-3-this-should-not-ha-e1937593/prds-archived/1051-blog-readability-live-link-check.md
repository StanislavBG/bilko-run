---
title: Readability checker: --check-live verifies every link in a draft actually loads before seeding
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T21:09:56.100Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
dependsOn: [blog-readability-marketing-and-real-links]
planId: pl-musvxkkz-0193ba
---
# Goal

behavior: "urls need be real" — the owner relies on each post's link to the project landing page to convert readers (on bilko.run and, later, on LinkedIn). Add a `--check-live` mode to scripts/blog-readability.ts that requests every absolute https link in a draft and fails the draft if any does not load, and make the seed step run it before committing.

# Acceptance criteria

- [ ] `scripts/blog-readability.ts` exports `checkLiveLinks(urls: string[], fetchImpl = fetch): Promise<{url: string; status: number | 'error'}[]>` returning only failures: each URL is fetched with method GET, redirect follow, a 15s AbortController timeout, at most 20 unique URLs (extra ones are reported as a failure 'too many links'), and status outside 200-399 or a thrown error counts as a failure.
- [ ] CLI: `npx tsx scripts/blog-readability.ts <draft.md> --check-live` runs the normal checks plus checkLiveLinks over all absolute https links in the draft and exits 1 if any fail, printing each failing URL and status; without the flag behaviour is unchanged (no network).
- [ ] `tests/blog-readability.test.ts` tests checkLiveLinks with an injected fake fetch: 200 passes, 404 fails, thrown error fails, timeout fails, duplicate URLs fetched once, >20 URLs reported. No real network in tests.
- [ ] `.claude/skills/blog-from-git/seed.md` bash block runs `npx tsx scripts/blog-readability.ts <draft.md> --check-live` before `git commit`, with a line saying a failing link means stop (no commit, no push) because the landing-page link is how the post converts.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts
- .claude/skills/blog-from-git/seed.md

# Implementation notes

Read first: scripts/blog-readability.ts (main() and findLinkIssues / MARKDOWN_LINK_RE — reuse it to collect link targets; this file was just extended by PRD blog-readability-marketing-and-real-links, read the landed code first), tests/blog-readability.test.ts, .claude/skills/blog-from-git/seed.md lines 1-45.

Steps: 1. Implement checkLiveLinks (sequential or small concurrency 4; bounded as in AC). 2. Parse `--check-live` in main(); make main async-safe (await, then process.exit with code). 3. Tests with fake fetch. 4. seed.md line. Gate last.

Do not touch: blog.config.yaml, voice.md, SKILL.md, scripts/blog-cadence-*, server/.

# Out of scope

- Checking links in already-published posts
- LinkedIn posting

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-readability.test.ts tests/blog-plain-language.test.ts
timeout 30 rg -n 'check-live' .claude/skills/blog-from-git/seed.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
