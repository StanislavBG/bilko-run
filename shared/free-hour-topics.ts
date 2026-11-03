export const FREE_HOUR_TOPICS = ['New idea', 'Existing repo', "Something's broken", 'Not sure yet'] as const;

/** undefined/null -> []; unique allowlisted strings -> in allowlist order; anything else -> null. */
export function parseTopicTags(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > FREE_HOUR_TOPICS.length) return null;
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== 'string' || !(FREE_HOUR_TOPICS as readonly string[]).includes(t) || seen.has(t)) return null;
    seen.add(t);
  }
  return FREE_HOUR_TOPICS.filter((t) => seen.has(t));
}
