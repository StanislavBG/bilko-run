// Pure data + math for the "Home Radar Flip" home page: sectors, radar blips
// built from real projects/posts/channels, sweep stepping, lit scoring, sizing.
// No React/DOM imports so it stays unit-testable.
import type { HubCard } from './projectsView.js';

export interface FlipDest { key: string; path: string; eyebrow: string; title: string; lede: string; url: string; spa: boolean; spines: boolean; }
export interface RadarSector { key: 'projects' | 'blog' | 'contact'; k: string; no: '01' | '02' | '03'; start: number; span: number; mid: number; cta: string; col: string; lx: number; ly: number; }
export interface RadarItem { id: string; sec: 0 | 1 | 2; lab: string; name: string; sub: string; href: string; col: string; b: number; d: number; x: number; y: number; dest: FlipDest | null; track: string; }

export const RADAR_SECTORS: readonly RadarSector[] = [
  { key: 'projects', k: 'Projects', no: '01', start: 0, span: 180, mid: 90, cta: 'Flip to projects', col: '#a83818', lx: 472, ly: 472 },
  { key: 'blog', k: 'Blog', no: '02', start: 180, span: 90, mid: 225, cta: 'Flip to the blog', col: '#1a1612', lx: 48, ly: 472 },
  { key: 'contact', k: 'Contact', no: '03', start: 270, span: 90, mid: 315, cta: 'Flip to contact', col: '#2e5a3e', lx: 48, ly: 48 },
];

export const FLIP_DESTS: Record<'projects' | 'blog' | 'contact', FlipDest> = {
  projects: { key: 'projects', path: 'bilko.run/projects', eyebrow: 'Section 02 · Portfolio', title: 'Projects & Packages.', lede: 'Live tools, games, and open-source packages — newest work on top.', url: '/projects', spa: true, spines: true },
  blog: { key: 'blog', path: 'bilko.run/blog', eyebrow: 'Section 04 · Writing', title: 'Blog.', lede: 'Notes from the workshop — half-finished thoughts on AI, craft, and what shipping actually feels like.', url: '/blog', spa: true, spines: false },
  contact: { key: 'contact', path: 'bilko.run/contact', eyebrow: 'Section 08 · Hello', title: 'Contact.', lede: 'Real inboxes. No forms that disappear into nothing.', url: '/contact', spa: true, spines: false },
};

export const CHANNELS_RADAR: readonly { name: string; sub: string; href: string }[] = [
  { name: 'Email', sub: 'BilkoBibitkov2000@gmail.com', href: 'mailto:BilkoBibitkov2000@gmail.com' },
  { name: 'X', sub: '@BilkoBibitkov', href: 'https://x.com/BilkoBibitkov' },
  { name: 'LinkedIn', sub: '/in/bilko-bibitkov', href: 'https://www.linkedin.com/in/bilko-bibitkov-403391412/' },
];

const MAX_PROJECTS = 8;
const MAX_POSTS = 5;
const DIST_PROJECTS = [210, 140, 225, 120, 200, 150, 230, 170];
const DIST_POSTS = [150, 215, 120, 200, 170];
const DIST_CHANNELS = [180, 130, 210];
const CENTRE = 260;

const pad2 = (n: number) => String(n).padStart(2, '0');

function bearing(sector: RadarSector, pad: number, i: number, n: number): number {
  return sector.start + pad + (sector.span - 2 * pad) * (n === 1 ? 0.5 : i / (n - 1));
}

function place(b: number, d: number): { x: number; y: number } {
  const r = (b * Math.PI) / 180;
  return { x: Math.round(CENTRE + d * Math.sin(r)), y: Math.round(CENTRE - d * Math.cos(r)) };
}

export function buildRadarItems(input: {
  projects: readonly Pick<HubCard, 'slug' | 'name' | 'category' | 'blurb' | 'href' | 'isInternal' | 'status'>[];
  posts: readonly { slug: string; title: string }[];
}): { items: RadarItem[]; counts: [string, string, string] } {
  const items: RadarItem[] = [];
  const projs = input.projects.filter(p => p.href).slice(0, MAX_PROJECTS);
  const posts = input.posts.slice(0, MAX_POSTS);

  projs.forEach((p, i) => {
    const b = bearing(RADAR_SECTORS[0], 15, i, projs.length);
    const href = p.href as string;
    items.push({
      id: `project-${p.slug}`, sec: 0, lab: p.name, name: p.name, sub: p.category, href, col: RADAR_SECTORS[0].col,
      b, d: DIST_PROJECTS[i % DIST_PROJECTS.length], ...place(b, DIST_PROJECTS[i % DIST_PROJECTS.length]),
      dest: { key: `project-${p.slug}`, path: `bilko.run${href}`, eyebrow: `No. ${pad2(i + 1)} · ${p.category}`, title: `${p.name}.`, lede: p.blurb, url: href, spa: p.isInternal, spines: false },
      track: `home-radar-${p.slug}`.slice(0, 60),
    });
  });

  posts.forEach((p, i) => {
    const b = bearing(RADAR_SECTORS[1], 12, i, posts.length);
    const d = DIST_POSTS[i % DIST_POSTS.length];
    const url = `/blog/${p.slug}`;
    items.push({
      id: `post-${p.slug}`, sec: 1, lab: `LOG ${pad2(i + 1)}`, name: p.title, sub: 'Build log', href: url, col: RADAR_SECTORS[1].col,
      b, d, ...place(b, d),
      dest: { key: `post-${p.slug}`, path: `bilko.run${url}`, eyebrow: `Build log · ${pad2(i + 1)}`, title: p.title, lede: 'From the workshop.', url, spa: true, spines: false },
      track: `home-radar-post-${p.slug}`.slice(0, 60),
    });
  });

  CHANNELS_RADAR.forEach((c, i) => {
    const b = bearing(RADAR_SECTORS[2], 20, i, CHANNELS_RADAR.length);
    const d = DIST_CHANNELS[i % DIST_CHANNELS.length];
    items.push({
      id: `channel-${c.name.toLowerCase()}`, sec: 2, lab: c.name, name: c.sub, sub: c.name, href: c.href, col: RADAR_SECTORS[2].col,
      b, d, ...place(b, d), dest: null,
      track: `home-radar-${c.name.toLowerCase()}`,
    });
  });

  const live = input.projects.filter(p => p.status === 'live').length;
  return { items, counts: [`${live} live`, 'Weekly logs', 'Open inbox'] };
}

export function angDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function sectorIndexAt(angle: number): 0 | 1 | 2 {
  return angle < 180 ? 0 : angle < 270 ? 1 : 2;
}

export function stepSweep(ang: number, dtSec: number, periodSec: number, target: number | null): number {
  if (target === null) return (ang + (360 / periodSec) * dtSec) % 360;
  const delta = ((target - ang + 540) % 360) - 180;
  const next = (ang + delta * Math.min(1, dtSec * 9)) % 360;
  return next < 0 ? next + 360 : next;
}

export function isLit(item: Pick<RadarItem, 'b'>, sweep: number, periodSec: number, manual: boolean): boolean {
  if (manual) return angDiff(sweep, item.b) < 11;
  return ((sweep - item.b + 360) % 360) / (360 / periodSec) < 1.3;
}

export function radarSize(vw: number, vh: number): { size: number; scale: number; showReadout: boolean } {
  const wide = vw >= 1180;
  const avail = wide ? 520 : vw >= 760 ? vw - 112 - 300 - 32 : vw - 64;
  const size = Math.round(Math.max(260, Math.min(520, vh - 66 - 52 - 72, avail)));
  return { size, scale: size / 520, showReadout: wide };
}
