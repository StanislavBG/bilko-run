import { chmodSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// tsx's in-process loader (`node --import tsx`) only registers module hooks. The tsx CLI
// listens on a Unix socket, which sandboxes may forbid, so tests start scripts this way.
export const TSX_IMPORT: string = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

export function tsxNodeArgs(script: string, ...args: string[]): string[] {
  return ['--import', TSX_IMPORT, script, ...args];
}

/** Writes `<dir>/real-tsx`, an sh shim that runs tsx via the in-process loader. */
export function writeTsxShim(dir: string): string {
  const path = join(dir, 'real-tsx');
  writeFileSync(path, `#!/bin/sh\nexec "${process.execPath}" --import "${TSX_IMPORT}" "$@"\n`);
  chmodSync(path, 0o755);
  return path;
}

async function probeUnixSocket(): Promise<boolean> {
  const sock = join(tmpdir(), `probe-${process.pid}-${Math.random().toString(36).slice(2)}.sock`);
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(sock, () => {
      server.close(() => {
        try {
          unlinkSync(sock);
        } catch {
          /* already gone */
        }
        resolve(true);
      });
    });
  });
}

export const canListenUnixSocket: boolean = await probeUnixSocket();
