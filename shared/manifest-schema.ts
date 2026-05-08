import { z } from 'zod';

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  slug:          z.string().regex(/^[a-z0-9-]{2,40}$/),
  version:       z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/),
  builtAt:       z.string().datetime(),
  gitSha:        z.string().regex(/^[a-f0-9]{7,40}$/),
  gitBranch:     z.string().min(1).max(80),
  hostKit: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+/),
  }),
  golden: z.object({
    path:   z.string().startsWith('/').max(500),
    expect: z.string().max(200).default(''),
  }),
  health: z.object({
    path: z.string().startsWith('/').max(500).optional(),
  }).default({}),
  bundle: z.object({
    sizeBytesGz: z.number().int().nonnegative(),
    fileCount:   z.number().int().nonnegative(),
  }),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function validateManifestRaw(raw: string): { ok: true; manifest: Manifest } | { ok: false; error: string } {
  if (raw.length > 16_000) {
    return { ok: false, error: `manifest.json too large (${raw.length} bytes; max 16384). Likely accidental data — review what your build script is writing.` };
  }
  try {
    const manifest = ManifestSchema.parse(JSON.parse(raw));
    return { ok: true, manifest };
  } catch (err: any) {
    return { ok: false, error: `manifest.json invalid: ${err.message ?? err}` };
  }
}

function parseSemver(v: string): [number, number, number] {
  const parts = v.replace(/^[^0-9]+/, '').split('.').map(n => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function computeDrift(appVer: string, latestVer: string): 'current' | 'minor_behind' | 'major_behind' {
  const [ma, mi] = parseSemver(appVer);
  const [la, li] = parseSemver(latestVer);
  if (ma === la && mi === li) return 'current';
  if (ma === la && li - mi === 1) return 'minor_behind';
  return 'major_behind';
}
