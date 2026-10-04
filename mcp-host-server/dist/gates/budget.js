import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { budgetFor } from '../contract/app-budgets.js';
function measureGzBytes(dir) {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            total += measureGzBytes(full);
        }
        else if (entry.isFile()) {
            total += gzipSync(readFileSync(full)).length;
        }
    }
    return total;
}
export const budgetGate = async (ctx) => {
    if (!ctx.manifest)
        return { name: 'budget', status: 'fail', details: 'manifest not loaded' };
    const limit = budgetFor(ctx.slug);
    const measured = measureGzBytes(ctx.bundleDir);
    const reported = ctx.manifest.bundle.sizeBytesGz;
    const measuredKb = (measured / 1024).toFixed(1);
    const reportedKb = (reported / 1024).toFixed(1);
    const limitKb = (limit / 1024).toFixed(0);
    if (measured > limit) {
        return {
            name: 'budget', status: 'fail',
            details: `measured ${measuredKb} KB gz (manifest reported ${reportedKb} KB) exceeds budget ${limitKb} KB`,
        };
    }
    return {
        name: 'budget', status: 'pass',
        details: `measured ${measuredKb} KB gz (manifest reported ${reportedKb} KB) / ${limitKb} KB budget`,
    };
};
