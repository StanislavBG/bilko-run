import type { Gate } from './index.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt':  'text/plain',
  '.map':  'application/json',
};

export async function startBundleServer(
  bundleDir: string,
  slug: string,
): Promise<{ port: number; close(): Promise<void> }> {
  const resolvedBundleDir = resolve(bundleDir);
  const prefix = new RegExp(`^/projects/${slug}(?=/|$)`);

  const server = createServer(async (req, res) => {
    const rawPath = (req.url ?? '/').split('?')[0];
    const strippedPath = decodeURIComponent(rawPath).replace(prefix, '') || '/';
    const requestPath = strippedPath === '/' ? 'index.html' : strippedPath.replace(/^\//, '');
    const filePath = resolve(resolvedBundleDir, requestPath);

    if (filePath !== resolvedBundleDir && !filePath.startsWith(resolvedBundleDir + sep)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const hasExtension = extname(filePath) !== '';
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      if (hasExtension) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      try {
        const data = await readFile(join(resolvedBundleDir, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  const port = await new Promise<number>(resolve => server.listen(0, () => {
    resolve((server.address() as { port: number }).port);
  }));

  return {
    port,
    close: () => new Promise<void>(resolveClose => server.close(() => resolveClose())),
  };
}

export const a11yGate: Gate = async (ctx) => {
  if (!ctx.manifest) return { name: 'a11y', status: 'fail', details: 'manifest not loaded' };

  // Dynamic import so the gate gracefully fails if Playwright is not installed,
  // and so the mcp-host-server compiles without it in its own package.json.
  //
  // The host repo depends on `@playwright/test`, NOT the bare `playwright`
  // package — importing only 'playwright' made this gate fail 100% of the time
  // with "playwright not installed", blocking every publish that reached it.
  // `@playwright/test` re-exports the same browser launchers, so try both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chromium: any;
  for (const mod of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pw: any = await import(/* @vite-ignore */ mod);
      if (pw?.chromium) { chromium = pw.chromium; break; }
    } catch { /* try the next candidate */ }
  }
  if (!chromium) {
    return {
      name: 'a11y', status: 'fail',
      details: 'Playwright not installed — run: pnpm add -D @playwright/test && pnpm exec playwright install chromium',
    };
  }

  let axePath: string;
  try {
    axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  } catch {
    return {
      name: 'a11y', status: 'fail',
      details: 'axe-core not installed — run: pnpm add -D axe-core',
    };
  }

  // Serve the staged bundle over HTTP so axe can load relative URLs.
  const { port, close } = await startBundleServer(ctx.bundleDir, ctx.slug);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser: any = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Strip /projects/<slug> prefix so the local server serves from its root.
    const goldenPath = ctx.manifest.golden.path.replace(/^\/projects\/[^/]+/, '') || '/';
    await page.goto(`http://127.0.0.1:${port}${goldenPath}`, { timeout: 30_000 });
    await page.addScriptTag({ path: axePath });
    type AxeViolation = { id: string; impact: string; help: string; nodes: unknown[] };
    const violations: AxeViolation[] = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (window as any).axe.run({ resultTypes: ['violations'] });
      return r.violations;
    });
    const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length > 0) {
      return {
        name: 'a11y', status: 'fail',
        details: `${serious.length} serious/critical: ${serious.slice(0, 3).map(v => v.id).join(', ')}`,
        data: { violations: serious.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })) },
      };
    }
    return { name: 'a11y', status: 'pass', details: `0 serious, ${violations.length - serious.length} minor` };
  } finally {
    await browser.close();
    await close();
  }
};
