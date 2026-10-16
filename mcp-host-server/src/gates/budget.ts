import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Gate } from './index.js';
import { budgetFor } from '../contract/app-budgets.js';
import { validShareAssetFiles } from './share-assets.js';

function measureGzBytes(dir: string, exclude: Set<string>): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += measureGzBytes(full, exclude);
    } else if (entry.isFile() && !exclude.has(resolve(full))) {
      total += gzipSync(readFileSync(full)).length;
    }
  }
  return total;
}

export const budgetGate: Gate = async (ctx) => {
  if (!ctx.manifest) return { name: 'budget', status: 'fail', details: 'manifest not loaded' };

  const limit = budgetFor(ctx.slug);
  // Valid declared icon/shareImage files are capped by the share-assets gate, not this budget.
  const shareAssets = validShareAssetFiles(ctx);
  const measured = measureGzBytes(ctx.bundleDir, shareAssets);
  const reported = ctx.manifest.bundle.sizeBytesGz;
  const measuredKb = (measured / 1024).toFixed(1);
  const reportedKb = (reported / 1024).toFixed(1);
  const limitKb = (limit / 1024).toFixed(0);
  const excluded = shareAssets.size > 0 ? `, excluding ${shareAssets.size} share asset(s)` : '';

  if (measured > limit) {
    return {
      name: 'budget', status: 'fail',
      details: `measured ${measuredKb} KB gz${excluded} (manifest reported ${reportedKb} KB) exceeds budget ${limitKb} KB`,
    };
  }
  return {
    name: 'budget', status: 'pass',
    details: `measured ${measuredKb} KB gz${excluded} (manifest reported ${reportedKb} KB) / ${limitKb} KB budget`,
  };
};
