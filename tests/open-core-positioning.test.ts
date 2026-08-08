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

const MARKETING_PAGE = 'src/pages/SessionManagerPage.tsx';
const MANUAL_PAGE = 'src/pages/ManualPage.tsx';
const TOOLS_REGISTRY = 'src/config/tools.ts';
const PACKAGES_REGISTRY = 'src/data/packages.ts';

describe('open-core positioning: the app is free, the manual is the product', () => {
  it('the marketing page states the app is free and shows the install command', () => {
    const src = read(MARKETING_PAGE);
    expect(src).toContain('npx claude-code-session-manager@latest');
    expect(src).toMatch(/The app is free/i);
    // The explainer section is the one that makes the split unambiguous.
    expect(src).toMatch(/The tool is free\. The knowledge of how to run it isn't\./);
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
