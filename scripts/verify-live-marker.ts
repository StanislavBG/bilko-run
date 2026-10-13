#!/usr/bin/env node
// Usage: pnpm exec tsx scripts/verify-live-marker.ts <marker> [--tries N] [--interval S]
// Polls the live bundle (assets referenced from the home page) until one contains <marker>.
const BASE = process.env.BILKO_BASE ?? 'https://bilko.run';
const TIMEOUT_MS = 15_000;

function parseArgs(argv: string[]) {
  let marker = '';
  let tries = 20;
  let interval = 30;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tries') tries = Number(argv[++i]);
    else if (a === '--interval') interval = Number(argv[++i]);
    else if (!marker) marker = a;
  }
  if (!marker || !Number.isFinite(tries) || tries < 1 || !Number.isFinite(interval) || interval < 0) {
    console.error('usage: verify-live-marker.ts <marker> [--tries N] [--interval S]');
    process.exit(2);
  }
  return { marker, tries, interval };
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function attempt(marker: string): Promise<{ hit?: string; note: string }> {
  const html = await getText(`${BASE}/`);
  const urls = [...new Set(html.match(/\/assets\/[^"'\s)]+?\.(?:js|css)/g) ?? [])];
  if (urls.length === 0) return { note: 'no /assets/*.js|css URLs in HTML' };
  for (const path of urls) {
    try {
      if ((await getText(new URL(path, BASE).toString())).includes(marker)) return { hit: path, note: '' };
    } catch (err) {
      console.log(`  asset fetch failed: ${(err as Error).message}`);
    }
  }
  return { note: `marker not in ${urls.length} assets` };
}

async function main() {
  const { marker, tries, interval } = parseArgs(process.argv.slice(2));
  let last = '';
  for (let n = 1; n <= tries; n++) {
    try {
      const r = await attempt(marker);
      if (r.hit) {
        console.log(`OK: marker "${marker}" found in ${r.hit} (try ${n}/${tries})`);
        return;
      }
      last = r.note;
    } catch (err) {
      last = (err as Error).message;
    }
    console.log(`try ${n}/${tries}: ${last}`);
    if (n < tries) await new Promise((r) => setTimeout(r, interval * 1000));
  }
  console.error(`FAIL: marker "${marker}" not live after ${tries} tries (${last})`);
  process.exit(1);
}

main();
