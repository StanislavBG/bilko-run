// MCP tool results: plain text, or an error flagged isError with an "ERROR: " prefix.
export function ok(text) {
    return { content: [{ type: 'text', text }] };
}
export function err(text) {
    return { content: [{ type: 'text', text: `ERROR: ${text}` }], isError: true };
}
