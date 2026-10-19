/** Human-readable byte size: B, KB, MB, GB. */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Local date-time with zone abbreviation; '—' for a missing (<= 0) timestamp. */
export const fmtTime = (ts: number) =>
  ts > 0 ? new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' }) : '—';

/** First 8 characters of a long id, followed by an ellipsis. */
export const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

/** Milliseconds as m:ss. */
export const fmtMmSs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
