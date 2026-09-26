/**
 * Guards the Session Manager positioning: **the app is free and stays free, and
 * so is the Field Manual that teaches it.**
 *
 * Deliberate positioning change (owner decision, 2026-09-25). Until then the
 * app was free and the $19.99 `session_manager` checkout sold the Field Manual,
 * and this file pinned that split (a Clerk-gated buy button on the landing
 * page, "the manual is the strategy guide", "never gated to sell the book").
 * From Field Manual 2.0.1 on, every chapter and download is free and nothing on
 * the page is for sale. What still must never happen:
 *
 * - the page reading as if the APP costs money, or will later ("free while
 *   we're in alpha", a struck-through price);
 * - a checkout creeping back onto the page;
 * - advertising surfaces the app doesn't ship, or a platform it can't install
 *   on (npm refuses win32: the package declares os [darwin, linux]).
 *
 * These are deliberately source-text assertions rather than DOM tests: the
 * claim being protected is editorial, and this repo has no renderer harness for
 * the marketing pages. tests/session-manager-landing.test.ts covers the page's
 * data and pure logic; e2e/session-manager-landing.spec.ts the rendered page.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { COPY } from '../src/pages/session-manager-landing/copy.js';

const ROOT = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8');

/**
 * Source with comments stripped and whitespace flattened.
 *
 * Both matter for copy assertions: a sentence that Prettier wrapped across two
 * JSX lines is still one sentence on screen, and a comment EXPLAINING why some
 * retired feature was deleted must not itself trip the "don't advertise it"
 * check. Line comments are only stripped when `//` isn't part of a URL.
 */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const prose = (src: string) => stripComments(src).replace(/\s+/g, ' ');

const MARKETING_PAGE = 'src/pages/SessionManagerPage.tsx';
const LANDING_DIR = 'src/pages/session-manager-landing';
const LANDING_CSS = 'src/styles/session-manager-landing.css';
const MANUAL_PAGE = 'src/pages/ManualPage.tsx';
const TOOLS_REGISTRY = 'src/config/tools.ts';
const PACKAGES_REGISTRY = 'src/data/packages.ts';
const PROJECTS_PAGE = 'src/pages/ProjectsPage.tsx';
const PROJECTS_VIEW = 'src/data/projectsView.ts';

/** Every source file the landing page renders from: page, copy, components, hooks. */
const PAGE_FILES = [
  MARKETING_PAGE,
  ...readdirSync(resolve(ROOT, LANDING_DIR))
    .filter(f => /\.(ts|tsx)$/.test(f))
    .map(f => `${LANDING_DIR}/${f}`),
];
const pageProse = () => PAGE_FILES.map(f => prose(read(f))).join(' \n ');

/** The session-manager entry of a registry file, comments stripped. */
function registryEntry(file: string): string {
  const src = stripComments(read(file));
  const idx = src.indexOf("slug: 'session-manager'");
  expect(idx, `${file} has no session-manager entry`).toBeGreaterThan(-1);
  return src.slice(idx, idx + 1200);
}

describe('open-core positioning: the app is free and stays free, and so is the manual', () => {
  it('the landing page is split across the page file and its component folder', () => {
    // If the folder moves, every assertion below would silently read nothing.
    expect(PAGE_FILES.length).toBeGreaterThan(4);
    expect(PAGE_FILES).toContain(`${LANDING_DIR}/copy.ts`);
    expect(PAGE_FILES).toContain(`${LANDING_DIR}/AccountChip.tsx`);
  });

  it('says the app is free, and stays free', () => {
    expect(COPY.priceTag.kicker).toBe('THE APP');
    expect(COPY.priceTag.price).toBe('$0');
    expect(COPY.priceTag.line).toBe('free, and stays free.');
    expect(COPY.endCard.body).toMatch(/free, and it stays free\./);
    expect(pageProse()).toContain('free, and stays free.');
  });

  it('shows the install command, and the copy button copies exactly that', () => {
    expect(COPY.meta.installCommand).toBe('npx claude-code-session-manager@latest');
    expect(COPY.priceTag.command).toBe(COPY.meta.installCommand);
    expect(read(`${LANDING_DIR}/copy.ts`)).toContain('npx claude-code-session-manager@latest');
    expect(read(`${LANDING_DIR}/hooks.ts`)).toContain('COPY.meta.installCommand');
  });

  it('never prices the app or implies it will cost money later', () => {
    const text = pageProse();
    // The only money figure on the page is the app's $0.
    const amounts = text.match(/\$\s?\d[\d.,]*/g) ?? [];
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(amount, `page quotes a price: ${amount}`).toBe('$0');
    for (const banned of [
      '$19.99',
      'PRICE_LABEL',
      "while we're in alpha",
      'while we’re in alpha',
      'Free for the whole alpha',
      'one time',
      'trial',
    ]) {
      expect(text, `page says "${banned}"`).not.toContain(banned);
    }
    // A struck-through price reads as "this used to cost money / will again".
    expect(prose(read(LANDING_CSS))).not.toContain('line-through');
    expect(text).not.toContain('line-through');
  });

  it('the manual is free: no checkout, no buy UI, no manual price on the page', () => {
    const text = pageProse();
    for (const banned of [
      'startSessionManagerCheckout',
      'sessionManagerCheckout',
      'create-checkout-session',
      'MANUAL_PRICE_LABEL',
      'priceLabel',
      'Buy',
      'Purchase',
      'Get the manual',
      'Already bought',
      'Sign in to buy',
    ]) {
      expect(text, `page still carries "${banned}"`).not.toContain(banned);
    }
    // Every "free" claim about the manual is backed by copy that says so.
    expect(COPY.header.manualLink).toMatch(/free/);
    expect(COPY.partsBin.aside.link).toMatch(/free/);
  });

  it('signs visitors in only through the account chip, never to gate a checkout', () => {
    // SignInButton now opens Clerk's modal from the header chip and nothing
    // else. It must never wrap a buy/checkout control again.
    const withSignIn = PAGE_FILES.filter(f => stripComments(read(f)).includes('SignInButton'));
    expect(withSignIn).toEqual([`${LANDING_DIR}/AccountChip.tsx`]);
    const chip = prose(read(`${LANDING_DIR}/AccountChip.tsx`));
    expect(chip).not.toMatch(/checkout|Checkout|stripe|Stripe/);
    // Only the chip touches Clerk, so a Clerk outage can't blank the page.
    const clerkImporters = PAGE_FILES.filter(f => read(f).includes('@clerk/clerk-react'));
    expect(clerkImporters).toEqual([`${LANDING_DIR}/AccountChip.tsx`]);
  });

  it('keeps every Clerk hook inside a quiet boundary, so a Clerk failure hides only the chip', () => {
    // usePageView() calls Clerk's useUser without importing @clerk/clerk-react,
    // so the import check above can't see it. Called at the top of the page it
    // would bring back the whole-page "This tool hit a snag" on a Clerk failure.
    const withPageView = PAGE_FILES.filter(f => stripComments(read(f)).includes('usePageView'));
    expect(withPageView).toEqual([`${LANDING_DIR}/AccountChip.tsx`]);
    const page = stripComments(read(MARKETING_PAGE));
    for (const hook of ['useUser', 'useAuth', 'useClerk', 'useSession', 'usePageView']) {
      expect(page, `SessionManagerPage.tsx calls ${hook}`).not.toMatch(new RegExp(`\\b${hook}\\s*\\(`));
    }
    const chip = stripComments(read(`${LANDING_DIR}/AccountChip.tsx`));
    expect(chip).toMatch(/<QuietBoundary[^>]*>\s*<Chip\b/);
    expect(chip).toMatch(/<QuietBoundary[^>]*>\s*<PageViewBeacon\b/);
    expect(chip).toMatch(/getDerivedStateFromError[\s\S]*?failed: true/);
    expect(chip).toMatch(/this\.state\.failed \? null/);
  });

  it('identity comes from the signed-in account, never a typed or hard-coded email', () => {
    const text = pageProse();
    expect(text).not.toMatch(/type="email"/);
    expect(prose(read(`${LANDING_DIR}/AccountChip.tsx`))).toContain('primaryEmailAddress');
    // The design mock's default `account` prop was a real personal address.
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  it('claims only the platforms the package installs on', () => {
    const text = pageProse();
    expect(COPY.priceTag.platforms).toBe('MAC · LINUX');
    expect(text).not.toMatch(/windows/i);
  });

  it('does not advertise surfaces the app no longer ships', () => {
    // The feature list once drifted into listing Browser and Web Remote (both
    // retired from the desktop app) plus a "Subagents · Hive" screen that never
    // existed — a visitor could click a pill and read about something they'd
    // never find after installing.
    const text = pageProse();
    for (const retired of ['Web Remote', 'Subagents', 'Hive', 'embedded browser']) {
      expect(text, `landing page still advertises "${retired}"`).not.toContain(retired);
    }
  });

  it('the /projects hub card does not advertise retired or missing features either', () => {
    // The hub's Session Manager row carried a drawer story (diffs, bookmarks, a
    // timeline) that the app never shipped. The row's "Web Remote →" link stays:
    // the relay and its paired-phone bundle at /projects/session-manager/ are
    // live by owner decision (session-manager CLAUDE.md: "The bilko.run relay
    // stays live — do NOT delete … the product-page copy").
    const hub = read(PROJECTS_PAGE);
    expect(hub).toContain('href="/projects/session-manager/"');
    const view = stripComments(read(PROJECTS_VIEW));
    const idx = view.indexOf("'session-manager': {");
    expect(idx, 'projectsView.ts has no session-manager ENRICH entry').toBeGreaterThan(-1);
    const entry = view.slice(idx, view.indexOf('},', idx));
    for (const claim of ['Web Remote', 'terminal cockpit', 'diffs', 'Bookmarks', 'bookmarks', 'timeline', 'sessions tracked']) {
      expect(entry, `hub card claims "${claim}"`).not.toContain(claim);
    }
    expect(entry).toMatch(/free/i);
  });

  it('does not repeat the mock claims the app cannot back up', () => {
    const text = pageProse();
    for (const claim of [
      'Nothing gets uploaded',
      'nothing leaves',
      'Runs entirely on your machine',
      'All on your own laptop',
      'contradict',
      'Search every session',
      'Export a transcript',
      'Rename a tag',
      'between versions',
      '17 chapters',
      'Switch any skill',
      'flip skills and servers on or off',
      "you're off",
    ]) {
      expect(text, `landing page claims "${claim}"`).not.toContain(claim);
    }
  });

  it('the manual page repeats that the app itself is free', () => {
    const src = read(MANUAL_PAGE);
    expect(src).toContain('npx claude-code-session-manager@latest');
    expect(src).toMatch(/The app itself is free/i);
  });

  it('the manual page sells nothing: no checkout, no price, no lock, no sign-in to read', () => {
    // The reader was the last place the manual was sold. It must never grow a
    // buy button, a price, a lock marker or an entitlement gate again.
    const text = prose(read(MANUAL_PAGE));
    for (const banned of [
      'startSessionManagerCheckout',
      'sessionManagerCheckout',
      'create-checkout-session',
      'MANUAL_PRICE_LABEL',
      'priceLabel',
      '$19.99',
      'Buy',
      'Purchase',
      'Unlock',
      'Sign in to',
      'SignInButton',
      '🔒',
      'entitled',
    ]) {
      expect(text, `ManualPage.tsx still carries "${banned}"`).not.toContain(banned);
    }
    expect(text).not.toMatch(/\$\s?\d/);
    // The downloads are plain links that render for everyone.
    expect(text).toMatch(/href=\{manualDownloadUrl\(a\.id\)\}/);
  });

  it('both project registries describe the app as free', () => {
    for (const file of [TOOLS_REGISTRY, PACKAGES_REGISTRY]) {
      expect(registryEntry(file), `${file} must call the app free`).toMatch(/free/i);
    }
  });

  it('the registry card never implies the app or the manual costs money', () => {
    for (const file of [TOOLS_REGISTRY, PACKAGES_REGISTRY]) {
      const entry = registryEntry(file);
      expect(entry, `${file} still calls the manual paid`).not.toMatch(/paid|\$\d|sold separately/i);
    }
  });

  it('the registry card does not advertise retired surfaces', () => {
    const entry = registryEntry(TOOLS_REGISTRY);
    for (const retired of ['Web Remote', 'web remote', 'Subagents', 'Hive', 'hive', 'Browser', 'browser']) {
      expect(entry, `tools.ts session-manager card still advertises "${retired}"`).not.toContain(retired);
    }
  });

  it('the registry description does not claim a stale tab count', () => {
    // The app's nav has 19 destinations, 11 of them in the Configure group
    // (session-manager src/renderer/lib/navGroups.ts). "17 config tabs"
    // shipped for months, then "25+ config tabs"; neither was ever true.
    const registry = read(PACKAGES_REGISTRY);
    expect(registry).not.toMatch(/17 config tabs|25\+ config/);
    expect(registry).toContain('terminal + 11 config screens');
  });
});
