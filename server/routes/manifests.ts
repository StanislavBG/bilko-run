import type { FastifyInstance } from 'fastify';
import { dbAll } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { computeDrift } from '../../shared/manifest-schema.js';

interface ManifestRow {
  slug: string;
  app_version: string;
  host_kit_version: string;
  git_sha: string;
  git_branch: string;
  built_at: string;
  bundle_size_gz: number;
  bundle_files: number;
  golden_path: string;
  updated_at: number;
}

function latestVersion(versions: string[]): string {
  let best = '0.0.0';
  for (const v of versions) {
    const clean = v.replace(/^[^0-9]+/, '');
    const [ma, mi, pa] = clean.split('.').map(n => parseInt(n, 10) || 0);
    const [la, li, lp] = best.split('.').map(n => parseInt(n, 10) || 0);
    if (ma > la || (ma === la && mi > li) || (ma === la && mi === li && pa > lp)) {
      best = `${ma}.${mi}.${pa}`;
    }
  }
  return best;
}

export function registerManifestsRoutes(app: FastifyInstance): void {
  app.get('/api/admin/manifests', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const rows = await dbAll<ManifestRow>(
      'SELECT slug, app_version, host_kit_version, git_sha, git_branch, built_at, bundle_size_gz, bundle_files, golden_path, updated_at FROM app_manifests ORDER BY updated_at DESC',
    );

    const kitVersions = rows.map(r => r.host_kit_version).filter(v => v && v !== '0.0.0');
    const latestKit = latestVersion(kitVersions.length ? kitVersions : ['0.0.0']);

    const manifests = rows.map(r => ({
      slug: r.slug,
      version: r.app_version,
      hostKitVersion: r.host_kit_version,
      hostKitDrift: computeDrift(r.host_kit_version, latestKit),
      gitSha: r.git_sha,
      gitBranch: r.git_branch,
      builtAt: r.built_at,
      bundleSizeKb: (r.bundle_size_gz / 1024).toFixed(1),
      bundleFiles: r.bundle_files,
      goldenPath: r.golden_path,
      updatedAt: new Date(r.updated_at * 1000).toISOString(),
    }));

    return reply.send({ manifests, latestKitVersion: latestKit });
  });
}
