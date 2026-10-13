import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'fs';
import { resolve, sep } from 'path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read a project's PNG asset from its own published folder. Returns null on any
 * problem (escape, missing, too large, not a PNG) so callers can fall back.
 */
export function readProjectPng(
  staticRoot: string,
  slug: string,
  assetPath: string,
  maxBytes: number,
): { bytes: Buffer; width: number; height: number } | null {
  const base = resolve(staticRoot, 'projects', slug);
  const file = resolve(staticRoot, assetPath.replace(/^\/+/, ''));
  if (!file.startsWith(base + sep)) return null;
  let fd: number | undefined;
  try {
    fd = openSync(file, 'r');
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > maxBytes || st.size < 24) return null;
    const head = Buffer.alloc(24);
    readSync(fd, head, 0, 24, 0);
    if (!head.subarray(0, 8).equals(PNG_SIG) || head.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
    const width = head.readUInt32BE(16);
    const height = head.readUInt32BE(20);
    return { bytes: readFileSync(file), width, height };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
