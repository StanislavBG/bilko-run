import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};
export const a11yGate = async (ctx) => {
    if (!ctx.manifest)
        return { name: 'a11y', status: 'fail', details: 'manifest not loaded' };
    // Dynamic import so the gate gracefully fails if playwright is not installed,
    // and so the mcp-host-server compiles without playwright in its own package.json.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chromium;
    try {
        const pw = await import('playwright');
        chromium = pw.chromium;
    }
    catch {
        return { name: 'a11y', status: 'fail', details: 'playwright not installed — run: pnpm add playwright' };
    }
    // Serve the staged bundle over HTTP so axe can load relative URLs.
    const server = createServer(async (req, res) => {
        const urlPath = (req.url ?? '/').split('?')[0];
        const filePath = join(ctx.bundleDir, urlPath === '/' ? 'index.html' : urlPath);
        try {
            const data = await readFile(filePath);
            res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
            res.end(data);
        }
        catch {
            try {
                const data = await readFile(join(ctx.bundleDir, 'index.html'));
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
            catch {
                res.writeHead(404);
                res.end('Not found');
            }
        }
    });
    const port = await new Promise(resolve => server.listen(0, () => {
        resolve(server.address().port);
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        // Strip /projects/<slug> prefix so the local server serves from its root.
        const goldenPath = ctx.manifest.golden.path.replace(/^\/projects\/[^/]+/, '') || '/';
        await page.goto(`http://127.0.0.1:${port}${goldenPath}`);
        await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js' });
        const violations = await page.evaluate(async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = await window.axe.run({ resultTypes: ['violations'] });
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
    }
    finally {
        await browser.close();
        server.close();
    }
};
