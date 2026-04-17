import { test, expect, Page } from '@playwright/test';
import { DOCS, MOCK_RESPONSES, MODE_LABELS } from './fixtures/local-score.js';

async function injectMockEngine(page: Page, mode: string) {
  await page.addInitScript(
    ({ mockResponse }) => {
      (window as any).__LOCALSCORE_MOCK_ENGINE = {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: mockResponse } }],
            }),
          },
        },
      };
    },
    { mockResponse: MOCK_RESPONSES[mode] },
  );
}

async function setupLocalScore(page: Page, mode: string) {
  await injectMockEngine(page, mode);
  await page.goto('/projects/local-score');
}

/** Click Get Started → pick a mode �� land on the text input screen */
async function navigateToInput(page: Page, modeLabel: string) {
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await expect(page.getByText('Ready! What do you need help with?')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: modeLabel }).click();
}

/** Submit text and wait for results to appear */
async function submitAndWaitForResults(page: Page, text: string) {
  await page.locator('textarea').fill(text);
  await page.getByRole('button', { name: 'Analyze This' }).click();
  await expect(page.getByText("Here's what I found")).toBeVisible({ timeout: 30_000 });
}

test.describe('LocalScore — E2E with mocked Gemma', () => {
  test('page loads and shows Get Started button', async ({ page }) => {
    await injectMockEngine(page, 'general');
    await page.goto('/projects/local-score');

    await expect(page.getByRole('button', { name: 'Get Started', exact: true })).toBeVisible();
    await expect(page.getByText('100% private')).toBeVisible();
    await expect(page.getByText('free forever')).toBeVisible();
  });

  test('unsupported browser shows fallback when no WebGPU', async ({ page }) => {
    await page.goto('/projects/local-score');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();

    const unsupported = page.getByText("Your browser can't run this yet");
    const errorMsg = page.getByText("Something went wrong");
    await expect(unsupported.or(errorMsg)).toBeVisible({ timeout: 10_000 });
  });

  for (const [modeId, modeLabel] of MODE_LABELS) {
    test(`${modeId} mode — full analysis flow`, async ({ page }) => {
      await setupLocalScore(page, modeId);
      await navigateToInput(page, modeLabel);

      await page.locator('textarea').fill(DOCS[modeId]);
      await page.getByRole('button', { name: 'Analyze This' }).click();

      await expect(page.getByText("Your text stayed on your computer")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Here's what I found")).toBeVisible();

      const resultText = await page.locator('.text-sm.space-y-1').textContent();
      expect(resultText).toBeTruthy();
      expect(resultText!.length).toBeGreaterThan(50);

      await expect(page.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save as file' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Analyze another' })).toBeVisible();
    });
  }

  test('analyze another resets to mode picker', async ({ page }) => {
    await setupLocalScore(page, 'general');
    await navigateToInput(page, 'Your website copy or business description');
    await submitAndWaitForResults(page, DOCS.general);

    await page.getByRole('button', { name: 'Analyze another' }).click();
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible();
  });

  test('back button returns to mode picker from input', async ({ page }) => {
    await setupLocalScore(page, 'contract');
    await navigateToInput(page, 'A contract or agreement');

    await expect(page.locator('textarea')).toBeVisible();
    await page.getByText('← Back').click();
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible();
  });

  test('empty input disables analyze button', async ({ page }) => {
    await setupLocalScore(page, 'general');
    await navigateToInput(page, 'Your website copy or business description');

    const analyzeBtn = page.getByRole('button', { name: 'Paste something first...' });
    await expect(analyzeBtn).toBeVisible();
    await expect(analyzeBtn).toBeDisabled();
  });
});
