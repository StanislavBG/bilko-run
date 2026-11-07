# Ship: sst-writer-row

Time: 2026-11-06 5:35 PM PST

- Validation record: VERIFIED, no Critical or Important finding. PASS
- Exactly one commit with the subject 'doc(repo-writers): social-signals-trader publishes from a throwaway worktree' in ea15af34..HEAD: FAIL. Two match: cc0bc977f608e5d4e6b7510b8ddf1c09da7111c8 and a9bbee1118d79c5c5a7310ecf8d2593425205e59. Both show as unshipped in `git cherry -v origin/main HEAD`.
- origin/main holds 'doc: deployment.md and repo-writers.md own their facts; CLAUDE.md points': PASS
- Cherry-pick, docs-only check, push: not run. The run stopped at the duplicate subject. Nothing was pushed.

Pushed SHA: none.

The PRD says to fail when the subject appears twice. Which commit to ship (or both, or the later fix only) is for the owner or architect to decide.

SHIP: FAIL (duplicate commit subject)
