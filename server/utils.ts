/** Parse a JSON response from Gemini — tries direct parse, falls back to regex extraction. */
export function parseJsonResponse(raw: string): any {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not parse analysis response.');
  return JSON.parse(m[0]);
}
