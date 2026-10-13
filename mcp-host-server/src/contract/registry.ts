import { z } from 'zod';

export const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/,
    'slug must be 2-40 chars of [a-z0-9-], no leading or trailing hyphen'
  );

export type Slug = z.infer<typeof SlugSchema>;

export const ProjectStatusSchema = z.enum(['live', 'cooking', 'postponed', 'archived']);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

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

export const ListingOfferingSchema = z.enum([
  'saas',
  'free-tool',
  'showcase',
  'open-source',
  'game',
  'content',
  'experiment',
]);

export const ListingPricingSchema = z.enum(['free', 'freemium', 'paid', 'none']);

export const ListingSchema = z
  .object({
    detail: z.string().min(1).max(400).optional(),
    metric: z.string().min(1).max(24).optional(),
    metricLabel: z.string().min(1).max(24).optional(),
    lang: z.string().min(1).max(40).optional(),
    audience: z.string().max(200).optional(),
    talkingPoints: z.array(z.string().min(1).max(200)).max(5).optional(),
    offering: ListingOfferingSchema.optional(),
    pricing: ListingPricingSchema.optional(),
    callToAction: z.string().min(1).max(120).optional(),
    avoidClaims: z.array(z.string().min(1).max(200)).max(5).optional(),
  })
  .strict();

export type Listing = z.infer<typeof ListingSchema>;

export const RegistryProjectSchema = z
  .object({
    slug: SlugSchema,
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(160),
    category: z.string().min(1).max(40),
    status: ProjectStatusSchema,
    year: z.number().int(),
    host: ProjectHostSchema,
    tags: z.array(z.string().min(1).max(24)).max(6).optional(),
    thumbnail: z
      .string()
      .refine((s) => s.startsWith('https://') || s.startsWith('/'), 'thumbnail must be https:// or a /path')
      .optional(),
    launchedAt: z.string().optional(),
    public: z.boolean().optional(),
    displayName: z.string().min(1).max(60).optional(),
    listing: ListingSchema.optional(),
  })
  .strict();

export type RegistryProject = z.infer<typeof RegistryProjectSchema>;

export const BANNED_LISTING_TERMS: RegExp[] = [/content-?grade/i];

function listingTextFields(entry: RegistryProject): Array<[string, string]> {
  const fields: Array<[string, string | undefined]> = [
    ['name', entry.name],
    ['displayName', entry.displayName],
    ['tagline', entry.tagline],
    ['category', entry.category],
  ];
  (entry.tags ?? []).forEach((t, i) => fields.push([`tags[${i}]`, t]));
  const l = entry.listing;
  if (l) {
    for (const k of ['detail', 'metric', 'metricLabel', 'lang', 'audience', 'callToAction'] as const) {
      fields.push([`listing.${k}`, l[k]]);
    }
    (l.talkingPoints ?? []).forEach((t, i) => fields.push([`listing.talkingPoints[${i}]`, t]));
    (l.avoidClaims ?? []).forEach((t, i) => fields.push([`listing.avoidClaims[${i}]`, t]));
  }
  return fields.filter((f): f is [string, string] => typeof f[1] === 'string');
}

export const RegistrySchema = z.array(RegistryProjectSchema).superRefine((entries, ctx) => {
  const seenSlugs = new Set<string>();

  entries.forEach((entry, index) => {
    if (seenSlugs.has(entry.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate slug "${entry.slug}"`,
        path: [index, 'slug'],
      });
    }
    seenSlugs.add(entry.slug);

    for (const [field, value] of listingTextFields(entry)) {
      if (BANNED_LISTING_TERMS.some((re) => re.test(value))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `slug "${entry.slug}" field "${field}" mentions a retired product (ContentGrade)`,
          path: [index, ...field.replace(/\[(\d+)\]/g, '.$1').split('.')],
        });
      }
    }

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
