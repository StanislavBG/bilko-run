import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Persona checks for tests (docs/identity-boundary.md). The forbidden strings never go in
// this repo, tests included, so they come from CI's IDENTITY_DENYLIST secret or the local
// deny-list the guard reads. With neither there is nothing to check, as in the guard.
function denylist(): string[] {
  const file = process.env.BILKO_IDENTITY_DENYLIST ?? join(homedir(), '.config/bilko/identity-denylist');
  const raw = process.env.IDENTITY_DENYLIST || (existsSync(file) ? readFileSync(file, 'utf8') : '');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.toLowerCase().replace(/^word:/, ''));
}

// Deny-list entry numbers found in `text`, for expect(...).toEqual([]). Numbers, because a
// failing test prints this value. A word: entry counts as a substring here: guarded output
// should not carry a longer word that holds it either.
export function identityHits(text: string): number[] {
  const lower = text.toLowerCase();
  return denylist().flatMap((entry, i) => (entry && lower.includes(entry) ? [i + 1] : []));
}
