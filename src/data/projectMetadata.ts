import { ListingSchema } from '../../mcp-host-server/src/contract/registry.js';
import type { Project } from './projectsRegistry.js';

export interface MetadataRow {
  key: string;
  value: string;
  missing: boolean;
}

function row(key: string, raw: unknown): MetadataRow {
  let value = '';
  if (Array.isArray(raw)) {
    const multiline = key === 'listing.talkingPoints' || key === 'listing.avoidClaims';
    value = raw.map(String).join(multiline ? '\n' : ' · ');
  } else if (raw !== undefined && raw !== null) {
    value = String(raw);
  }
  return { key, value, missing: value === '' };
}

/** Every registry field for a project, in display order; absent values are flagged `missing`. */
export function projectMetadataRows(p: Project): MetadataRow[] {
  const host = p.host as { kind: string; path?: string; url?: string; sourceRepo?: string; localPath?: string };
  const listing = (p.listing ?? {}) as Record<string, unknown>;
  return [
    row('slug', p.slug),
    row('name', p.name),
    row('displayName', p.displayName),
    row('tagline', p.tagline),
    row('category', p.category),
    row('status', p.status),
    row('year', p.year),
    row('launchedAt', (p as { launchedAt?: string }).launchedAt),
    row('public', p.public),
    row('tags', p.tags),
    row('host.kind', host.kind),
    host.url !== undefined && host.path === undefined ? row('host.url', host.url) : row('host.path', host.path),
    row('host.sourceRepo', host.sourceRepo),
    row('host.localPath', host.localPath),
    row('thumbnail', p.thumbnail),
    ...ListingSchema.keyof().options.map(k => row(`listing.${k}`, listing[k])),
  ];
}
