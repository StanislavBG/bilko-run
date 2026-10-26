import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WEB_PRODUCTS, formatAmountCents, productKind, productPageSlug, type WebProduct,
} from '../shared/web-products.js';

// A product's pages are published from its sibling repo, but Checkout charges the
// catalog's amountCents. These checks tie the two together: a reprice in
// shared/web-products.ts without a republish, or a republish with a stale price, fails.

const PROJECTS_DIR = resolve(fileURLToPath(import.meta.url), '..', '..', 'public', 'projects');

const AMOUNT_RE = /\$\s?(\d+(?:,\d{3})*)(?:\.(\d{1,2}))?(?!\d)/g;

/** Cents of every dollar amount in the markup (attributes included) and in its text, where `<sup>$</sup>9` reads `$9`. Scripts and styles are skipped. */
function pageAmountsCents(html: string): Set<number> {
  const markup = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/&#0*36;|&#x0*24;|&dollar;/gi, '$')
    .replace(/&nbsp;|&#160;/gi, ' ');
  const text = markup.replace(/<[^>]*>/g, '');
  const cents = new Set<number>();
  for (const source of [markup, text]) {
    for (const [, dollars, frac = ''] of source.matchAll(AMOUNT_RE)) {
      cents.add(Number(dollars.replace(/,/g, '')) * 100 + Number(frac.padEnd(2, '0')));
    }
  }
  return cents;
}

/** Every price the catalog sells at: each product's price and founding price. */
function catalogCents(catalog: readonly WebProduct[]): Set<number> {
  const cents = new Set<number>();
  for (const p of catalog) {
    cents.add(p.amountCents);
    if (p.foundingDisplayPrice) for (const c of pageAmountsCents(p.foundingDisplayPrice)) cents.add(c);
  }
  return cents;
}

/** A service, or a download with a release: Checkout can sell it, so its pages must exist. */
const isSellable = (p: WebProduct): boolean => productKind(p) === 'service' || p.release !== null;

/** What is wrong with a product's published landing and thanks pages; empty when they agree with the catalog. */
function pageProblems(p: WebProduct, catalog: readonly WebProduct[] = WEB_PRODUCTS): string[] {
  const page = productPageSlug(p);
  const allowed = catalogCents(catalog);
  const problems: string[] = [];
  for (const [file, showsPrice] of [['index.html', true], ['thanks/index.html', false]] as const) {
    const where = `public/projects/${page}/${file}`;
    const path = join(PROJECTS_DIR, page, file);
    if (!existsSync(path)) {
      if (isSellable(p)) problems.push(`${where} is missing; Checkout sends ${p.slug} buyers there`);
      continue;
    }
    const shown = pageAmountsCents(readFileSync(path, 'utf8'));
    if (showsPrice && !shown.has(p.amountCents)) {
      problems.push(`${where} never shows ${p.displayPrice}, the price Checkout charges for ${p.slug}`);
    }
    const stray = [...shown].filter((c) => !allowed.has(c)).map(formatAmountCents);
    if (stray.length > 0) problems.push(`${where} shows ${stray.join(', ')}, which is no catalog price`);
  }
  return problems;
}

describe('web product pages agree with the catalog', () => {
  for (const p of WEB_PRODUCTS) {
    it(`${p.slug}: published pages exist and show ${p.displayPrice} and no other price`, () => {
      expect(pageProblems(p), 'republish the page from the repo that owns it, or fix shared/web-products.ts').toEqual([]);
    });
  }

  for (const p of WEB_PRODUCTS.filter((q) => existsSync(join(PROJECTS_DIR, productPageSlug(q), 'index.html')))) {
    it(`${p.slug}: a reprice without a republish is caught`, () => {
      const repriced = { ...p, amountCents: p.amountCents + 1, displayPrice: formatAmountCents(p.amountCents + 1) };
      const problems = pageProblems(repriced, WEB_PRODUCTS.map((q) => (q === p ? repriced : q))).join('\n');
      expect(problems).toContain(`never shows ${repriced.displayPrice}`);
    });
  }

  it('reads whole amounts, split markup and entities, and skips scripts', () => {
    const html = '<meta content="$3 one-time"><p><sup>$</sup>19 <small>once</small></p><p>&#36;9.5 or $1,200.</p>'
      + '<script>s.replace(re, "$1")</script><p>$30, $3.50</p>';
    expect([...pageAmountsCents(html)].sort((a, b) => a - b)).toEqual([300, 350, 950, 1900, 3000, 120000]);
  });
});
