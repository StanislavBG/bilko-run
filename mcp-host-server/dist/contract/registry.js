import { z } from 'zod';
export const SlugSchema = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/, 'slug must be 2-40 chars of [a-z0-9-], no leading or trailing hyphen');
export const ProjectStatusSchema = z.enum(['live', 'cooking', 'postponed', 'archived']);
const StaticPathHostSchema = z
    .object({
    kind: z.literal('static-path'),
    path: z.string(),
    sourceRepo: z.string().optional(),
    localPath: z.string().optional(),
})
    .strict();
const ExternalUrlHostSchema = z
    .object({
    kind: z.literal('external-url'),
    url: z.string().url(),
    sourceRepo: z.string().optional(),
    localPath: z.string().optional(),
})
    .strict();
export const ProjectHostSchema = z.discriminatedUnion('kind', [
    StaticPathHostSchema,
    ExternalUrlHostSchema,
]);
export const RegistryProjectSchema = z
    .object({
    slug: SlugSchema,
    name: z.string(),
    tagline: z.string(),
    category: z.string(),
    status: ProjectStatusSchema,
    year: z.number().int(),
    host: ProjectHostSchema,
    tags: z.array(z.string()).optional(),
    thumbnail: z.string().optional(),
    launchedAt: z.string().optional(),
    public: z.boolean().optional(),
    displayName: z.string().min(1).max(60).optional(),
})
    .strict();
export const RegistrySchema = z.array(RegistryProjectSchema).superRefine((entries, ctx) => {
    const seenSlugs = new Set();
    entries.forEach((entry, index) => {
        if (seenSlugs.has(entry.slug)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `duplicate slug "${entry.slug}"`,
                path: [index, 'slug'],
            });
        }
        seenSlugs.add(entry.slug);
        if (entry.host.kind === 'static-path') {
            const expectedPath = `/projects/${entry.slug}/`;
            if (entry.host.path !== expectedPath) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `slug "${entry.slug}" has static-path host.path "${entry.host.path}", expected "${expectedPath}"`,
                    path: [index, 'host', 'path'],
                });
            }
        }
        if (entry.host.kind === 'external-url' && !entry.host.url.startsWith('https://')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `slug "${entry.slug}" has external-url host.url "${entry.host.url}" which is not https`,
                path: [index, 'host', 'url'],
            });
        }
    });
});
