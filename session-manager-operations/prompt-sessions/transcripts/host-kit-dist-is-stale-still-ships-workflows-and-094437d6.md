# Transcript — host-kit-dist-is-stale-still-ships-workflows-and-094437d6

## User — 2026-10-11T04:29:42.518Z

This session is INBOUND FEEDBACK from another project: Bilko-Academy (/home/bilko/Projects/Bilko-Academy, session drop-the-workflows-nav-link-bilko-run-workflows--0bbc6cf7). It was raised while working on: Drop the 'Workflows' nav link — bilko.run/workflows is being removed. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: host-kit dist/ is stale (still ships Workflows) and DEFAULT_SECTIONS lists Academy, which the real host nav doesn't

## Why
The Workflows link was removed from host-kit's src (commit 9091b4d), but packages/host-kit/dist was never rebuilt. Sibling apps that depend on file:../Bilko/packages/host-kit resolve to dist/, so Academy's bundle still contains the "bilko.run/workflows" string. Separately, the report sent to Academy said the host nav is "Home, Projects, Blog, Academy, Contact", but the real host nav (src/data/portfolio.ts SECTIONS) is Home, Projects, Blog, Contact. Academy kept the version without an Academy tab.

## Proposed plan
1. Run `pnpm --filter host-kit build` (tsup) so dist/index.js and dist/index.cjs no longer contain bilko.run/workflows
2. Decide whether host-kit DEFAULT_SECTIONS should include Academy; it currently differs from SECTIONS in src/data/portfolio.ts
3. Consider building host-kit dist on install (a prepare script) so file: consumers never get a stale dist

## Acceptance criteria
- [ ] grep 'bilko.run/workflows' packages/host-kit/dist returns nothing
- [ ] host-kit DEFAULT_SECTIONS and portfolio.ts SECTIONS agree, or the difference is documented

## Details
Evidence: packages/host-kit/dist/index.js:517 still has { label: "Workflows", href: "https://bilko.run/workflows" }, while src/SiteHeader.tsx:41-45 has Home/Projects/Blog/Academy/Contact. dist is untracked, so this is only a local rebuild. Academy commit 0fc17d3 (branch sm-epic/drop-the-workflows-nav-link-bilko-run-workflows--0bbc6cf7) removed Workflows from Academy's own HEADER_SECTIONS. To make a clean bundle, Academy had to build with a host-kit dist built in a temporary copy. The new Academy bundle has NOT been published to public/projects/academy/ yet; that is waiting on human approval.

Reference: /home/bilko/Projects/Bilko/packages/host-kit/dist/index.js
Reference: /home/bilko/Projects/Bilko/packages/host-kit/src/SiteHeader.tsx
Reference: /home/bilko/Projects/Bilko/src/data/portfolio.ts

## Agent — 2026-10-11T04:34:44.883Z

I checked the report and it was correct on both points. Both fixes are pushed to `origin/main` (8b743b1).

**What I found:**
- The built copy of host-kit (`packages/host-kit/dist/index.js:517` and `index.cjs:569`) still had the Workflows link. It was built on Oct 4, before commit 9091b4d removed the link from the source.
- The default header links in `DEFAULT_SECTIONS` included Academy, but the real host nav (`SECTIONS` in `src/data/portfolio.ts`) is Home, Projects, Blog, Contact. The changeset that added `SiteHeader` says it copies the host's top bar, so I treated Academy as drift and removed it.

**What changed:**
- **`packages/host-kit/src/SiteHeader.tsx`:** removed the Academy link and added a comment saying the list must match `portfolio.ts` `SECTIONS`.
- **`packages/host-kit/package.json`:** added `"prepare": "tsup"`, so running `pnpm install` in the Bilko repo now rebuilds `dist/` and it can't go stale again.
- **`.changeset/site-header-match-host-nav.md`:** a patch changeset for the above.
- **Checks:** a clean `pnpm install` ran the new build step. The host-kit typecheck passes and all 17 host-kit tests pass. In this worktree's new build, neither `bilko.run/workflows` nor the Academy link appears.

**In `~/Projects/Bilko`, the copy that sibling apps link to:**
- I rebuilt `dist/` there, and `grep 'bilko.run/workflows' packages/host-kit/dist` now returns nothing, so the first acceptance criterion is met.
- That checkout's `main` has 17 local commits that aren't on origin, while origin has 4 it doesn't, including mine. They can't be fast-forwarded, so I didn't pull or touch them. Its `dist/` still has the Academy default link until those commits are reconciled and it is rebuilt. This doesn't affect Academy, because it passes its own `HEADER_SECTIONS` list.

**For Academy:** run `pnpm install` in `~/Projects/Bilko-Academy` and it will pick up a clean host-kit without the temporary-copy workaround. Its new bundle still hasn't been published to `public/projects/academy/`; that is waiting on human approval.
