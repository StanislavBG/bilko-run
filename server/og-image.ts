import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';

/**
 * Branded 1200x630 social card renderer. Pure text in, PNG out. Only the
 * bundled fonts are used (loadSystemFonts: false) so output is identical on
 * Render and on a dev machine.
 */

export interface OgCardInput {
  title: string;
  tagline: string;
  category?: string;
  urlLabel: string;
  /** Square PNG drawn top-right; text wraps narrower to make room. */
  iconPng?: Buffer;
}

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 80;
const TEXT_WIDTH = 1040;
const TEXT_WIDTH_WITH_ICON = 840;
const ICON_SIZE = 160;
const ICON_X = 960;
const ICON_Y = 70;
const FONT_FAMILY = 'DejaVu Sans';
const CACHE_MAX = 200;

// Approximate average glyph advance as a fraction of font size (DejaVu is wide).
const REGULAR_EM = 0.6;
const BOLD_EM = 0.68;

const here = dirname(fileURLToPath(import.meta.url));
const FONT_DIR_CANDIDATES = [
  resolve(process.cwd(), 'server/assets/fonts'),
  resolve(here, 'assets/fonts'),
  resolve(here, '../../server/assets/fonts'),
];

function fontFiles(): string[] {
  const dir = FONT_DIR_CANDIDATES.find((d) => existsSync(resolve(d, 'DejaVuSans.ttf')));
  if (!dir) throw new Error('og-image: bundled fonts not found');
  return [resolve(dir, 'DejaVuSans.ttf'), resolve(dir, 'DejaVuSans-Bold.ttf')];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Greedy word-wrap by approximate width. Over-long words are hard-split. */
function wrap(text: string, fontSize: number, em: number, width = TEXT_WIDTH): string[] {
  const maxChars = Math.max(1, Math.floor(width / (fontSize * em)));
  const lines: string[] = [];
  let cur = '';
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let word = raw;
    while (word.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= maxChars) cur += ` ${word}`;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Cap at maxLines, ending the last kept line with an ellipsis if text was dropped. */
function clampLines(lines: string[], maxLines: number, fontSize: number, em: number, width = TEXT_WIDTH): string[] {
  if (lines.length <= maxLines) return lines;
  const maxChars = Math.max(2, Math.floor(width / (fontSize * em)));
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return kept;
}

/** Shrink the title until it fits in at most 2 lines; clamp as a last resort. */
function fitTitle(title: string, width: number): { lines: string[]; size: number } {
  for (const size of [76, 64, 54, 46]) {
    const lines = wrap(title, size, BOLD_EM, width);
    if (lines.length <= 2) return { lines, size };
  }
  return { lines: clampLines(wrap(title, 46, BOLD_EM, width), 2, 46, BOLD_EM, width), size: 46 };
}

function buildSvg(input: OgCardInput): string {
  const width = input.iconPng ? TEXT_WIDTH_WITH_ICON : TEXT_WIDTH;
  const title = fitTitle(input.title.trim() || 'bilko.run', width);
  const taglineSize = 30;
  const tagline = clampLines(wrap(input.tagline.trim(), taglineSize, REGULAR_EM, width), 3, taglineSize, REGULAR_EM, width);

  const category = (input.category ?? '').trim().toUpperCase().slice(0, 40);
  const titleY = 230;
  const titleLead = Math.round(title.size * 1.15);
  const taglineY = titleY + (title.lines.length - 1) * titleLead + 70;

  const titleSvg = title.lines
    .map((l, i) => `<text x="${PAD}" y="${titleY + i * titleLead}" font-weight="700" font-size="${title.size}" fill="#ffffff">${escapeXml(l)}</text>`)
    .join('');
  const taglineSvg = tagline
    .map((l, i) => `<text x="${PAD}" y="${taglineY + i * 42}" font-size="${taglineSize}" fill="#a89478">${escapeXml(l)}</text>`)
    .join('');
  const categorySvg = category
    ? `<text x="${PAD}" y="110" font-weight="700" font-size="22" letter-spacing="3" fill="#ff6b1a">${escapeXml(category)}</text>`
    : '';
  const urlLabel = input.urlLabel.trim().slice(0, 70);
  const iconSvg = input.iconPng
    ? `<image x="${ICON_X}" y="${ICON_Y}" width="${ICON_SIZE}" height="${ICON_SIZE}" href="data:image/png;base64,${input.iconPng.toString('base64')}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT_FAMILY}">
<defs><radialGradient id="glow" cx="50%" cy="40%"><stop offset="0%" stop-color="#ff6b1a" stop-opacity="0.3"/><stop offset="100%" stop-color="#1a1613" stop-opacity="0"/></radialGradient></defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="#1a1613"/>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" opacity="0.4"/>
<rect x="0" y="0" width="12" height="${HEIGHT}" fill="#ff6b1a"/>
${iconSvg}${categorySvg}${titleSvg}${taglineSvg}
<rect x="${PAD}" y="534" width="${WIDTH - 2 * PAD}" height="2" fill="#3a302a"/>
<text x="${PAD}" y="586" font-weight="700" font-size="30" fill="#ff6b1a">bilko.run</text>
<text x="${WIDTH - PAD}" y="586" text-anchor="end" font-size="22" fill="#6b5a49">${escapeXml(urlLabel)}</text>
</svg>`;
}

const cache = new Map<string, Buffer>();

export function renderOgCard(input: OgCardInput): Buffer {
  const key = JSON.stringify([input.title, input.tagline, input.category ?? '', input.urlLabel, input.iconPng ? createHash('sha1').update(input.iconPng).digest('hex') : '']);
  const hit = cache.get(key);
  if (hit) return hit;

  const png = new Resvg(buildSvg(input), {
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
    fitTo: { mode: 'original' },
  })
    .render()
    .asPng();
  const buf = Buffer.from(png);

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, buf);
  return buf;
}
