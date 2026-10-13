import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertCallerOwnsSlug } from '../mcp-host-server/src/ownership.js';
import type { RegistryProject } from '../mcp-host-server/src/contract/registry.js';

function entry(localPath?: string): RegistryProject {
  return {
    slug: 'demo',
    host: { kind: 'static-path', path: '/projects/demo/', ...(localPath ? { localPath } : {}) },
  } as unknown as RegistryProject;
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('assertCallerOwnsSlug', () => {
  it('matches via ~ path', () => {
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.ownership-test-'));
    try {
      const tilde = '~/' + path.basename(dir);
      expect(() => assertCallerOwnsSlug(entry(tilde), dir)).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('matches via symlink', () => {
    const real = path.join(tmp, 'real');
    fs.mkdirSync(real);
    const link = path.join(tmp, 'link');
    fs.symlinkSync(real, link);
    expect(() => assertCallerOwnsSlug(entry(real), link)).not.toThrow();
  });

  it('throws on mismatch', () => {
    const a = path.join(tmp, 'a');
    const b = path.join(tmp, 'b');
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    expect(() => assertCallerOwnsSlug(entry(a), b)).toThrow(`"demo" is owned by ${a}; caller is ${b}`);
  });

  it('throws when localPath missing', () => {
    expect(() => assertCallerOwnsSlug(entry(), tmp)).toThrow(
      'slug "demo" has no host.localPath — ask the Bilko owner to bind it',
    );
  });

  it('throws when callerRepoPath missing', () => {
    expect(() => assertCallerOwnsSlug(entry(tmp), undefined)).toThrow('callerRepoPath is required to change "demo"');
    expect(() => assertCallerOwnsSlug(entry(tmp), '')).toThrow('callerRepoPath is required to change "demo"');
  });

  it('accepts trailing slash', () => {
    expect(() => assertCallerOwnsSlug(entry(tmp), tmp + '/')).not.toThrow();
  });
});
