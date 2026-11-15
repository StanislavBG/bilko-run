/**
 * Owner switches that list app ids in a comma-separated env var
 * (PLAY_CURRENCY_SALES_OPEN, ROOMS_OPEN). Reads process.env on every call so
 * a changed value takes effect without a restart in tests; entries are
 * trimmed and empty ones ignored.
 */
export function envListIncludes(name: string, value: string): boolean {
  const raw = process.env[name] ?? '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).includes(value);
}
