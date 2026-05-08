import { ManifestSchema } from '../manifest-schema.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const manifestGate = async (ctx) => {
    const path = join(ctx.bundleDir, 'manifest.json');
    let raw;
    try {
        raw = await readFile(path, 'utf8');
    }
    catch {
        return {
            name: 'manifest', status: 'fail',
            details: `manifest.json missing at ${path}. See docs/host-contract.md "Manifest contract".`,
        };
    }
    if (raw.length > 16_000) {
        return { name: 'manifest', status: 'fail', details: `manifest.json too large: ${raw.length} bytes` };
    }
    const parsed = ManifestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        return { name: 'manifest', status: 'fail', details: `manifest schema errors: ${issues}` };
    }
    if (parsed.data.slug !== ctx.slug) {
        return {
            name: 'manifest', status: 'fail',
            details: `manifest slug "${parsed.data.slug}" ≠ registered slug "${ctx.slug}"`,
        };
    }
    ctx.manifest = parsed.data;
    return { name: 'manifest', status: 'pass', details: `v${parsed.data.version} / sha ${parsed.data.gitSha}` };
};
