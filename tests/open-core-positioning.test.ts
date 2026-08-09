/**
 * Guards the Session Manager positioning: **the tool is free, the knowledge is not.**
 *
 * The app ships free on npm; the $19.99 `session_manager` checkout sells The Field
 * Manual. Every surface that quotes the price has to say which of the two the money
 * buys — a page that reads like the app costs money is the exact failure mode here,
 * and it is the kind of copy that drifts back silently during an unrelated edit.
 *
 * These are deliberately source-text assertions rather than DOM tests: the claim
 * being protected is editorial, and this repo has no renderer harness for the
 * marketing pages.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf-8');

/**
 * Source with block comments stripped and whitespace flattened.
 *
 * Both matter for copy assertions: a sentence that Prettier wrapped across two
 * JSX lines is still one sentence on screen, and a comment EXPLAINING why some
 * retired feature was deleted must not itself trip the "don't advertise it"
 * check.
 */
const readProse = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

const MARKETING_PAGE = 'src/pages/SessionManagerPage.tsx';
const MANUAL_PAGE = 'src/pages/ManualPage.tsx';
const TOOLS_REGISTRY = 'src/config/tools.ts';
const PACKAGES_REGISTRY = 'src/data/packages.ts';

describe('open-core positioning: the app is free, the manual is the product', () => {
  it('the marketing page states the app is free and shows the install command', () => {
    const src = read(MARKETING_PAGE);
    expect(src).toContain('npx claude-code-session-manager@latest');
    // The line that makes the split unambiguous. The claim being guarded is
    // "app free / manual paid" — NOT one fixed sentence, so the wording is free
    // to soften (it read as smug once and was rewritten) as long as both halves
    // still appear: the app is free, and the manual is the companion guide.
    const prose = readProse(MARKETING_PAGE);
    expect(prose).toMatch(/The app is free, and stays free\./);
    expect(prose).toMatch(/Field Manual is the strategy guide/);
    // And the promise that the app is never crippled to sell the book.
    expect(src).toMatch(/never gated to sell the book/i);
  });

  it('does not advertise surfaces the app no longer ships', () => {
    // The feature pills drifted into listing Browser and Web Remote (both
    // retired from the desktop app) plus a "Subagents · Hive" screen that
    // never existed — a visitor could click a pill and read about something
    // they'd never find after installing.
    const prose = readProse(MARKETING_PAGE);
    for (const retired of ['Web Remote', 'Subagents', 'Hive', 'embedded browser']) {
      expect(prose, `marketing page still advertises "${retired}"`).not.toContain(retired);
    }
  });

  it('binds checkout to the signed-in identity, never a free-text email field', () => {
    const src = read(MARKETING_PAGE);
    // Entitlement is looked up by the Clerk account's email. A typed <input
    // type="email"> here let someone pay as one address while signed in as
    // another — they'd be charged and then told they own nothing.
    expect(src).not.toMatch(/type="email"/);
    expect(src).toContain('primaryEmailAddress');
    // Signed-out visitors must be sent through sign-in, not straight to Stripe.
    expect(src).toContain('SignInButton');
  });

  it('every price mention on the marketing page is attached to the manual, never the app', () => {
    const src = read(MARKETING_PAGE);

    // "Buy Now — $19.99" next to the product name reads as buying the software.
    // Any CTA quoting the price must name the manual instead.
    const ctaWithPrice = /(?:Buy Now|Buy Session Manager|Purchase)[^\n]*PRICE_LABEL/;
    expect(src).not.toMatch(ctaWithPrice);

    // The checkout call still targets the session_manager SKU — reusing the
    // already-live price is deliberate, so existing buyers own the manual too.
    expect(src).toContain('startSessionManagerCheckout');
    expect(src).toMatch(/Field Manual/);
  });

  it('the manual page repeats the split on the surface where money changes hands', () => {
    const src = read(MANUAL_PAGE);
    expect(src).toContain('npx claude-code-session-manager@latest');
    expect(src).toMatch(/The app itself is free/i);
  });

  it('both project registries describe the app as free', () => {
    for (const file of [TOOLS_REGISTRY, PACKAGES_REGISTRY]) {
      const src = read(file);
      // Narrow to the session-manager entry so another project's copy can't
      // accidentally satisfy this assertion.
      const idx = src.indexOf("slug: 'session-manager'");
      expect(idx, `${file} has no session-manager entry`).toBeGreaterThan(-1);
      const entry = src.slice(idx, idx + 1200);
      expect(entry, `${file} must call the app free`).toMatch(/free/i);
    }
  });

  it('the registry description does not claim a stale tab count', () => {
    // The app has 25+ config surfaces; "17 config tabs" shipped for months.
    expect(read(PACKAGES_REGISTRY)).not.toMatch(/17 config tabs/);
  });
});
