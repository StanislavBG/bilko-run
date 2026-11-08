// MCP tool results: plain text, or an error flagged isError with an "ERROR: " prefix.

export function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function err(text: string) {
  return { content: [{ type: 'text' as const, text: `ERROR: ${text}` }], isError: true };
}
