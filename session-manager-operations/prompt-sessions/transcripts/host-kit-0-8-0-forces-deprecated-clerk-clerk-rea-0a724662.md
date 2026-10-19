# Transcript — host-kit-0-8-0-forces-deprecated-clerk-clerk-rea-0a724662

## User — 2026-10-18T14:53:08.126Z

This session is INBOUND FEEDBACK from another project: Bilko-Game-Academy (/home/bilko/Projects/Bilko-Game-Academy, session host-kit-0-8-0-with-the-auth-api-is-on-npm-bump--07c49239). It was raised while working on: host-kit 0.8.0 with the auth API is on npm — bump apps/shell off ^0.7.2. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: host-kit 0.8.0 forces deprecated @clerk/clerk-react peer on consumers that never use useAuth

## Why
Game Academy moved to host-kit ^0.8.0 (commit cadd671). It uses host-kit for the CLI and telemetry only and runs its own Clerk loader. Even so, pnpm now installs @clerk/clerk-react 5.61.10, which prints a deprecation warning ("use @clerk/react instead"), because host-kit 0.8.0 lists it as a required peerDependency. Any consumer that doesn't use the React auth hook gets this extra install and the warning.

## Proposed plan
1. Check whether dist/index.js actually imports @clerk/clerk-react; if it doesn't, remove the peer
2. If something does need it, mark it optional in peerDependenciesMeta, or move to @clerk/react
3. Expose a non-React auth subscribe API (getAuthState/subscribeAuth) so consumers aren't limited to useAuth

## Acceptance criteria
- [ ] Installing host-kit in a project that doesn't use useAuth pulls in no deprecated Clerk package
- [ ] peerDependencies matches what dist actually imports

## Details
Evidence (2026-10-17): host-kit 0.8.0's package.json has peerDependencies {"@clerk/clerk-react":"^5.0.0","@playwright/test":">=1.40","react":"^18.0.0"}, and only @playwright/test is optional. Running `pnpm install` in Game Academy printed: "WARN deprecated @clerk/clerk-react@5.61.10" and "dependencies: + @clerk/clerk-react 5.61.10 deprecated". Also, the original feedback said Game Academy had a "feature-detect fallback" for the auth exports. It didn't: packages/platform-bilko/src/clerk.ts is a port of host-kit's auth.ts. We keep it because host-kit's auth state is module-global and readable only through the React hook useAuth, while the Platform contract needs getState/subscribe and an injectable loader for tests.

Reference: /home/bilko/Projects/Bilko/packages/host-kit/package.json

## Agent — 2026-10-18T14:55:02.820Z

The report was right. Nothing in host-kit imports `@clerk/clerk-react`: `src/auth.ts` loads clerk-js at runtime from a `<script>` tag, and the built `dist/` has no reference to the package. It was listed as a required peer for no reason. The fix is pushed to `origin/main` as `dcdd007`.

**Changes (`packages/host-kit/`):**
- **Peer removed:** `@clerk/clerk-react` is gone from `peerDependencies` in `package.json`, from the externals list in `tsup.config.ts`, and from the install line in `README.md`. The lockfile entry is also removed. `react` stays as a required peer; `@playwright/test` stays optional.
- **New non-React API:** `getAuthState()` and `subscribeAuth(listener)` are added in `src/auth.ts` and exported from the package. `useAuth` is now built on top of them, so behaviour is unchanged. There is a new test for both.
- **Changeset:** `.changeset/host-kit-drop-clerk-react-peer.md`, marked `minor` because it adds API.

Tests (18), typecheck and build all pass, and the rebuilt `dist/` has no `clerk-react` references. Both acceptance criteria are met in the source. Game Academy only gets the fix once a new host-kit version (0.9.0) is released.

**Still open:**
- **Release not cut:** I didn't publish 0.9.0 to npm. That needs a `host-kit-vX.Y.Z` tag or `/builder`.
- **Game Academy can't drop its auth copy yet:** The report says it also needs an injectable Clerk loader for tests, which I didn't add. Until that exists, Game Academy has to keep `packages/platform-bilko/src/clerk.ts`.
- **Local `main` has diverged from `origin/main`:** the push was rejected because the remote had moved, and a repo hook blocked `git stash` and `git reset` on this shared working tree. So I pushed the change from a temporary worktree based on `origin/main`. Local `main` is now 5 ahead and 13 behind. That includes the old local copy of this commit (`b430fa9`, same change as `dcdd007`) and 4 local commits that were already unpushed before this session. Those 4 aren't mine and I left them alone.

## User — 2026-10-18T18:01:51.684Z

keep publishing

## Agent — 2026-10-18T18:04:56.417Z

host-kit 0.9.0 is on npm as `latest`, and its peer dependencies are now just `react ^18` plus `@playwright/test`, which is optional. `@clerk/clerk-react` is gone.

- **Release:** I applied the two pending changesets, which bumped the version to 0.9.0 and wrote the CHANGELOG entry. I also updated the README install line to `^0.9.0`. Build, the 18 tests and typecheck all passed before publishing.
- **Commit:** pushed to `origin/main` as `ebcc6c49`.
- **How it was published:** with `npm publish` from this machine as `bilkobibitkov`, the same way 0.8.0 went out. The tag-triggered workflow can't run because the repo has no `NPM_AUTOMATION_TOKEN` secret, so I didn't push a `host-kit-v0.9.0` tag.
- **Next for Game Academy:** bump to `host-kit@^0.9.0` and run `pnpm install`. The deprecated Clerk package and its warning should go away; I haven't run that install myself. It can also replace its own `clerk.ts` auth state with `getAuthState`/`subscribeAuth`. There's still no injectable Clerk loader for tests, though, so that file may need to stay for now.
- **Local checkout:** your local `main` is still out of sync with `origin/main`, and its old copy of the fix commit is a duplicate of what's on the remote. A repo hook blocks resetting the shared working tree, so you'll need to sync it yourself.
