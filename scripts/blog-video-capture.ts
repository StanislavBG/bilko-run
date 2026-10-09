// Blog Video capture primitive: drive headless Chromium against the live product pages a post
// links to and save compressed 1280x720 JPEG screenshots the Blog Video skill embeds as data: URIs.
// Usage: pnpm tsx scripts/blog-video-capture.ts --shots <file.json> --out <dir> [--max-bytes 220000]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ShotAction = { click: string } | { fill: [string, string] } | { press: string } | { wait: number };

export interface Shot {
  name: string;
  url: string;
  scrollY?: number;
  waitMs?: number;
  actions?: ShotAction[];
}

const MAX_SHOTS = 6;
const MAX_ACTIONS = 5;
const MAX_WAIT_MS = 10_000;
const NAME_RE = /^[a-z0-9-]{1,40}$/;
const ALLOWED_ORIGINS = new Set(['https://bilko.run', 'https://github.com']);
const QUALITY_LADDER = [80, 70, 60, 50, 40];
const DEFAULT_MAX_BYTES = 220_000;
const GOTO_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 10_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkWait(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_WAIT_MS) {
    throw new Error(`${label} must be a number between 0 and ${MAX_WAIT_MS}`);
  }
  return value;
}

function checkUrl(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label}: url must be a string`);
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`${label}: url is not a valid URL`);
  }
  if (u.username || u.password) throw new Error(`${label}: url must not contain credentials`);
  if (!ALLOWED_ORIGINS.has(u.origin)) {
    throw new Error(`${label}: url origin must be https://bilko.run or https://github.com`);
  }
  return value;
}

function parseAction(raw: unknown, label: string): ShotAction {
  if (!isObject(raw)) throw new Error(`${label}: action must be an object`);
  const keys = Object.keys(raw);
  if (keys.length !== 1) throw new Error(`${label}: action must have exactly one key`);
  const key = keys[0];
  const v = raw[key];
  switch (key) {
    case 'click':
    case 'press':
      if (typeof v !== 'string' || !v) throw new Error(`${label}: ${key} must be a non-empty string`);
      return key === 'click' ? { click: v } : { press: v };
    case 'fill':
      if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || typeof v[1] !== 'string') {
        throw new Error(`${label}: fill must be [selector, text]`);
      }
      return { fill: [v[0], v[1]] };
    case 'wait':
      return { wait: checkWait(v, `${label}: wait`) };
    default:
      throw new Error(`${label}: unknown action "${key}"`);
  }
}

export function parseShotList(json: unknown): Shot[] {
  if (!Array.isArray(json)) throw new Error('shot list must be an array');
  if (json.length > MAX_SHOTS) throw new Error(`at most ${MAX_SHOTS} shots allowed, got ${json.length}`);
  return json.map((raw, i) => {
    if (!isObject(raw)) throw new Error(`shot ${i}: must be an object`);
    const { name } = raw;
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
      throw new Error(`shot ${i}: name must match ${NAME_RE}`);
    }
    const shot: Shot = { name, url: checkUrl(raw.url, `shot ${name}`) };
    if (raw.scrollY !== undefined) {
      if (typeof raw.scrollY !== 'number' || !Number.isFinite(raw.scrollY) || raw.scrollY < 0) {
        throw new Error(`shot ${name}: scrollY must be a non-negative number`);
      }
      shot.scrollY = raw.scrollY;
    }
    if (raw.waitMs !== undefined) shot.waitMs = checkWait(raw.waitMs, `shot ${name}: waitMs`);
    if (raw.actions !== undefined) {
      if (!Array.isArray(raw.actions)) throw new Error(`shot ${name}: actions must be an array`);
      if (raw.actions.length > MAX_ACTIONS) {
        throw new Error(`shot ${name}: at most ${MAX_ACTIONS} actions allowed, got ${raw.actions.length}`);
      }
      shot.actions = raw.actions.map((a) => parseAction(a, `shot ${name}`));
    }
    return shot;
  });
}

// Bounded JPEG quality ladder; the CLI walks it until a shot fits in maxBytes.
export function qualitySteps(_maxBytes: number): number[] {
  return [...QUALITY_LADDER];
}

interface ManifestEntry {
  name: string;
  url: string;
  bytes: number;
  quality: number;
}

function parseArgs(argv: string[]): { shots: string; out: string; maxBytes: number } {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const shots = get('--shots');
  const out = get('--out');
  const maxBytes = Number(get('--max-bytes') ?? DEFAULT_MAX_BYTES);
  if (!shots || !out || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    console.error('usage: blog-video-capture.ts --shots <file.json> --out <dir> [--max-bytes 220000]');
    process.exit(2);
  }
  return { shots, out, maxBytes };
}

async function main(): Promise<void> {
  const { shots: shotsFile, out, maxBytes } = parseArgs(process.argv.slice(2));
  let shots: Shot[];
  try {
    shots = parseShotList(JSON.parse(readFileSync(shotsFile, 'utf8')));
  } catch (err) {
    console.error(`invalid shot list: ${(err as Error).message}`);
    process.exit(2);
  }
  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });

  // 'playwright' is only a transitive dep here; @playwright/test re-exports chromium. Lazy import keeps tests browser-free.
  const { chromium } = await import('@playwright/test');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    if (/Executable doesn't exist|playwright install/i.test((err as Error).message)) {
      console.error('HALT: run pnpm exec playwright install chromium');
      process.exit(1);
    }
    throw err;
  }

  const manifest: ManifestEntry[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    for (const shot of shots) {
      try {
        await page.goto(shot.url, { timeout: GOTO_TIMEOUT_MS, waitUntil: 'networkidle' });
      } catch {
        await page.goto(shot.url, { timeout: GOTO_TIMEOUT_MS, waitUntil: 'load' });
      }
      if (!ALLOWED_ORIGINS.has(new URL(page.url()).origin)) {
        console.error(`shot "${shot.name}" redirected off the allow-list to ${page.url()}`);
        process.exitCode = 1;
        return;
      }
      if (shot.scrollY) await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
      for (const a of shot.actions ?? []) {
        if ('click' in a) await page.click(a.click, { timeout: ACTION_TIMEOUT_MS });
        else if ('fill' in a) await page.fill(a.fill[0], a.fill[1], { timeout: ACTION_TIMEOUT_MS });
        else if ('press' in a) await page.keyboard.press(a.press);
        else await page.waitForTimeout(a.wait);
      }
      if (shot.waitMs) await page.waitForTimeout(shot.waitMs);

      let buf: Buffer | null = null;
      let used = 0;
      for (const quality of qualitySteps(maxBytes)) {
        const candidate = await page.screenshot({ type: 'jpeg', quality });
        buf = candidate;
        used = quality;
        if (candidate.length <= maxBytes) break;
      }
      if (!buf || buf.length > maxBytes) {
        console.error(`shot "${shot.name}" is ${buf?.length ?? 0} bytes at quality ${used}, over ${maxBytes}`);
        process.exitCode = 1;
        return;
      }
      writeFileSync(path.join(outDir, `${shot.name}.jpg`), buf);
      manifest.push({ name: shot.name, url: shot.url, bytes: buf.length, quality: used });
    }
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
