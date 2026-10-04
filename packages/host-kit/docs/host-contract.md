# Host-Kit Contract

Every sibling app that uses `@bilkobibitkov/host-kit` must honour the
following contract. The platform publish gate (PRD 26) enforces these at
publish time.

---

## Component contract

| Component | Required props | Required behaviour |
|-----------|---------------|-------------------|
| `ToolHero` | `title`, `tagline`, `theme` | Renders `<h1>` with the tool title; renders `bilko.run` attribution link |
| `ScoreCard` | `score`, `grade`, `verdict`, `toolName`, `theme` | Renders `data-testid="score-card"` wrapper and `data-testid="score-card-grade"` grade element |

## Theme contract

Every sibling passes a `Theme` object with four keys:

```ts
{
  heroGradient: string;  // Tailwind gradient classes, e.g. 'from-[#0f1419] to-[#0a0d12]'
  glowColor:    string;  // CSS rgba, e.g. 'rgba(148,163,184,0.14)'
  accentText:   string;  // Tailwind text class for accent copy
  accentTextLight: string;
}
```

---

## Golden-path test contract

Every sibling repo MUST have `tests/golden.spec.ts` that uses
`@bilkobibitkov/host-kit/testing`. The spec MUST cover at minimum:

1. Signed-out user can load the page and sees brand chrome (ToolHero h1 + bilko.run link).
2. Signed-out user clicking the paid CTA sees an auth prompt or paywall, not a crash.
3. Signed-in user with credits can complete the primary action and a
   `<ScoreCard>` (or equivalent result element) renders.

A copy-pasteable template ships in the package:

```bash
cat node_modules/@bilkobibitkov/host-kit/dist/testing/golden.template.ts.txt
# or after build:
# dist/testing/golden.template.js  (the compiled stub)
```

PRD 26-platform-publish-gate enforces presence + green-test at publish time.

### Harness quick-start

```ts
import { withHostStub, expectChromeLoaded, submitPrimaryAction, expectScoreCard }
  from '@bilkobibitkov/host-kit/testing';

test('signed-in audit completes', async ({ page, context }) => {
  await withHostStub(context, {
    signedIn: true,
    credits: 10,
    routes: {
      'POST /tools/<slug>': () => ({ score: 87, grade: 'B+', verdict: 'Looks good.' }),
    },
  });
  await page.goto('/');
  await expectChromeLoaded(page, /My Tool/);
  await submitPrimaryAction(page, /Run/i);
  await expectScoreCard(page);
});
```

`withHostStub` intercepts `https://bilko.run/api/**` and returns
scriptable responses. It works for sibling apps that gate on
`/api/auth/me`. Apps using Clerk directly (like Stack-Audit) will still
get API interception but must handle Clerk's own auth separately — see the
Stack-Audit pilot in `~/Projects/Stack-Audit/tests/golden.spec.ts`.

---

## Game shell

`v0.7.0` ships a turnkey shell for Bilko games. Import the CSS tokens once, then render `<GameShell>`:

```ts
// globals.css (or entry point)
import '@bilkobibitkov/host-kit/styles/game-tokens.css';
```

```tsx
import { GameShell, createBus, useGameTimer, useVisibilityPause } from '@bilkobibitkov/host-kit';
import type { GameThemeColors } from '@bilkobibitkov/host-kit';

const theme: GameThemeColors = {
  heroGradient: 'from-indigo-900 to-indigo-950',
  glowColor: 'rgba(99,102,241,0.14)',
  accentText: 'text-indigo-400',
  accentTextLight: 'text-indigo-200',
};

// Typed event bus — one per game
type MyEvents = { cellSelected: { row: number; col: number }; gameOver: { won: boolean } };
const bus = createBus<MyEvents>();

export function App() {
  const { ms, reset } = useGameTimer({ paused: false });
  useVisibilityPause(() => console.log('paused'), () => console.log('resumed'));
  return (
    <GameShell eyebrow="Bilko · Puzzle" title="My Game" tagline="Have fun." theme={theme}>
      {/* slots */}
    </GameShell>
  );
}
```

### Exports added in v0.7.0

| Export | Purpose |
|--------|---------|
| `<GameShell>` | Full-page layout: gradient header + main + footer |
| `<GameTheme>` / `useGameTheme()` | Context provider exposing `GameThemeColors` to descendants |
| `createBus<E>()` | Typed pub/sub: `on`, `emit`, `off` |
| `useGameTimer({ paused })` | 250 ms tick timer: `{ ms, reset, pause, resume }` |
| `useVisibilityPause(onPause, onResume)` | Wires `visibilitychange` once |
| `styles/game-tokens.css` | CSS custom properties: ink/paper, cell states, marks, motion, Minesweeper extras |
| `styles/sudoku-token-aliases.css` | Back-compat shim for Sudoku v0.6 (`--digit-*` → `--mark-*`). Removed in PRD 46. |

### Manifest CLI

Every game's publish step should call:

```bash
bilko-host-kit emit-manifest --slug my-game [--out dist/manifest.json]
```

This reads `package.json` + `git rev-parse`, walks `dist/`, computes gzipped bundle size, and writes the platform ManifestSchema JSON.

---

## Analytics contract

Every sibling calls `track('view_tool', { tool: '<slug>' })` on mount and
`track('submit_start' | 'submit_success' | 'submit_error', ...)` around
the primary action. The harness silently swallows
`/api/analytics/**` and `/api/telemetry/**` calls so tests stay clean.
