import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.js');

describe('bilko-host-kit emit-manifest', () => {
  it('writes dist/manifest.json matching the schema', () => {
    const dir = join(tmpdir(), `manifest-cli-${Date.now()}`);
    mkdirSync(join(dir, 'dist'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'my-game',
        version: '1.2.3',
        dependencies: { '@bilkobibitkov/host-kit': '^0.7.0' },
      }),
    );
    writeFileSync(join(dir, 'dist/index.js'), 'console.log("hi")');

    const result = spawnSync('node', [CLI, '--slug', 'my-game'], { cwd: dir });
    expect(result.status, result.stderr?.toString()).toBe(0);

    const manifest = JSON.parse(readFileSync(join(dir, 'dist/manifest.json'), 'utf8'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.slug).toBe('my-game');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.hostKit.version).toBe('0.7.0');
    expect(manifest.bundle.fileCount).toBeGreaterThan(0);
    expect(typeof manifest.bundle.sizeBytesGz).toBe('number');
    expect(manifest.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('exits with code 2 when --slug is missing', () => {
    const result = spawnSync('node', [CLI], { cwd: tmpdir() });
    expect(result.status).toBe(2);
  });
});
