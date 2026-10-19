---
title: Package the Launch Kit: README, license notices, and a reproducible v1.0.0 zip outside any published folder
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:39:16.132Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-skills-b]
planId: pl-mv3bwyfa-549f4d
---
# Goal

build: turn the 8 written skills in /home/bilko/Projects/Bilko-Launch-Kit/pack/ into the sellable v1.0.0 download: a buyer README with install steps and clear skill labels/outcomes, our license plus the upstream MIT notices, and a byte-reproducible zip written to dist-pack/ at the repo root (never under site/, so publishing the landing page can never ship it). Record the zip's filename, size and sha256 in Bilko — the host pins the release by that hash.

# Acceptance criteria

- [ ] pack/README.md has: what the kit is, a table of the 8 skills (label -> outcome -> output file in .launch/), 'start with launch-context', install steps for Claude Code (copy skills/* into ~/.claude/skills/ or a project's .claude/skills/), for Claude.ai (upload each skill folder as a zip under Skills settings) and for the Agent SDK, a short FAQ, and support at https://bilko.run/contact.
- [ ] pack/LICENSE.md grants the purchaser personal and commercial use and forbids reselling or redistributing the pack as-is; pack/LICENSES/ holds the two upstream MIT license texts with copyright lines intact; pack/NOTICE.md maps each skill to its sources; pack/CHANGELOG.md has a 1.0.0 entry dated 2026-10-10.
- [ ] scripts/build-pack.mjs (Node) writes dist-pack/bilko-launch-kit-1.0.0.zip with a single top-level folder bilko-launch-kit/, sorted entries, fixed timestamps and no .DS_Store, plus dist-pack/release.json {version, filename, bytes, sha256}; `node scripts/build-pack.mjs --check` rebuilds into a temp dir and exits 0 only if the bytes are identical to dist-pack/ (reproducible).
- [ ] The zip is under 5 MB, `unzip -l` lists all 8 SKILL.md files plus README.md, LICENSE.md, NOTICE.md and LICENSES/, and scripts/lint-skills.mjs passes against a fresh unzip of it.
- [ ] The sibling repo commits releases/1.0.0.json (a copy of release.json) and the scripts; dist-pack/ stays gitignored; and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-package.md is committed in Bilko with version, filename, bytes, sha256 and the file list (names only, no skill text).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-package.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/research/sources.md, the 8 pack/skills/*/SKILL.md frontmatters, /home/bilko/Projects/Bilko-Launch-Kit/scripts/lint-skills.mjs.

Steps:
1. Write the pack docs. Keep the README voice witty and direct; outcomes concrete.
2. build-pack.mjs: simplest reproducible path is staging a copy under a temp dir as bilko-launch-kit/, setting every mtime to 2026-10-10T00:00:00Z (fs.utimesSync), then `zip -X -D -r` over a sorted file list via child_process with cwd = staging dir (TZ=UTC). If `zip` is unavailable, write a minimal stored (no-compression) zip writer in Node. Check reproducibility by running twice.
3. Add a root package.json (private, no deps) with scripts lint, build:pack if useful.
4. Commit in the sibling, then write and commit the Bilko record.

The Bilko repo is public: the record carries metadata only. Do not touch: sources/, site/.

# Out of scope

- Uploading the zip to production (launch-kit-deploy-api)
- Landing page (launch-kit-landing-page)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 node /home/bilko/Projects/Bilko-Launch-Kit/scripts/build-pack.mjs --check
timeout 60 node /home/bilko/Projects/Bilko-Launch-Kit/scripts/lint-skills.mjs
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
