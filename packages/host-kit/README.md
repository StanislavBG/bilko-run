# host-kit

Client SDK and component kit for bilko.run sibling apps (static-path): auth, games hooks, the shared site header, telemetry, scoring components, Playwright test helpers and a manifest CLI.

## Install

Sibling apps in the workspace depend on it locally:

```json
"host-kit": "file:../Bilko/packages/host-kit"
```

The npm package name is `host-kit` (`pnpm add host-kit@^0.11.0`; 0.11.0 is the first release that tags every telemetry record with `env`, see [Telemetry](#telemetry)). Peer deps: `react` ^18, and `@playwright/test` >=1.40 only if you use `host-kit/testing`.

- **Tailwind.** Tailwind skips `node_modules`, so apps that render kit components need `@source "<rel>/node_modules/host-kit/dist";` in their Tailwind CSS.
- **Vite.** Apps on the `file:` dependency add `hostKitVite()` from `host-kit/vite` to `plugins` in `vite.config.ts`. Vite pre-bundles host-kit into `node_modules/.vite/deps` and rebuilds that copy only when the lockfile or the Vite config changes. A `file:` dependency's version is not in `pnpm-lock.yaml`, so without the plugin `pnpm dev` (and a Playwright `webServer` running it) keeps serving the old host-kit after `pnpm install`. The plugin's name carries a fingerprint of the installed host-kit, so Vite re-bundles when that copy changes and keeps its cache otherwise. npm installs record the version in the lockfile and need no plugin. `optimizeDeps.exclude: ['host-kit']` is not a fix: Vite serves an excluded dep at an immutable `?v=` URL that also changes only with the lockfile or config, so an open browser keeps the old copy.
- **After changing host-kit.** Run `pnpm --filter host-kit build` in the Bilko repo, then `pnpm install` in each app (pnpm copies the untracked `dist/` into the app). An app without `hostKitVite()` must also delete `node_modules/.vite` (or start once with `vite --force`). Then check what the dev server serves, not `node_modules/host-kit`: start `pnpm dev`, load the app once, and `grep -l navigator.webdriver node_modules/.vite/deps/*.js` must list a file (0.11.0 and later).
- **Changesets.** Add a `.changeset/*.md` in the Bilko repo for each change.
- **Releases.** Done by hand, see [docs/publishing-contract.md](https://github.com/StanislavBG/bilko-run/blob/main/docs/publishing-contract.md).

## Auth

Clerk-backed sign-in state for the host's `/api`. Import from `host-kit`.

- `initAuth(): void` — start loading auth state (idempotent).
- `useAuth(): AuthState` — React hook; `AuthState = { status: 'idle' | 'loading' | 'signed-out' | 'signed-in' | 'unavailable'; firstName: string | null; imageUrl: string | null }`.
- `getAuthState(): AuthState` — current state, non-reactive.
- `subscribeAuth(listener: (s: AuthState) => void): () => void` — subscribe; returns unsubscribe.
- `openSignIn(): Promise<void>` — open the sign-in dialog.
- `signOut(): Promise<void>` — sign out.
- `getAuthToken(): Promise<string | null>` — Clerk session JWT, or null when signed out.
- `authFetch(input: string, init?: RequestInit): Promise<Response | null>` — fetch with the Bearer token; null when there is no session.
- `hasSignedInCookie(): boolean` — cheap synchronous hint that a session probably exists.

## Bilko-DB

Each signed-in user's documents (JSON or text) and images for one app, on the host's `/api/db/:app` API. Every call goes through `authFetch`. Import from `host-kit`.

- `bilkoDb(app: string, opts?: { team?: boolean }): BilkoDbClient`. With `{ team: true }` every docs and images call goes to the app's shared team storage: `GET /api/db/<app>/team/docs?prefix=`, `GET`/`PUT`/`DELETE /api/db/<app>/team/docs/<key>`, `POST`/`GET /api/db/<app>/team/images`, `DELETE /api/db/<app>/team/images/<id>` (403 `not_member` for a user not on the team). Image links stay public at `/api/db/<app>/images/<id>` either way. Without the option the calls use the signed-in user's own `/api/db/<app>/docs` and `/api/db/<app>/images`:
  - `list(prefix?)` → `BilkoDocMeta[]` (`{ key, type: 'json' | 'text', bytes, version, updatedAt }`).
  - `get<T>(key)` → `{ value: T, version, type } | null` (null when missing; the version comes from the ETag).
  - `put(key, value, opts?)` → `BilkoDocMeta`. Objects go as `application/json`; `put(key, string, { text: true })` goes as `text/plain`. `opts.ifVersion` sends `If-Match`, `opts.createOnly` sends `If-None-Match: *`.
  - `remove(key, opts?)` → `true`, or `false` when missing; `opts.ifVersion` sends `If-Match`.
  - `images.upload(blob)` → `BilkoImage` (`{ id, url, type, bytes, createdAt }`, `url` absolute and public by link); `images.list()`, `images.remove(id)`, `images.url(id)`.
- `useDoc<T>(app, key, opts?: { team?: boolean })` — reads and writes through `bilkoDb(app, opts)`; it reloads when `opts.team` changes. `{ value, version, loading, error, save(value): Promise<boolean>, remove(): Promise<boolean> }`. `save` sends `If-Match` with the version it last read (create-only when the doc did not exist), so a write from elsewhere comes back as `error.code === 'version_mismatch'` instead of overwriting it. String values are saved as text.
- `bilkoTeam(app: string): BilkoTeam` — manage the app's team from the browser:
  - `get()` → `GET /api/db/<app>/team` → `{ app, role, members: [{ email, role, addedAt }] }` (`role` is the caller's: `owner`, `member`, or `admin` for the site admin).
  - `set(email, role: 'owner' | 'member')` → `PUT /api/db/<app>/team/members/<email>` with JSON `{ role }` → `{ email, role, created }`. Owners only.
  - `remove(email)` → `DELETE /api/db/<app>/team/members/<email>` → `true`, or `false` on 404 `not_found`. A member may remove themselves.
  - The email is sent with `encodeURIComponent`. Failures throw `BilkoDbError` with the API's code: `not_member`, `last_owner`, `team_full`, `bad_email`, `bad_role`.
  - Types: `BilkoTeamRole`, `BilkoTeamMember`, `BilkoTeam`.
- `BilkoDbError` — thrown on failure: `status`, `code` (the API's `error`, e.g. `version_mismatch`, `too_large`, `quota_exceeded`, `rate_limited`; `signed_out` when there is no session) and `version` when the API reports the stored one.

## Games hooks

- `useLeaderboard(game: string, opts?: LeaderboardOpts)` — returns `{ scores: ScoreRow[], loading, error, submit(score, mode?, payload?): Promise<boolean>, refresh(): Promise<void> }`; `LeaderboardOpts = { range?: 'today' | 'week' | 'all'; mode?: string; limit?: number }`.
- `useSaveState<T>(game: string): SaveStateResult<T>` — the legacy single-slot store (one save slot per game; new apps use [Bilko-DB](#bilko-db)): `{ blob: T | null, version, updated_at, loading, save(blob): Promise<boolean>, clear(): Promise<void> }`.
- `useUnlocks(game: string)` — `{ unlocks: UnlockRow[], achievements: AchievementDef[], unlock(key): Promise<boolean>, lastCrossUnlock: CrossUnlock | null }`.
- Types: `ScoreRow`, `LeaderboardOpts`, `AchievementDef`, `UnlockRow`, `SaveStateResult`, `CrossUnlock`.

## Game shell

- `GameShell({ eyebrow, title, tagline, theme, children, footerLinks }: GameShellProps)` — page layout for a game.
- `GameTheme({ colors: GameThemeColors, children })` — provides game colour tokens.
- `useGameTheme(): GameThemeColors` — read the tokens from context.
- `createBus<E extends Record<string, unknown>>()` — typed event bus.
- `useGameTimer({ paused: boolean })` — game clock that stops while paused.
- `useVisibilityPause(onPause: () => void, onResume: () => void)` — call back when the tab hides or shows.
- Types: `GameShellProps`, `GameThemeColors`.

## Site header

- `SiteHeader(props: SiteHeaderProps)` — the shared Bilko top bar. Props: `brandHref?`, `brandName?`, `sections?: readonly SiteSection[]`, `activeHref?`, `onSearch?: () => void`, `showStatus?: boolean` (default true), `rightSlot?: ReactNode`.
- `DEFAULT_SECTIONS: readonly SiteSection[]` — the standard bilko.run nav sections (`SiteSection = { label, href }`).
- `searchShortcutLabel(nav?): '⌘K' | 'Ctrl K'` — platform-correct label for the search shortcut.
- Types: `SiteHeaderProps`, `SiteSection`.

## Telemetry

Full process: [docs/observability.md](https://github.com/StanislavBG/bilko-run/blob/main/docs/observability.md). The host already captures pageviews and clicks for you; the SDK adds flows, logs and errors.

- `initTelemetry({ app, version, env? }): void` — call once at boot; wires error capture and batching (5s, flushed on page hide).
- `track(name: string, props?: Record<string, unknown>): void` — one event to `/api/telemetry/event` (`funnel_events`). Auto-inits if you skip `initTelemetry`.
- `trackFlow(flow: string, step: string, props?): void` — `track('<flow>.<step>', ...)`; kebab-case names, e.g. `trackFlow('checkout', 'click-buy', { product })`.
- `flush(): void` — send the buffered events now.
- `log.info|warn|error(msg, fields)` — structured logs (`info` sampled at 10%).
- `logError(err: Error, context?: Record<string, unknown>): void` — report a caught error (`app_errors`, de-duped).
- `resolveEnv(): TelemetryEnv` — the env this page would report as (see below).
- Type: `TelemetryEnv` (`'prod' | 'dev' | 'test'`).

Every event, log and error record carries `env`, resolved once when telemetry initializes (also when `track()` auto-initializes):

1. `'prod'` on `bilko.run` and `www.bilko.run`, even under automation (the host's bot filters handle that).
2. Otherwise `'test'` when `navigator.webdriver` is `true` (Playwright, Selenium).
3. Otherwise `'dev'` (localhost, `127.0.0.1` and any other host).

`initTelemetry({ app, version, env: 'test' })` overrides the resolved value; anything other than `'prod'`, `'dev'` or `'test'` is ignored. The host stores `env` per record and counts a record without one as prod, which is what host-kit before 0.11.0 sends: off-host runs on an older host-kit still land as prod until you upgrade.

No emails, tokens or free text in props; keys like `email`/`token`/`key` are redacted.

## Scoring components

- `ToolHero({ title, tagline, theme, children })` — dark gradient hero section.
- `ScoreCard({ score, grade, verdict, toolName, theme })` — score + grade + verdict, with copy/download/share.
- `SectionBreakdown({ pillars: Record<string, PillarScore>, labels })` — per-pillar score bars; `PillarScore = { score, max, feedback }`.
- `CompareLayout({ winner: 'A' | 'B' | 'tie', margin, verdict, analysis?, cardA, cardB, pillarLabels })` — A/B side-by-side with winner banner.
- `Rewrites({ rewrites: Rewrite[], noun? })` — AI rewrite suggestions with copy buttons; `Rewrite = { text, predicted_score?, optimized_for?, technique?, label?, why_better? }`.
- `CrossPromo({ items: CrossPromoItem[] })` — sibling-app links; `CrossPromoItem = { name, href, hook }`.
- `Theme` (passed as `theme`; the kit assumes no defaults):

```ts
interface Theme {
  heroGradient: string;     // tailwind classes, e.g. "from-[#1a1530] via-[#0f0d1a] to-[#1a1530]"
  glowColor: string;        // CSS color, e.g. "rgba(99,102,241,0.14)"
  accentText: string;       // tailwind class for dark-on-light, e.g. "text-indigo-700"
  accentTextLight: string;  // tailwind class for light-on-dark, e.g. "text-indigo-400"
}
```

## Testing (`host-kit/testing`)

Playwright helpers; needs `@playwright/test`.

- `withHostStub(context: BrowserContext, initial?: HostStubOpts)` — stub the host backend (`HostStubOpts = { signedIn?, email?, credits?, isAdmin?, apiHost?, routes? }`); returns updaters such as `signIn(email?)` and `setCredits(n)`.
- `expectChromeLoaded(page, expectedTitle: string | RegExp)` — the hero h1 matches and the bilko link is visible.
- `submitPrimaryAction(page, ctaName: string | RegExp)` — click the primary CTA button.
- `expectScoreCard(page)` — wait for the ScoreCard and its grade.
- `signInAs(stub, page, email?)` — flip the stub to signed-in and reload.
- `setCredits(stub, page, n: number)` — set the credit balance and reload.

## CSS

- `host-kit/styles/game-tokens.css` — game colour and spacing tokens.
- `host-kit/styles/sudoku-token-aliases.css` — Sudoku token aliases over the game tokens.

## Vite plugin (`host-kit/vite`)

- `hostKitVite(): HostKitVitePlugin` — dev-server-only plugin (`apply: 'serve'`) with no hooks. Its name is `host-kit@<version>+<hash of package.json and dist/>`, and Vite hashes plugin names into the key of its dependency cache. See [Install](#install).

## CLI

`bilko-host-kit` has one command, run from an app's root after its build:

- `bilko-host-kit --slug <slug> [--out dist/manifest.json]` — write the build manifest (slug, app version, git SHA and branch, host-kit version, gzip bundle size) for `dist/`; `--slug` is required.
