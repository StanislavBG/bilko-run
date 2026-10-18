# host-kit

Shared React component kit used by bilko.run sibling apps.

## Install

```
pnpm add host-kit@^0.9.0
# peer dep:
pnpm add react
```

## Telemetry

Full process: [../../docs/observability.md](../../docs/observability.md). The host already captures pageviews and clicks for you; the SDK adds flows, logs and errors.

- `initTelemetry({ app, version })` — call once at boot; wires error capture and batching (5s, flushed on page hide).
- `track(name, props)` — one event to `/api/telemetry/event` (`funnel_events`). Auto-inits if you skip `initTelemetry`.
- `trackFlow(flow, step, props)` — `track('<flow>.<step>', ...)`; kebab-case names, e.g. `trackFlow('checkout', 'click-buy', { product })`.
- `log.info|warn|error(msg, fields)` — structured logs (`info` sampled at 10%).
- `logError(err, context)` — report a caught error (`app_errors`, de-duped).

No emails, tokens or free text in props; keys like `email`/`token`/`key` are redacted.

## Components

- `ToolHero` — dark gradient hero section
- `ScoreCard` — score + grade + verdict
- `SectionBreakdown` — per-pillar score bars
- `CompareLayout` — A/B side-by-side with winner banner
- `Rewrites` — AI rewrite suggestions with copy buttons
- `CrossPromo` — sibling-app cross-promo links

Each themable component accepts a `theme` prop:

```ts
interface Theme {
  heroGradient: string;     // tailwind classes, e.g. "from-[#1a1530] via-[#0f0d1a] to-[#1a1530]"
  glowColor: string;        // CSS color, e.g. "rgba(99,102,241,0.14)"
  accentText: string;       // tailwind class for dark-on-light, e.g. "text-indigo-700"
  accentTextLight: string;  // tailwind class for light-on-dark, e.g. "text-indigo-400"
}
```

Pass your tool's theme; the kit assumes no defaults.
