import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MCP_DIR = join(ROOT, 'mcp-host-server');
const SRC_DIR = join(MCP_DIR, 'src');
const DIST_DIR = join(MCP_DIR, 'dist');
const TSCONFIG_PATH = join(MCP_DIR, 'tsconfig.json');

function compileSrcToTmpDir(): { outDir: string; emittedFiles: string[] } {
  const configFile = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  }
  const outDir = mkdtempSync(join(tmpdir(), 'mcp-dist-sync-'));
  const parsed = ts.parseJsonConfigFileContent(
    { ...configFile.config, compilerOptions: { ...configFile.config.compilerOptions, outDir } },
    ts.sys,
    MCP_DIR,
  );

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });

  const emittedFiles: string[] = [];
  const emitResult = program.emit(undefined, (fileName, data) => {
    ts.sys.writeFile(fileName, data);
    emittedFiles.push(fileName);
  });

  if (emitResult.emitSkipped) {
    throw new Error('tsc emit was skipped while compiling mcp-host-server/src');
  }

  return { outDir, emittedFiles };
}

function listRelativeJsFiles(dir: string): string[] {
  const results: string[] = [];
  const collect = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        collect(full);
      } else if (name.endsWith('.js')) {
        results.push(relative(dir, full));
      }
    }
  };
  collect(dir);
  return results.sort();
}

describe('mcp-host-server dist/ stays in sync with src/', () => {
  it('dist/ bytes match a fresh compile of src/', () => {
    const { outDir } = compileSrcToTmpDir();
    try {
      const freshFiles = listRelativeJsFiles(outDir);
      const committedFiles = listRelativeJsFiles(DIST_DIR);

      expect(freshFiles).toEqual(committedFiles);

      for (const relPath of freshFiles) {
        const fresh = readFileSync(join(outDir, relPath), 'utf8');
        const committed = readFileSync(join(DIST_DIR, relPath), 'utf8');
        expect(committed, `dist/${relPath} is stale relative to src/`).toBe(fresh);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('node dist/server.js starts without a module-resolution or syntax error', async () => {
    const sdkPresent = existsSync(join(MCP_DIR, 'node_modules', '@modelcontextprotocol'));
    if (!sdkPresent) {
      console.log(
        'Skipping dist/server.js boot check: mcp-host-server/node_modules/@modelcontextprotocol is absent',
      );
      return;
    }

    const serverPath = join(DIST_DIR, 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      cwd: MCP_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const exitInfo = await new Promise<{ code: number | null; signal: string | null }>(
      (resolvePromise) => {
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
        }, 5000);
        child.on('exit', (code, signal) => {
          clearTimeout(timer);
          resolvePromise({ code, signal });
        });
      },
    );

    expect(stderr).not.toMatch(/ERR_MODULE_NOT_FOUND/);
    expect(stderr).not.toMatch(/SyntaxError/);
    // Either it exited on its own, or we killed it after 5s of staying up — both are fine.
    expect(exitInfo.signal === 'SIGTERM' || exitInfo.code === 0 || exitInfo.code === null).toBe(
      true,
    );
  }, 10_000);
});
