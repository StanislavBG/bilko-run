// Single source of truth for per-app static-bundle gzip budgets, read by the
// publish gate (mcp-host-server/src/gates/budget.ts), the sanity-QA size runner
// and server/db.ts's app_budgets seed for the admin dashboard. Values are raw
// bytes; the gate compares bytes but prints bytes / 1024 labelled "KB".

export const DEFAULT_BUDGET_GZ_BYTES = 200_000;

export const APP_BUDGETS_GZ_BYTES: Readonly<Record<string, number>> = Object.freeze({
  // Academy ships the cl100k_base BPE table for the in-browser tokenizer demo.
  academy: 700_000,
  // web-remote phone app: WebSocket client + terminal renderer.
  'session-manager': 1_300_000,
  // Godot web game: ~10 MB gz wasm engine + ~20 MB gz game pck. Owner decision
  // 2026-10-24: bigger one-time downloads are fine if there is no ongoing runtime
  // penalty (no size named; cited by the budget bypasses in publish_overrides rows
  // 40-41, 48-49 and 51-54). 30,400 KiB is starry-night-2's own publish cap.
  'escape-velocity': 30_400 * 1024,
  // Phaser game + ~117 downscaled WebP sprites (post-incident: sprites were 116 MB PNG).
  'game-academy': 5_000_000,
  // Three Winds (3PMahjong): 16 self-hosted woff2 font subsets (Noto Serif TC slices,
  // Source Serif 4, Inter Tight, JetBrains Mono), ~1.3 MB gz, two thirds of the bundle.
  // Measured 2026-11-15 (live manifest): 1,938,261 bytes over 80 files once each font
  // shipped once (297d4fd; was 4,785,769 over 136), 1,984,717 over 97 after the sound pass
  // (becfc94). 2,500,000 leaves ~26% to grow; re-adding the ~2.7 MB of font copies fails.
  threewinds: 2_500_000,
});

export function budgetFor(slug: string): number {
  return APP_BUDGETS_GZ_BYTES[slug] ?? DEFAULT_BUDGET_GZ_BYTES;
}
