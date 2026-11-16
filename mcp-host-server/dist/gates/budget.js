import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { validShareAssetFiles } from './share-assets.js';
/** GitHub rejects any pushed file over 100 MiB; the publish pushes the bundle to GitHub. */
export const GITHUB_FILE_LIMIT_BYTES = 100 * 1024 * 1024;
function measure(root, dir, exclude, m) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            measure(root, full, exclude, m);
            continue;
        }
        if (!entry.isFile())
            continue;
        const rel = relative(root, full).split(sep).join('/');
        const size = statSync(full).size;
        m.fileCount += 1;
        if (size > m.largestBytes || m.largestPath === '') {
            m.largestBytes = size;
            m.largestPath = rel;
        }
        if (size > GITHUB_FILE_LIMIT_BYTES) {
            // Never read or gzip a file GitHub will reject anyway.
            m.tooBig.push({ path: rel, bytes: size });
            continue;
        }
        if (!exclude.has(resolve(full)))
            m.gzBytes += gzipSync(readFileSync(full)).length;
    }
}
const kb = (bytes) => (bytes / 1024).toFixed(1);
const mib = (bytes) => (bytes / 1048576).toFixed(1);
// Owner decision 2026-11-15: no per-app size budgets. Add a size limit here only for a
// concrete host-side constraint, as GitHub's per-file push limit is.
export const budgetGate = async (ctx) => {
    if (!ctx.manifest)
        return { name: 'budget', status: 'fail', details: 'manifest not loaded' };
    // Valid declared icon/shareImage/video files are reported separately (the share-assets gate caps them).
    const shareAssets = validShareAssetFiles(ctx);
    const m = { gzBytes: 0, fileCount: 0, largestBytes: 0, largestPath: '', tooBig: [] };
    measure(ctx.bundleDir, ctx.bundleDir, shareAssets, m);
    if (m.tooBig.length > 0) {
        const first = m.tooBig[0];
        return {
            name: 'budget', status: 'fail',
            details: `${first.path} is ${mib(first.bytes)} MiB; GitHub rejects files over 100 MiB, so this bundle cannot be pushed`,
        };
    }
    const excluded = shareAssets.size > 0 ? `, excluding ${shareAssets.size} share asset(s)` : '';
    const largest = m.largestPath === '' ? '(none) 0.0' : `${m.largestPath} ${mib(m.largestBytes)}`;
    return {
        name: 'budget', status: 'pass',
        details: `measured ${kb(m.gzBytes)} KB gz over ${m.fileCount} files${excluded} (manifest reported ${kb(ctx.manifest.bundle.sizeBytesGz)} KB); largest file ${largest} MiB; no size budget, only GitHub's 100 MiB per-file limit`,
    };
};
