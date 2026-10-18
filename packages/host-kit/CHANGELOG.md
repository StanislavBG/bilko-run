# Changelog

## 0.9.0

### Minor Changes

- dcdd007: Drop the `@clerk/clerk-react` peer dependency — nothing in host-kit imports it (auth loads clerk-js from the host's Clerk Frontend API at runtime), so consumers no longer install the deprecated package. Add `getAuthState()` and `subscribeAuth(listener)` so non-React consumers can read and observe auth state; `useAuth` is now built on them.

### Patch Changes

- 2a23d46: README: install the unscoped `host-kit` (`^0.8.0`). The legacy `@bilkobibitkov/host-kit` stops at 0.7.2, which has no auth API.

## 0.8.0

### Minor Changes

- 732e7ec: Add `SiteHeader` — a shared, dependency-free Bilko top bar for static-path
  sibling apps. Reproduces the host's `pf-topbar` (brand, section links to
  absolute bilko.run URLs, optional Search/⌘K trigger, Online status pill, and a
  `rightSlot` for app-specific controls) without needing Clerk or React Router, so
  siblings served at `/projects/<slug>/` get consistent brand chrome. Theme-aware
  via host-kit CSS tokens with Bilko-light fallbacks. Exports `SiteHeader`,
  `DEFAULT_SECTIONS`, and the `SiteHeaderProps` / `SiteSection` types.
- 732e7ec: Fix: `useSaveState`, `useUnlocks` and `useLeaderboard().submit` sent cookies only,
  which the bilko.run host ignores — every authenticated call 401'd. They now send
  `Authorization: Bearer <Clerk JWT>` via the new auth helpers, and skip the request
  entirely when no user is signed in.

  New exports: `initAuth`, `useAuth`, `openSignIn`, `signOut`, `getAuthToken`,
  `authFetch`, `hasSignedInCookie`, and the `AuthState` type. They lazy-load clerk-js
  from `clerk.bilko.run`, only when the `__client_uat` cookie shows a prior sign-in.

### Patch Changes

- e423d47: `bilko-host-kit` manifest CLI: detect the bare `host-kit` dependency name (and still
  the legacy `@bilkobibitkov/host-kit`), reading the installed version for `file:`
  specifiers. Before this, bare-name consumers got `hostKit.version: "0.0.0"`.
- 9091b4d: Remove the Workflows link from `SiteHeader`'s `DEFAULT_SECTIONS` because bilko.run/workflows was retired.
- 8b743b1: Drop the Academy link from `SiteHeader`'s `DEFAULT_SECTIONS` so it matches the host nav (Home, Projects, Blog, Contact). Build `dist/` on install (`prepare`) so `file:` consumers never pick up a stale build.

## 0.7.2

- **`bilko-host-kit emit-manifest`** — fall back to reading the actually-installed `@bilkobibitkov/host-kit` version from `node_modules/` when a consumer's `package.json` declares the dep as `workspace:*` (or any non-numeric range). Previously emitted `0.0.0` for workspace consumers.

## 0.7.1

- **`useUnlocks`** — expose `lastCrossUnlock` so consumers can react to cross-game unlocks.

## 0.7.0

- **`<GameShell>`** — layout container (eyebrow, title, tagline, theme, footerLinks) replacing per-game App shells.
- **`<GameTheme>`** / **`useGameTheme()`** — context provider that applies a per-game color theme.
- **`createBus<E>()`** — generic typed pub/sub factory with `on`, `emit`, `off`.
- **`useGameTimer({ paused })`** — 250 ms tick timer returning `{ ms, reset, pause, resume }`.
- **`useVisibilityPause(onPause, onResume)`** — wires `visibilitychange` once.
- **`styles/game-tokens.css`** — canonical Apple-grade design tokens (ink/paper, cell states, marks, motion, Minesweeper extras).
- **`styles/sudoku-token-aliases.css`** — back-compat shim mapping `--digit-*` → `--mark-*` for Sudoku v0.6 consumers.
- **`bilko-host-kit emit-manifest`** — CLI that writes `dist/manifest.json` matching platform ManifestSchema.

## 0.6.0

- `useLeaderboard`, `useSaveState`, `useUnlocks` — game services hooks.

## 0.5.0

- **`CrossPromo`** — contextual "Next up" panel linking to related bilko.run tools. Consumer-supplied item list; no bilko.run dependency at runtime.
- **Color utilities** — exported `gradeColor`, `gradeColorLight`, `barColor` helpers for consistent grade/bar coloring across tools.

## 0.4.0

- **`CompareLayout`** — A/B comparison layout with winner banner, side-by-side score cards, verdict, and optional strategic analysis block.
- **`Rewrites`** — AI rewrite suggestion list with copy buttons, predicted score badges, technique labels, and `why_better` callouts.

## 0.3.0

- Telemetry SDK: `initTelemetry`, `log`, `logError`, `flush`.
- `/testing` subpath: Playwright harness + golden-path template.
