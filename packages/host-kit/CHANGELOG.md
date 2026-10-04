# Changelog

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
