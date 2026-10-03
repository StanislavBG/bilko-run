# Validation: blog absolute links (live posts, checker, policy)

Base: `929fbf4` (`fix(blog-watchdog): stop spotlight top-3 pipeline from dying to SIGPIPE under pipefail`)

## PRD location note

Neither `prds/` nor `prds-archived/` contains `1024-blog-live-posts-absolute-links.md`,
`1025-blog-checker-absolute-links.md`, or `1026-blog-policy-absolute-links-audience.md` in this
worktree — unlike other completed PRDs in this epic (`744-*`, `745-*` are present in
`scheduler/epics/psess-mscbr40o-2/prds-archived/`), these three left no `.md` file on disk at
all. Full PRD text (acceptance criteria included) was therefore not recoverable. Verified instead
from `session-manager-operations/scheduler/state/history.jsonl` (slug, goal `bodyPreview`,
`landedCommit`) cross-checked against each commit's actual diff:

| Slug | Landed commit | history.jsonl status |
| --- | --- | --- |
| `1024-blog-live-posts-absolute-links` | `56dab8e` | completed, exitCode 0 |
| `1025-blog-checker-absolute-links` | `72f3370` | completed, exitCode 0 |
| `1026-blog-policy-absolute-links-audience` | `d746adc` | completed, exitCode 0 |

`git diff 929fbf4..HEAD --stat` touches exactly the 7 files these 3 commits touch (`server/db.ts`,
`tests/db.test.ts`, `scripts/blog-readability.ts`, `tests/blog-readability.test.ts`,
`.claude/skills/blog-from-git/blog.config.yaml`, `.claude/skills/blog-from-git/voice.md`,
`tests/blog-plain-language.test.ts`) — nothing landed after `d746adc`.

## 1024-blog-live-posts-absolute-links — VERIFIED

Goal (history.jsonl): fix the live `turn-your-github-year-into-a-heatmap-and-badge-wall` post's
relative links and unlinked open-source claim via a one-shot boot migration in `server/db.ts`.

- Evidence: `server/db.ts:2983` adds `applyDataMigrationOnce('2026-10-03-blog-absolute-links', …)`
  that (a) sets the git-viewer post's content to the corrected text with
  `https://bilko.run/projects/git-viewer/` and `https://github.com/StanislavBG/git-viewer`, and
  (b) runs `UPDATE blog_posts SET content = REPLACE(content, '](/', '](https://bilko.run/') WHERE
  content LIKE '%](/%'` against every other live post. `applyDataMigrationOnce` (defined at
  `server/db.ts:569`, pre-existing helper, reused not duplicated) guards it to run once via the
  `data_migrations` table.
- Gate: `npx vitest run tests/db.test.ts` — 5/5 passed, including the new
  `prints every live post's links as absolute, clickable bilko.run/github URLs` test, which
  reproduces a stale pre-fix row, boots twice, and asserts both the one-time fix and idempotency.
- LIVE check (required by this validation's own acceptance criteria): polled
  `https://bilko.run/api/blog/turn-your-github-year-into-a-heatmap-and-badge-wall` every 30s,
  `--max-time 15`. Succeeded on attempt 6 (2026-10-03 ~16:47:59 UTC). Response `content` field
  contains `https://bilko.run/projects/git-viewer/` and `https://github.com/StanislavBG/git-viewer`,
  and does not contain `](/.`

## 1025-blog-checker-absolute-links — VERIFIED (see Important finding below)

Goal (history.jsonl): make `scripts/blog-readability.ts` (the pre-seed gate) fail a draft with a
relative link or an unlinked open-source/GitHub claim.

- Evidence: `scripts/blog-readability.ts:119-153` adds `findLinkIssues()` — flags any markdown
  link whose target isn't `https://`/`mailto:` (`relative-link`), any bare `/projects/<slug>/`
  path, and any paragraph matching `open source|source code|on github|fork it` that doesn't also
  contain a `https://github.com/` link (`unlinked-source-claim`). `analyzeReadability` folds
  `linkIssues.length === 0` into `pass` (line ~193).
- Gate: `npx vitest run tests/blog-readability.test.ts` — 9/9 passed, including the three new
  cases (flags relative link + unlinked claim and fails; passes once absolute + repo-linked;
  allows `mailto:`).

## 1026-blog-policy-absolute-links-audience — VERIFIED (see Critical finding below)

Goal (history.jsonl): update `blog.config.yaml` and `voice.md` so drafts print absolute
`bilko.run` URLs, link the real GitHub repo for open-source claims, and target an early-college
reader.

- Evidence: `blog.config.yaml:14` `identity.reader` now describes "an early-college student...
  click straight through"; `links:` (`static-path`, `react-route`, `cross-post`, lines ~189-197)
  are now `https://bilko.run/...`; `links.absolute_urls_only: true` and `links.source_repo` added.
  `voice.md:33-49` adds a "Links readers can click" section with the exact before/after example
  from the owner's git-viewer sentence.
- Gate: `npx vitest run tests/blog-plain-language.test.ts` — 26/26 passed, including all 8 new
  assertions on `identity.reader`, `links.*`, and the voice.md section/before-after example.

## Gate (combined)

`npx vitest run` (full suite, no path filter): **598/598 passed, 41/41 files**, including the
production `vite build && tsc -p tsconfig.server.json` step that runs as part of
`tests/spa-fallback-notfound-crash.test.ts`. No regressions outside the touched files.

## Findings

### Critical — `.claude/skills/blog-from-git/blog.config.yaml:14`

`identity.reader` is a `>-` (folded) block scalar; the three `#`-prefixed explanatory lines below
it (lines 17-19) are indented as scalar content, not as YAML comments, so they are folded into the
value instead of being stripped. Confirmed by parsing the file with `js-yaml`:

```
"an early-college student, new to these AI tools, who should be able to click straight through from the post to try each project right now\n                        # owner direction 2026-10-03: \"the audience is early college people\n                        # so they need to click\" — see links: below for the absolute-URL rule\n                        # this reader needs"
```

The live config value the `blog-from-git` skill reads for its reader persona contains a stray
literal `#` character and the owner's internal rationale text, not the clean one-sentence
description the diff intends. `tests/blog-plain-language.test.ts` only asserts
`reader.toLowerCase()).toMatch(/college/)` / `/click/` (substring checks), so the corruption
passed the gate undetected. Needs a follow-up fix: move those three comment lines above the
`reader:` key (outside the scalar) or drop them.

### Important — `scripts/blog-readability.ts:146-150`

`findLinkIssues` checks the open-source/GitHub-link pairing per paragraph
(`markdown.split(/\n\s*\n/)`). A draft that states "the project is open source" in one paragraph
and puts the `https://github.com/...` link in an adjacent paragraph — a normal way to structure a
post — trips `unlinked-source-claim` and fails the gate even though the repo is linked elsewhere
in the same post. Today's only two call sites (the live git-viewer post, and
`FIXED_LINK_PARAGRAPH` in the test) keep the claim and link in the same paragraph, so this hasn't
caused a false failure yet, but the checker is stricter than the PRD's intent ("unlinked" should
likely mean "nowhere in the post," not "not in this exact paragraph").

### Minor — `server/db.ts:2994`

The one-shot migration's `REPLACE(content, '](/', '](https://bilko.run/')` is a blanket string
replace. The code comment at line ~2985 already acknowledges that a future protocol-relative link
(`](//host/...`) would be mis-rewritten to `](https://bilko.run//host/...)`, and that this
migration only runs once (guarded by `data_migrations`), so a post added after this boot with such
a link would not get a second corrective pass. No such link exists in current seed data, so this
is latent, not currently triggered.

## Security review

Self-reviewed (the `/security-review` skill's git-status/diff capture in this worktree reflects
only unrelated foreign WIP, not the `929fbf4..HEAD` range, so its output wasn't usable — reviewed
the actual commit diffs directly instead). All three commits:

- `server/db.ts`: both the one-shot `UPDATE` and the `INSERT OR IGNORE` use parameterized
  statements via `dbRun`/`client.batch` — no string-interpolated SQL, no new user input path (the
  migration runs against fixed, hardcoded content at boot).
- `scripts/blog-readability.ts`: new regexes (`SOURCE_CLAIM_RE`, `GITHUB_LINK_RE`,
  `BARE_PROJECTS_PATH_RE`, `MARKDOWN_LINK_RE`) run against blog draft markdown already trusted as
  owner-authored input to a local CLI gate, not external/unauthenticated input; no ReDoS-prone
  nested quantifiers.
- `blog.config.yaml` / `voice.md`: static config/doc content, no code execution path.

No secrets, path traversal, or injection introduced.

## Sentinel

VALIDATION: 1024-blog-live-posts-absolute-links VERIFIED
VALIDATION: 1025-blog-checker-absolute-links VERIFIED
VALIDATION: 1026-blog-policy-absolute-links-audience VERIFIED
SCHEDULER_VERDICT: PASS
