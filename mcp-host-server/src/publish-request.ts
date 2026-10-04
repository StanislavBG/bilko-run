import { resolve, sep } from 'node:path';
import { SlugSchema, RegistrySchema, type RegistryProject } from './contract/registry.js';

export type GateName = 'budget' | 'golden' | 'a11y' | 'audit';

const GATE_NAMES: ReadonlySet<string> = new Set<GateName>(['budget', 'golden', 'a11y', 'audit']);

const MIN_BYPASS_REASON_LENGTH = 15;

export function projectDir(publicProjectsRoot: string, slug: string): string {
  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) {
    throw new Error(`invalid slug "${slug}": ${parsed.error.issues[0]?.message ?? 'does not match SlugSchema'}`);
  }

  const root = resolve(publicProjectsRoot);
  const dir = resolve(root, parsed.data);
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw new Error(`slug "${slug}" resolves outside the public projects root (${dir})`);
  }
  return dir;
}

export function parseBypass(
  bypass: string | undefined,
  reason: string | undefined,
): { gates: Set<GateName> } | { error: string } {
  const names = (bypass ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return { gates: new Set() };
  }

  if (names.includes('manifest')) {
    return { error: 'the manifest gate cannot be bypassed' };
  }

  for (const name of names) {
    if (!GATE_NAMES.has(name)) {
      return { error: `unknown gate name "${name}" — valid gates: ${[...GATE_NAMES].join(', ')}` };
    }
  }

  if (!reason || reason.trim().length < MIN_BYPASS_REASON_LENGTH) {
    return { error: `bypassReason is required (at least ${MIN_BYPASS_REASON_LENGTH} chars) when bypassing a gate` };
  }

  return { gates: new Set(names as GateName[]) };
}

export function parseRegistry(raw: string): RegistryProject[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e: unknown) {
    throw new Error(`registry is not valid JSON: ${(e as Error).message}`);
  }

  const result = RegistrySchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path ?? [];
    const index = typeof path[0] === 'number' ? path[0] : undefined;
    const slug =
      index !== undefined && Array.isArray(data) && typeof data[index]?.slug === 'string'
        ? data[index].slug
        : 'unknown';
    const field = path.slice(1).join('.') || 'unknown';
    throw new Error(`invalid registry entry (slug "${slug}", field "${field}"): ${issue?.message ?? 'validation failed'}`);
  }

  return result.data;
}
