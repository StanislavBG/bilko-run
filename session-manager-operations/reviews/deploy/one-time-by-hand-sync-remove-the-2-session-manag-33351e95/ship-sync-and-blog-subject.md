# Ship: sync-and-blog-subject

SHIP: PASS

Pushed SHA: e21ae07c1aead3ca23332d0071015f51a6908da9 (origin/main, 9487f88c..e21ae07c, fast-forward, no force, origin only: StanislavBG/bilko-run)
Push time: 1:41:25 PM PST, 2026-11-07. Deploy seen live at 1:44:15 PM PST (/api/health uptime 36s, below the 170s since push; before that, uptime was about 44,600s).
Live checks ran at 1:44:28 PM PST, 2026-11-07.

## Commits (cherry-picked from local main onto origin/main 9487f88c in a throwaway tree, no conflicts, in this order)
- a8d82ff50f02141718d8d5685436011154f8aeea fix(blog): only public /projects projects can be a post's subject (WIP) (was d3514453)
- af266fc20adc4a553da2c9e73d17fb05d0b412e3 fix(sync): keep shas of commits already on origin/main; no-op when nothing to publish (was 85967893)
- e21ae07c1aead3ca23332d0071015f51a6908da9 test(blog): cover public-only subject gate; document it in blog-from-git (was 29deadc0)

Not pushed, still `+` in `git cherry origin/main 816b3cd9` after the push:
- f4f766e2 docs(manual): Field Manual 2.4.0 release bundle (documents app 0.129.0)
- 69d740be chore(ops): untrack Session Manager runtime state
- 60cfd169 docs(validation): verify sync-replay-keeps-shas
- 816b3cd9 docs(validation): verify blog-public-subject-tests
- this record (scripts/sync-local-main.sh publishes records later)

None of these touches any of the 13 files the three commits change.

## Checks
- validate-sync-keeps-shas.md: sync-replay-keeps-shas VERIFIED, no Critical or Important finding (one Minor, scripts/sync-local-main.sh:115, harmless): PASS
- validate-blog-public-subject-tests.md: blog-public-subject-tests VERIFIED, no Critical, Important or Minor finding: PASS
- After `git fetch origin`, each of the 3 subjects appears exactly once in origin/main..HEAD (816b3cd9), no merge commits, none already on origin (`git cherry` showed `+`): PASS
- Cherry-picks applied with no conflict: PASS
- pnpm test on e21ae07c: 174 files passed, 2 skipped; 1932 tests passed, 15 skipped. blog-subjects (7), blog-draft (15), blog-seed (7) and sync-local-main (6) all passed: PASS
- pnpm typecheck on e21ae07c (client, server, scripts): PASS
- pnpm build on e21ae07c: PASS
- `git remote get-url origin` is https://github.com/StanislavBG/bilko-run.git. `git push origin HEAD:main` pushed exactly 3 commits (`git rev-list --count origin/main..HEAD` = 3), with no force and no rebase needed: PASS
- Throwaway tree /tmp/ship-sync-blog-subject: symlinks removed, `git worktree remove` done: PASS
- Deploy: /api/health uptime 36s < 170s since push: PASS
- https://bilko.run/ 200: PASS
- https://bilko.run/projects 200: PASS
- https://bilko.run/blog 200: PASS
- https://bilko.run/api/projects returns 200 application/json with 10 projects (first: session-manager): PASS
- origin/main (e21ae07c) has scripts/blog-subjects.ts and tests/blog-subjects.test.ts (`git ls-tree`): PASS
- `git cherry origin/main <sha>` marks d3514453, 85967893 and 29deadc0 with `-`: PASS
- origin/main's top 3 commits are the 3 subjects in order, directly on 9487f88c: PASS
