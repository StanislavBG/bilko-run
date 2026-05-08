// Manifest schema for the bilko-host MCP server.
// Keep in sync with shared/manifest-schema.ts in the Bilko host repo.
import { z } from 'zod';
export const ManifestSchema = z.object({
    schemaVersion: z.literal(1),
    slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/),
    builtAt: z.string().datetime(),
    gitSha: z.string().regex(/^[a-f0-9]{7,40}$/),
    gitBranch: z.string().min(1).max(80),
    hostKit: z.object({
        version: z.string().regex(/^\d+\.\d+\.\d+/),
    }),
    golden: z.object({
        path: z.string().startsWith('/').max(500),
        expect: z.string().max(200).default(''),
    }),
    health: z.object({
        path: z.string().startsWith('/').max(500).optional(),
    }).default({}),
    bundle: z.object({
        sizeBytesGz: z.number().int().nonnegative(),
        fileCount: z.number().int().nonnegative(),
    }),
});
