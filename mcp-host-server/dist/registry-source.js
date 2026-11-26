/**
 * Where the bilko-host MCP's read tools get the registry from: bilko.run's
 * GET /api/admin/registry (Bilko-DB). No git command runs.
 */
import { readRegistry } from './registry-api.js';
// hostRoot is kept so existing callers need no change; the API does not use it.
export async function readLatestRegistryRaw(_hostRoot, opts = {}) {
    const entries = await (opts.read ?? readRegistry)();
    const versions = {};
    for (const e of entries)
        versions[String(e.entry.slug)] = e.version;
    return {
        raw: JSON.stringify(entries.map((e) => e.entry), null, 2) + '\n',
        source: 'api',
        ref: '/api/admin/registry',
        versions,
        entries,
    };
}
