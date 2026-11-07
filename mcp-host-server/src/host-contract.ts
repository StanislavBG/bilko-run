import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// A whole-line HTML comment, such as the map's md-network-map maintainer note. Claude Code drops
// these when CLAUDE.md imports the map, so siblings get the map without them too.
const LINE_COMMENT = /^[ \t]*<!--(?:(?!-->)[\s\S])*-->[ \t]*(?:\r?\n|$)/gm;

/** docs/map.md minus whole-line HTML comments, a separator, then docs/host-contract.md; the contract alone when map.md is missing. */
export function readHostContract(hostRoot: string): string {
  const contract = readFileSync(resolve(hostRoot, 'docs/host-contract.md'), 'utf8');
  const mapPath = resolve(hostRoot, 'docs/map.md');
  if (!existsSync(mapPath)) return contract;
  return `${readFileSync(mapPath, 'utf8').replace(LINE_COMMENT, '')}\n\n---\n\n${contract}`;
}
