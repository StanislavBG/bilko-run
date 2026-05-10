import { z } from 'zod';

export const ALLOWED_MODELS = ['claude-haiku-4-5-latest', 'claude-sonnet-4-6-latest'] as const;

export const AskRequestSchema = z.object({
  user: z.string().min(1).max(8000),
  system: z.string().max(4000).optional(),
  model: z.enum(ALLOWED_MODELS).default('claude-haiku-4-5-latest'),
  lessonSlug: z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),
}).strict();

export type AskRequest = z.infer<typeof AskRequestSchema>;
