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

test('?p= deep link selects the card and navigation syncs the URL', async ({ page }) => {
  await page.goto(`/projects?p=${PUBLIC_CARDS[2].slug}`);
  await expect(page.locator('.pr-counter')).toHaveText(`003 / ${N}`);

  await page.goto('/projects');
  await expect(page.locator('.pr-counter')).toHaveText(`001 / ${N}`);
  await page.getByRole('button', { name: 'Next project' }).click();
  await expect(page).toHaveURL(new RegExp(`p=${PUBLIC_CARDS[1].slug}`));
});

test('narrow viewport: hero Open is visible and spines are hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await expect(page.locator('.pr-hero').getByRole('button', { name: /^(Open|GitHub) →$/ })).toBeVisible();
  for (const spine of await page.locator('.pr-spine').all()) {
    await expect(spine).toBeHidden();
  }
});
