export interface Figure {
  src: string;
  alt: string;
  caption: string;
}

export type InlinePart =
  | { type: 'text'; value: string }
  | { type: 'link'; text: string; href: string };

const FIGURE_RE = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/;
const FIGURE_SRC_RE = /^\/blog-images\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$/;
const LINK_RE = /\[([^\]]+)\]\(([^\s)]+)\)/g;

/** Parse a block that is exactly `![alt](src "caption")`; null if not a safe same-origin figure. */
export function parseFigure(block: string): Figure | null {
  const m = FIGURE_RE.exec(block.trim());
  if (!m) return null;
  const [, alt, src, caption] = m;
  if (!FIGURE_SRC_RE.test(src) || src.includes('..')) return null;
  return { src, alt, caption: caption ?? '' };
}

function isSafeHref(href: string): boolean {
  return href.startsWith('https://') || (href.startsWith('/') && !href.startsWith('//'));
}

/** Split text into plain text and `[text](href)` links; unsafe hrefs stay as text. */
export function splitInlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  const push = (value: string) => {
    if (!value) return;
    const prev = parts[parts.length - 1];
    if (prev && prev.type === 'text') prev.value += value;
    else parts.push({ type: 'text', value });
  };
  for (const m of text.matchAll(LINK_RE)) {
    const idx = m.index ?? 0;
    push(text.slice(last, idx));
    if (isSafeHref(m[2])) parts.push({ type: 'link', text: m[1], href: m[2] });
    else push(m[0]);
    last = idx + m[0].length;
  }
  push(text.slice(last));
  return parts;
}
