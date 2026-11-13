// Pure path classifiers for the SPA fallback: which request paths are not app pages.

/** File extensions that only secret-file / exploit scanners request on this host (matched case-insensitively on the last segment). */
export const PROBE_EXTENSIONS: readonly string[] = [
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.bak', '.old', '.save', '.sql', '.ini', '.env',
];

/** Exact last-segment filenames scanners hunt for (config and credential files). */
export const PROBE_FILENAMES: readonly string[] = [
  'config.json', 'config.yml', 'config.yaml', 'secrets.json', 'credentials', 'credentials.json', 'docker-compose.yml',
];

function segmentsOf(path: unknown): string[] {
  if (typeof path !== 'string' || path === '') return [];
  const bare = path.split(/[?#]/, 1)[0];
  return bare.split('/').filter((s) => s !== '');
}

function probeSegments(segs: string[]): boolean {
  if (segs.length === 0) return false;
  if (segs.some((s) => s.startsWith('.') && s.toLowerCase() !== '.well-known')) return true;
  const last = segs[segs.length - 1].toLowerCase();
  if (PROBE_FILENAMES.includes(last)) return true;
  // .php.bak / .php.old / .php.save are covered since .bak, .old and .save are probe extensions too.
  return PROBE_EXTENSIONS.some((ext) => last.endsWith(ext));
}

/** True when the path looks like a secret-file or exploit scan (/.env, /.git/HEAD, /wp-config.php). */
export function isProbePath(path: string): boolean {
  return probeSegments(segmentsOf(path));
}

/** True when the path is a probe or a file request (last segment ends in .ext), i.e. never an SPA page. */
export function isNonPagePath(path: string): boolean {
  const segs = segmentsOf(path);
  if (segs.length === 0) return false;
  return probeSegments(segs) || /\.[A-Za-z0-9]{1,8}$/.test(segs[segs.length - 1]);
}
