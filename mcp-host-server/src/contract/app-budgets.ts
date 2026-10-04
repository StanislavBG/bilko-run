// Single source of truth for per-app static-bundle gzip budgets, consumed by
// the publish gate (mcp-host-server/src/gates/budget.ts). Numbers copied
// from server/db.ts's app_budgets seed data (academy + OVERSIZE_BUDGETS);
// that file remains the DB seed for the admin dashboard but is no longer
// read by the gate itself.

export const DEFAULT_BUDGET_GZ_BYTES = 200_000;

export const APP_BUDGETS_GZ_BYTES: Readonly<Record<string, number>> = Object.freeze({
  // Academy ships the cl100k_base BPE table for the in-browser tokenizer demo.
  academy: 700_000,
  // web-remote phone app: WebSocket client + terminal renderer.
  'session-manager': 1_300_000,
  // Godot web game: ~10 MB gz wasm engine + game pck.
  'escape-velocity': 30_000_000,
});

export function budgetFor(slug: string): number {
  return APP_BUDGETS_GZ_BYTES[slug] ?? DEFAULT_BUDGET_GZ_BYTES;
}
