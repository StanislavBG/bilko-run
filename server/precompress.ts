import { createBrotliCompress, createGzip, constants } from 'zlib';
import { createReadStream, createWriteStream, readdirSync, rmSync, statSync } from 'fs';
import { availableParallelism } from 'os';
import { extname, join } from 'path';
import { pipeline } from 'stream/promises';

/**
 * Build-time `.br` / `.gz` siblings for the dist tree, served by
 * `@fastify/static`'s `preCompressed` option.
 *
 * Without them @fastify/compress re-compresses every response on the fly. For
 * a Godot web build that meant ~61 MB brotli-encoded per page load on the
 * origin's CPU: 2–6 s to first byte, ~3 MB/s, no Content-Length, and a
 * download slow enough to still be in flight when a deploy stopped the old
 * instance. A precompressed file is a plain disk read with a Content-Length
 * (escape-velocity's 39.5 MB wasm ships as 7.9 MB of brotli).
 *
 * The step owns every `.br`/`.gz` that sits next to a real file: it deletes
 * them and writes fresh ones, so a stale variant a sibling app published
 * can never be served in place of its newer source.
 *
 * HTML never gets a variant. The CSP-nonce, OG and click-beacon onSend hooks
 * rewrite HTML as text; a precompressed HTML stream would reach them as
 * brotli bytes and come out corrupted.
 */

/** Types worth shipping precompressed (mime-db marks all of them compressible). */
const PRECOMPRESS_EXT = new Set([
  '.js', '.mjs', '.cjs', '.css', '.json', '.map', '.svg', '.txt', '.xml',
  '.csv', '.md', '.webmanifest', '.wasm', '.pck', '.data', '.glb', '.gltf',
]);
const HTML_EXT = new Set(['.html', '.htm']);

/** Same floor as @fastify/compress's threshold: below it framing outweighs savings. */
export const PRECOMPRESS_MIN_BYTES = 1024;

/**
 * Brotli quality by input size. Measured on escape-velocity's 39.5 MB wasm:
 * q5 → 7.9 MB in 3.5 s, q9 → 7.5 MB in 23 s, q11 → 6.6 MB in 162 s. Every
 * deploy pays this, so big files get q5 and only small ones get q11.
 */
export function brotliQuality(bytes: number): number {
  if (bytes <= 1 << 20) return 11;
  if (bytes <= 8 << 20) return 9;
  return 5;
}

export function isPrecompressible(filePath: string, bytes: number): boolean {
  return bytes >= PRECOMPRESS_MIN_BYTES && PRECOMPRESS_EXT.has(extname(filePath).toLowerCase());
}

export interface PrecompressResult {
  files: number;
  bytesIn: number;
  bytesBr: number;
  bytesGz: number;
  removed: number;
  ms: number;
}

async function writeVariants(file: string, bytes: number): Promise<{ br: number; gz: number }> {
  await pipeline(
    createReadStream(file),
    createBrotliCompress({
      params: {
        [constants.BROTLI_PARAM_QUALITY]: brotliQuality(bytes),
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes,
      },
    }),
    createWriteStream(`${file}.br`),
  );
  await pipeline(createReadStream(file), createGzip({ level: 9 }), createWriteStream(`${file}.gz`));
  return { br: statSync(`${file}.br`).size, gz: statSync(`${file}.gz`).size };
}

/** Rewrite every eligible file's `.br`/`.gz` siblings under `root`. */
export async function precompressTree(root: string): Promise<PrecompressResult> {
  const started = Date.now();
  const result: PrecompressResult = { files: 0, bytesIn: 0, bytesBr: 0, bytesGz: 0, removed: 0, ms: 0 };
  const todo: Array<{ file: string; bytes: number }> = [];

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const names = new Set(entries.map(e => e.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).toLowerCase();
      // A variant is ours only if its source file sits beside it; a lone
      // `archive.tar.gz` is content, not a variant, and is left alone.
      if ((ext === '.br' || ext === '.gz') && names.has(entry.name.slice(0, -ext.length))) {
        rmSync(full, { force: true });
        result.removed += 1;
        continue;
      }
      if (HTML_EXT.has(ext) || ext === '.br' || ext === '.gz') continue;
      const bytes = statSync(full).size;
      if (isPrecompressible(full, bytes)) todo.push({ file: full, bytes });
    }
  };
  walk(root);

  // Largest first so the long brotli jobs overlap with the small ones.
  todo.sort((a, b) => b.bytes - a.bytes);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < todo.length) {
      const { file, bytes } = todo[next++];
      const sizes = await writeVariants(file, bytes);
      result.files += 1;
      result.bytesIn += bytes;
      result.bytesBr += sizes.br;
      result.bytesGz += sizes.gz;
    }
  };
  const lanes = Math.max(1, Math.min(4, availableParallelism()));
  await Promise.all(Array.from({ length: lanes }, worker));

  result.ms = Date.now() - started;
  return result;
}
