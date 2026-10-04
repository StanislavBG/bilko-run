/**
 * golden.spec.ts — copy this into your sibling repo at tests/golden.spec.ts.
 * Fill in the three TODOs and you're done.
 *
 * Platform contract this spec asserts:
 *   1. The brand chrome loads (host-kit ToolHero + bilko.run link visible)
 *   2. The primary CTA exists
 *   3. Signed-out user clicking the paid CTA sees auth prompt, not a crash
 *   4. Signed-in user with credits can complete the golden path and ScoreCard renders
 *
 * Usage:
 *   cp node_modules/host-kit/dist/testing/golden.template.ts.txt \
 *      tests/golden.spec.ts
 *   # then fill in the three TODOs below
 */
import { test } from '@playwright/test';
import {
  withHostStub,
  expectChromeLoaded,
  submitPrimaryAction,
  expectScoreCard,
} from 'host-kit/testing';

const SLUG     = 'TODO-slug';        // your sibling's slug
const TITLE_RE = /TODO Title/;       // ToolHero h1 text regex
const CTA_RE   = /TODO Primary CTA/; // primary button name

test.describe('golden path', () => {
  test('chrome + auth prompt for signed-out user', async ({ page, context }) => {
    await withHostStub(context, { signedIn: false, credits: 0 });
    await page.goto(`/projects/${SLUG}/`);
    await expectChromeLoaded(page, TITLE_RE);
    await submitPrimaryAction(page, CTA_RE);
    // signed-out → expect an auth prompt or paywall, not a crash.
    // Adapt this to whatever your app renders for unauthenticated users:
    //   page.getByTestId('paywall')          — if your app renders a custom paywall
    //   page.getByRole('dialog')             — if your app opens a sign-in modal
    //   page.getByText(/sign in/i)           — if your app shows inline sign-in text
    await page.getByTestId('paywall').waitFor({ state: 'visible', timeout: 5_000 });
  });

  test('signed-in user with credits completes the path', async ({ page, context }) => {
    await withHostStub(context, {
      signedIn: true,
      credits: 10,
      routes: {
        // TODO: stub your tool's POST endpoint here, e.g.
        // 'POST /tools/<slug>': () => ({ score: 87, grade: 'B+', verdict: 'TODO' }),
      },
    });
    await page.goto(`/projects/${SLUG}/`);
    await expectChromeLoaded(page, TITLE_RE);
    // TODO: fill in the form with valid input
    // await page.getByLabel('URL').fill('https://example.com');
    await submitPrimaryAction(page, CTA_RE);
    await expectScoreCard(page);
  });
});
