# Ship: publish ships every bundle file (PRD 1802)

- Validation record: `session-manager-operations/reviews/validation/add-a-threewinds-entry-to-app-budgets-ts-bundle--64ff1484/validate-publish-ships-every-file.md`. publish-fails-on-ignored-bundle-files VERIFIED, doc-publish-ships-every-file VERIFIED. Critical: none. Important: none. PASS
- origin/main before: `f1d04bad5e76fadc655931fdf882b9dbf9adea7c`
- Pushed SHA: `fb39d5fa2302a046c9e35b575e0db5331ad253b7` (fast-forward `f1d04bad..fb39d5fa`, `git push origin HEAD:main` to github.com/StanislavBG/bilko-run, first attempt). PASS
- Pushed at: 2026-11-15 9:20:42 AM PST

## Commits pushed (log order, cherry-picked onto origin/main in a throwaway tree)

Origin SHA, then the local-main source SHA in brackets:

- `f295ebf19089dc5eaf3540786dd2a1f465cb3ffe` fix(mcp-host): fail publish on gitignored bundle files; re-include node_modules under public/projects (bfd26a21ca98)
- `fb39d5fa2302a046c9e35b575e0db5331ad253b7` docs(host-contract): publish fails on files matching the host .gitignore (b940cc68df2a)

Left out on purpose:
- `d182dc25` fix(rooms): deal from HandResult.nextDealer. The path filter matched it through `docs/host-contract.md`, but it belongs to the Three Winds binding plan, whose ship record (`97b078b2`) is FAIL with 4 open Important findings.
- The other Three Winds binding commits (`780aba9c`, `b0a5cd00`, `388c78aa`, `c9414606`) and the plan records (`17ee947f`, `caee8de4`, `97b078b2`, `7582454c`). `scripts/sync-local-main.sh` publishes the records.
- `git cherry origin/main main` marked nothing with `-`.

## Checks on the pushed tree (/tmp/ship-publish-T6WQ, removed afterwards)

- `git diff --stat f1d04bad fb39d5fa`: only `.gitignore`, `docs/host-contract.md`, `mcp-host-server/dist/publish-checkout.js`, `mcp-host-server/src/publish-checkout.ts` and `tests/mcp-publish-checkout.test.ts`.
- `npx vitest run tests/mcp-publish-checkout.test.ts tests/mcp-dist-sync.test.ts`: 2 files, 14/14 tests passed. PASS

## Local main sync

- `bash scripts/sync-local-main.sh --no-push` in /home/bilko/Projects/Bilko: local main is now `6fa102a7`, 0 behind origin/main. The old tip is `backup/main-pre-sync`.
- `git status -sb` says `## main...origin/main [ahead 9]`. The 9 commits are the Three Winds binding commits and the plan records listed above. They are not this plan's to push. The rooms commits wait on their own fix plan.

No app was republished.

SHIP: PASS
