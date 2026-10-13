/**
 * /projects — the Projects Ring: counter, arrow/tick navigation, hero Open
 * button and the Full story panel.
 */
import { test, expect } from '@playwright/test';
import { PUBLIC_CARDS } from '../src/data/projectsView.js';

const N = PUBLIC_CARDS.length;

test('ring navigation, ticks, Open and Full story', async ({ page }) => {
  const card = PUBLIC_CARDS[0];
  expect(card.href).toBeTruthy();

  await page.goto('/projects');
  const counter = page.locator('.pr-counter');
  await expect(counter).toHaveText(`001 / ${N}`);

  await page.getByRole('button', { name: 'Next project' }).click();
  await expect(counter).toHaveText(`002 / ${N}`);
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText(`001 / ${N}`);

  await page.locator('.pr-tick').nth(2).click();
  await expect(counter).toHaveText(`003 / ${N}`);
  await page.locator('.pr-tick').nth(0).click();
  await expect(counter).toHaveText(`001 / ${N}`);

  const story = page.getByRole('button', { name: 'Full story' });
  await expect(story).toHaveAttribute('aria-expanded', 'false');
  await story.click();
  await expect(story).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pr-story')).toBeVisible();

  await page.locator('.pr-hero').getByRole('button', { name: /^(Open|GitHub) →$/ }).click();
  await page.waitForURL(url => url.toString().includes(card.href!));
  expect(page.url()).toContain(card.href!);
});
