import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { RegistryProject } from './contract/registry.js';

function canonical(p: string): string {
  const expanded = p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
  const abs = path.resolve(expanded);
  try {
    return fs.realpathSync(abs);
  } catch {
    return abs;
  }
}

/** Throws unless callerRepoPath is the same directory as the entry's host.localPath. */
export function assertCallerOwnsSlug(entry: RegistryProject, callerRepoPath: string | undefined): void {
  const localPath = entry.host.localPath;
  if (!localPath) {
    throw new Error(`slug "${entry.slug}" has no host.localPath — ask the Bilko owner to bind it`);
  }
  if (!callerRepoPath || !callerRepoPath.trim()) {
    throw new Error(`callerRepoPath is required to change "${entry.slug}"`);
  }
  if (canonical(localPath) !== canonical(callerRepoPath)) {
    throw new Error(`"${entry.slug}" is owned by ${localPath}; caller is ${callerRepoPath}`);
  }
}
