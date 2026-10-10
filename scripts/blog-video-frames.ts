// Quality gate: render a blog video at scene middles/boundaries, flag blank frames, write a contact sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BOUNDARY_PAD = 0.25;
const EDGE_PAD = 0.5;
const FALLBACK_STEP = 2;
const MIN_STDDEV = 8;
const MIN_EDGE_DENSITY = 0.01;
const COLUMNS = 4;

export interface SceneSpan {
  start: number;
  end: number;
}

export interface FrameStats {
  stddev: number;
  edgeDensity: number;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export function sampleTimes(scenes: SceneSpan[], duration: number): number[] {
  const raw: number[] = [];
  if (scenes.length === 0) {
    for (let t = 0; t <= duration; t += FALLBACK_STEP) raw.push(t);
  } else {
    raw.push(EDGE_PAD, duration - EDGE_PAD);
    for (const s of scenes) {
      raw.push((s.start + s.end) / 2, s.start - BOUNDARY_PAD, s.start + BOUNDARY_PAD, s.end - BOUNDARY_PAD, s.end + BOUNDARY_PAD);
    }
  }
  const clamped = raw.map((t) => round(Math.min(Math.max(t, 0), duration)));
  return [...new Set(clamped)].sort((a, b) => a - b);
}

export function isBlankFrame(stats: FrameStats): boolean {
  return stats.stddev < MIN_STDDEV || stats.edgeDensity < MIN_EDGE_DENSITY;
}

interface FrameRecord extends FrameStats {
  t: number;
  file: string;
  blank: boolean;
}

function parseArgs(argv: string[]): { video: string; out: string } {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? argv[i + 1] : undefined;
  const video = argv.find((a, idx) => !a.startsWith('--') && argv[idx - 1] !== '--out');
  if (!video || !out) {
    console.error('usage: blog-video-frames.ts <video.html> --out <dir>');
    process.exit(2);
  }
  return { video, out };
}

async function main(): Promise<void> {
  const { video, out } = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });

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

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.resolve(video)).href, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean((window as any).smDemo), undefined, { timeout: 10000 }).catch(() => undefined);
    const info = await page.evaluate(() => {
      const d = (window as any).smDemo;
      if (d?.pause) d.pause();
      return {
        scenes: (d?.scenes ?? []) as SceneSpan[],
        duration: Number(d?.duration ?? document.querySelector('meta[name="sm-demo-duration"]')?.getAttribute('content') ?? 30),
        canSeek: typeof d?.seek === 'function',
      };
    });
    if (!info.canSeek) {
      console.error('HALT: window.smDemo.seek is missing, cannot sample frames');
      process.exitCode = 1;
      return;
    }

    const frames: FrameRecord[] = [];
    for (const t of sampleTimes(info.scenes, info.duration)) {
      await page.evaluate((time) => (window as any).smDemo.seek(time), t);
      await page.waitForTimeout(120);
      const file = `t-${t}.jpg`;
      const shot = await page.screenshot({ type: 'jpeg', quality: 80 });
      writeFileSync(path.join(outDir, file), shot);
      const stats = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${b64}`;
        await img.decode();
        const w = 320;
        const h = 180;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        const g = new Float32Array(w * h);
        let sum = 0;
        for (let i = 0; i < g.length; i++) {
          g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
          sum += g[i];
        }
        const mean = sum / g.length;
        let sq = 0;
        let edges = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const v = g[y * w + x];
            sq += (v - mean) * (v - mean);
            if (x + 1 < w && Math.abs(g[y * w + x + 1] - v) > 24) edges++;
          }
        }
        return { stddev: Math.sqrt(sq / g.length), edgeDensity: edges / g.length };
      }, shot.toString('base64'));
      frames.push({ t, file, ...stats, blank: isBlankFrame(stats) });
    }

    const cells = frames
      .map((f) => `<figure><img src="${f.file}" width="${Math.floor(1280 / COLUMNS) - 16}"><figcaption${f.blank ? ' class="blank"' : ''}>${f.t}s${f.blank ? ' BLANK' : ''}</figcaption></figure>`)
      .join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;color:#fff;font:14px monospace}
.g{display:grid;grid-template-columns:repeat(${COLUMNS},1fr);gap:8px;padding:8px}figure{margin:0}img{display:block;width:100%}
figcaption{padding:2px 0}.blank{color:#f55;font-weight:bold}</style><div class="g">${cells}</div>`;
    const sheetPath = path.join(outDir, 'contact.html');
    writeFileSync(sheetPath, html);
    const sheet = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await sheet.goto(pathToFileURL(sheetPath).href, { waitUntil: 'load' });
    await sheet.screenshot({ path: path.join(outDir, 'contact.jpg'), type: 'jpeg', quality: 85, fullPage: true });

    writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(frames, null, 2) + '\n');
    const blank = frames.filter((f) => f.blank);
    console.log(`${frames.length} frames, contact sheet: ${path.join(outDir, 'contact.jpg')}`);
    if (blank.length > 0) {
      console.error(`BLANK frames at: ${blank.map((f) => `${f.t}s`).join(', ')}`);
      process.exitCode = 1;
    }
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
