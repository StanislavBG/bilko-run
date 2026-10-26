// Single source of truth for per-app static-bundle gzip budgets, read by the
// publish gate (mcp-host-server/src/gates/budget.ts), the sanity-QA size runner
// and server/db.ts's app_budgets seed for the admin dashboard. Values are raw
// bytes; the gate compares bytes but prints bytes / 1024 labelled "KB".
export const DEFAULT_BUDGET_GZ_BYTES = 200_000;
export const APP_BUDGETS_GZ_BYTES = Object.freeze({
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
});
export function budgetFor(slug) {
    return APP_BUDGETS_GZ_BYTES[slug] ?? DEFAULT_BUDGET_GZ_BYTES;
}
