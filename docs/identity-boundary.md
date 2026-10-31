# Identity boundary

This repository is public. Bilko is the only identity that may appear in it. The owner's
real name and personal email must never appear in a tracked file, a commit message or a
commit's author or committer. Write "the owner" instead. This is standing policy
D-2026-10-20-02 in the owner's private portfolio ledger.

Do not quote the forbidden strings in this file or anywhere else in the repo. That
includes the guard, its tests and its error messages. A test that must prove a string
stays out of its output calls `identityHits` from `tests/identity-denylist.ts`. It reads
the strings at run time, from the CI secret or the local deny-list, and reports entry
numbers.

## What is not tracked

`session-manager-operations/prompt-sessions/` is gitignored. It holds Session Manager's
Epic records, chat transcripts and `exchanges.jsonl`. Agents had quoted the owner's
email in 48 of those files and the surname in 2. The directory was untracked on
2026-10-22 with `git rm --cached` in the main checkout, so the files are still on disk
and Session Manager still reads and writes them there.

A branch commit that deletes those paths would not have worked. Session Manager lands an
Epic by running `git merge` in the main checkout, and that merge would delete the clean
copies and abort on the dirty ones.

## The guard

`scripts/identity-guard.sh` reads the forbidden strings from a local deny-list that is
never committed. The path is `$BILKO_IDENTITY_DENYLIST`, default
`~/.config/bilko/identity-denylist`, mode 600, one string per line. Matching is
case-insensitive. Output names files and entry numbers, never the matched text.

An entry written `word:<string>` matches only as a whole word, so a longer word that
contains the string stays allowed. The tree scan leaves `*.wasm` out of these entries,
because compiled engines ship third-party credit lists where someone else can share the
name. The deny-list holds the owner's email, surname and first name. The first name is a
`word:` entry.

| Hook | Blocks |
|---|---|
| `pre-commit` | staged added lines, and an author or committer identity, that match |
| `commit-msg` | a commit message that matches |
| `pre-push` | pushed commits whose added lines or messages match. Matching identities only warn, because commits made before the persona identity carry the personal email. |

To set up a machine:

1. Write the deny-list file.
2. Run `pnpm hooks:install`. Hooks live in the shared hooks dir, so this covers every
   worktree. The hooks run a copy of the guard, so re-run the install after you change
   the guard.

To audit the tree, run `pnpm identity:scan`. It checks binary files as well as text and
exits 1 on any hit. Its pass line gives the number of deny-list entries it checked.

CI runs the same scan on every push to `main` and every pull request. It reads the
strings from the `IDENTITY_DENYLIST` repo secret (one string per line), set on
2026-10-30. A pass line with an entry count in the Identity scan step shows the run used
real values.

Without the secret, a push to `main` fails. A pull request only warns and skips, because
GitHub withholds secrets from fork pull requests. The push that lands it still scans.

The secret is a copy of the deny-list file. After you change the file, update the secret:

```bash
gh secret set IDENTITY_DENYLIST --repo StanislavBG/bilko-run < ~/.config/bilko/identity-denylist
```

`--no-verify` bypasses the hooks. Do not use it to get past the guard.

## Commit identity

This repo's local git config sets the commit identity to `Bilko <bilko@bilko.run>`, the
same persona address the site uses. All worktrees share that config.

## History

The 2026-10-22 commit removed the strings from the current tree only. Older revisions on
`origin` still contain them:

- the 48 files under `session-manager-operations/prompt-sessions/`
- the author and committer email of roughly 2,260 commits made before the persona
  identity
- the first name, in the 9 files scrubbed on 2026-10-30

Only a history rewrite removes them, using `git filter-repo` plus a force-push of `main`.
A rewrite changes every SHA. The owner decides whether to do it.

A rewrite does not reach npm. Published tarballs do not change, so `host-kit` 0.9.0 and
older, and the legacy `@bilkobibitkov/host-kit`, keep the first name.

**Decision:** pending, asked 2026-10-22. When the owner decides, record the decision and
the date here.
