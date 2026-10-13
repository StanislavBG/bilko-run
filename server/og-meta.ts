import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export interface OgMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  /** 'summary' for a square image (e.g. an avatar); default is the 1200x630 large card. */
  card?: 'summary' | 'summary_large_image';
}

/** Per-request override for one page, keyed by path + query (e.g. git-viewer `?u=`). */
export type OgDynamicResolver = (path: string, query: URLSearchParams) => Promise<OgMeta | null>;

export interface OgProject {
  slug: string;
  name: string;
  displayName?: string;
  tagline: string;
  category: string;
  /** Registry `listing.icon` / `listing.shareImage`: /projects/<slug>/... .png paths. */
  icon?: string;
  shareImage?: string;
}

export interface OgContext {
  projects: readonly OgProject[];
  blogPosts: readonly { slug: string; title: string; excerpt: string }[];
  dynamic?: readonly OgDynamicResolver[];
  /** Root of the served static bundle (dist); enables listing.shareImage lookups. */
  staticRoot?: string;
}

const SITE = 'https://bilko.run';
const DEFAULT_IMAGE = `${SITE}/og/default.png`;

const DEFAULT_META: OgMeta = {
  title: 'bilko.run — Small AI tools, one at a time',
  description:
    'A studio of one shipping small AI tools: trading bots that trade in public, a weather report, a live GitHub dashboard, a session scheduler and a free AI academy. Most are free or open source.',
  url: `${SITE}/`,
  image: DEFAULT_IMAGE,
};

const SECTION_PAGES: Record<string, { title: string; description: string }> = {
  '/projects': {
    title: 'Projects — bilko.run',
    description: 'Every project Bilko is building: live apps, games and tools, each in its own repo.',
  },
  '/blog': {
    title: 'Blog — bilko.run',
    description:
      'Lessons from building AI tools solo. Build logs, technical deep dives, and honest takes on shipping software in 2026.',
  },
  '/pricing': {
    title: 'Pricing — bilko.run',
    description: 'Free to start. Then $1 per credit or 7 for $5. No subscriptions.',
  },
};

const SLUG_RE = /^[a-z0-9-]+$/;
const PROJECT_PATH_RE = /^\/projects\/([^/]+)\/(?:index\.html)?$/;
const PRODUCT_PATH_RE = /^\/products\/session-manager(\/manual)?\/?$/;
const BLOG_PATH_RE = /^\/blog\/([^/]+)$/;

export function loadOgProjects(file?: string): OgProject[] {
  const rel = 'src/data/standalone-projects.json';
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = file
    ? [file]
    : [resolve(process.cwd(), rel), resolve(here, '..', '..', rel), resolve(here, '..', rel)];
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error(`og-meta: registry not found; tried ${candidates.join(', ')}`);
  const raw = JSON.parse(readFileSync(found, 'utf-8')) as Array<Record<string, unknown>>;
  return raw.map(p => {
    const out: OgProject = {
      slug: String(p.slug),
      name: String(p.name),
      tagline: String(p.tagline ?? ''),
      category: String(p.category ?? ''),
    };
    if (typeof p.displayName === 'string' && p.displayName) out.displayName = p.displayName;
    const listing = p.listing as Record<string, unknown> | undefined;
    if (typeof listing?.icon === 'string' && listing.icon) out.icon = listing.icon;
    if (typeof listing?.shareImage === 'string' && listing.shareImage) out.shareImage = listing.shareImage;
    return out;
  });
}

function projectMeta(p: OgProject, url: string, image: string): OgMeta {
  return { title: `${p.displayName ?? p.name} — bilko.run`, description: p.tagline, url, image };
}

export function resolveOg(path: string, ctx: OgContext): OgMeta | null {
  const clean = path.split('#')[0].split('?')[0];
  if (clean === '/') return { ...DEFAULT_META };

  const section = SECTION_PAGES[clean];
  if (section) return { ...section, url: `${SITE}${clean}`, image: DEFAULT_IMAGE };

  const proj = PROJECT_PATH_RE.exec(clean);
  if (proj) {
    const slug = proj[1];
    if (!SLUG_RE.test(slug)) return null;
    const p = ctx.projects.find(x => x.slug === slug);
    return p ? projectMeta(p, `${SITE}/projects/${slug}/`, `${SITE}/og/${slug}.png`) : null;
  }

  const prod = PRODUCT_PATH_RE.exec(clean);
  if (prod) {
    const p = ctx.projects.find(x => x.slug === 'session-manager');
    if (!p) return null;
    const canonical = `/products/session-manager${prod[1] ?? ''}`;
    return projectMeta(p, `${SITE}${canonical}`, `${SITE}/og/session-manager.png`);
  }

  const blog = BLOG_PATH_RE.exec(clean);
  if (blog) {
    const slug = blog[1];
    if (!SLUG_RE.test(slug)) return null;
    const post = ctx.blogPosts.find(x => x.slug === slug);
    return post
      ? { title: post.title, description: post.excerpt, url: `${SITE}/blog/${slug}`, image: DEFAULT_IMAGE }
      : null;
  }

  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function injectOgMeta(html: string, meta: OgMeta): string {
  if (!/<\/head>/i.test(html)) return html;
  const stripped = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<meta\b(?=[^>]*\bname\s*=\s*["']?description["']?[\s/>])[^>]*>/gi, '')
    .replace(/<meta\b(?=[^>]*\bproperty\s*=\s*["']?og:)[^>]*>/gi, '')
    .replace(/<meta\b(?=[^>]*\bname\s*=\s*["']?twitter:)[^>]*>/gi, '');
  const t = esc(meta.title);
  const d = esc(meta.description);
  const u = esc(meta.url);
  const i = esc(meta.image);
  const large = meta.card !== 'summary';
  const block = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="bilko.run" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta property="og:image" content="${i}" />`,
    ...(large
      ? [`<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`]
      : []),
    `<meta name="twitter:card" content="${large ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:site" content="@BilkoBibitkov" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ]
    .map(l => `    ${l}`)
    .join('\n');
  return stripped.replace(/<\/head>/i, () => `${block}\n  </head>`);
}
