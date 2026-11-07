# Validation: blog-public-subject-tests

Base: 69d740be. Commit: 29deadc0 (touches only tests/blog-draft.test.ts, tests/blog-seed.test.ts, tests/blog-subjects.test.ts, .claude/skills/blog-from-git/{SKILL,rotation}.md; no script changes).

## blog-public-subject-tests — VERIFIED

1. Draft test passes with public fixture + `project` in result.json: gate run, `✓ drafts: exit 0, exact result.json, post.md and images, model pinned`.
2. Seed test passes with a public fixture: `git show 29deadc0` sets `outdoor-hours` `public:true` in tests/blog-seed.test.ts; ledger/Last assertions unchanged; gate green.
3. Non-public refusal test: `✓ refuses a post whose project is not public: non-zero exit, error result.json` (blog-draft.test.ts).
4. scripts/blog-subjects.ts coverage: new tests/blog-subjects.test.ts, 7 tests green (public candidate, missing/false excluded, cooldown excluded, checkPost refusals).
5. Docs: SKILL.md "Subject rule" callout and rotation.md "Only public projects can be a subject" name scripts/blog-subjects.ts; no test greps them.
6. Gate `timeout 300 pnpm vitest run tests/blog-draft.test.ts tests/blog-seed.test.ts tests/blog-subjects.test.ts`: 3 files passed, 29 tests passed.

## Findings

- Critical: none.
- Important: none.
- Minor: none. Self-review of the diff: test-only plus docs; no secrets, no network, no unsafe input.
