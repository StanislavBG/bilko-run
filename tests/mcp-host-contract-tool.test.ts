import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHostContract } from '../mcp-host-server/src/host-contract.js';

let dir: string;
function makeRoot(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'host-contract-'));
  mkdirSync(join(dir, 'docs'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, 'docs', name), text);
  return dir;
}
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readHostContract', () => {
  it('returns the map before the contract when map.md exists', () => {
    const out = readHostContract(makeRoot({ 'map.md': 'MAP-TEXT', 'host-contract.md': 'CONTRACT-TEXT' }));
    expect(out.indexOf('MAP-TEXT')).toBeGreaterThanOrEqual(0);
    expect(out.indexOf('MAP-TEXT')).toBeLessThan(out.indexOf('CONTRACT-TEXT'));
  });

  it('returns only the contract when map.md is missing', () => {
    const out = readHostContract(makeRoot({ 'host-contract.md': 'CONTRACT-TEXT' }));
    expect(out).toBe('CONTRACT-TEXT');
  });
});
