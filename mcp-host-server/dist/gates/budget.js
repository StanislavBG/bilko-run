import { mcpGet } from '../db.js';
export const budgetGate = async (ctx) => {
    if (!ctx.manifest)
        return { name: 'budget', status: 'fail', details: 'manifest not loaded' };
    const row = await mcpGet(`SELECT max_size_gz_bytes FROM app_budgets WHERE slug = ?`, [ctx.slug]);
    const limit = row?.max_size_gz_bytes ?? 200_000;
    const actual = ctx.manifest.bundle.sizeBytesGz;
    if (actual > limit) {
        return {
            name: 'budget', status: 'fail',
            details: `bundle ${(actual / 1024).toFixed(1)} KB gz exceeds budget ${(limit / 1024).toFixed(0)} KB`,
        };
    }
    return {
        name: 'budget', status: 'pass',
        details: `${(actual / 1024).toFixed(1)} KB gz / ${(limit / 1024).toFixed(0)} KB budget`,
    };
};
