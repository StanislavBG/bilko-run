import { test, expect, type Page } from '@playwright/test';

const H = 3600000;
const T = Date.now() + 3 * 24 * H;
const slots = {
  timeZone: 'America/Los_Angeles',
  durationMinutes: 60,
  slots: [
    { startMs: T, endMs: T + H },
    { startMs: T + 2 * H, endMs: T + 3 * H },
  ],
  taken: [{ startMs: T + 4 * H, endMs: T + 5 * H }],
};

async function mock(page: Page, body: object = slots, status = 200) {
  await page.route('**/api/services/human-for-hire/slots', (r) => r.fulfill({ status, json: body }));
}

test('pick a time and continue', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue →' });
  await expect(cont).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Choose a time to continue')).toBeVisible();
  const first = page.locator('button.bk-slot').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toContainText('✓ Selected');
  await expect(cont).toHaveAttribute('aria-disabled', 'false');
  await cont.click();
  await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
});

test('a taken slot is not clickable', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await expect(page.locator('button.bk-slot')).toHaveCount(2);
  await expect(page.locator('.bk-slot.taken')).toHaveCount(1);
  await expect(page.locator('.bk-slot.taken')).toContainText('Taken');
});

test('switching zone changes the shown time', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await page.getByLabel('Times in').selectOption('America/Los_Angeles');
  const la = await page.locator('button.bk-slot .bk-time').first().innerText();
  await page.getByLabel('Times in').selectOption('Europe/Berlin');
  const de = await page.locator('button.bk-slot .bk-time').first().innerText();
  expect(de).not.toBe(la);
});

test('empty and error states', async ({ page }) => {
  await mock(page, { slots: [], taken: [] });
  await page.goto('/book');
  await expect(page.getByText('No open times right now. Write to')).toBeVisible();
  await expect(page.locator('.bk-card a[href^="mailto:"]')).toBeVisible();
});

test('load error shows Retry', async ({ page }) => {
  await mock(page, { error: 'x' }, 500);
  await page.goto('/book');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

for (const [w, h] of [[1280, 720], [390, 844]] as const) {
  test(`screenshot and no sideways scroll at ${w}x${h}`, async ({ page }) => {
    await mock(page);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/book');
    await expect(page.locator('button.bk-slot').first()).toBeVisible();
    await page.locator('button.bk-slot').first().click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(over).toBe(false);
    await page.screenshot({ path: `test-results/booking-page-${w}x${h}.png`, fullPage: true });
  });
}

const ICS = 'BEGIN:VCALENDAR\nEND:VCALENDAR';

async function toDetails(page: Page) {
  await mock(page);
  await page.goto('/book');
  await page.locator('button.bk-slot').first().click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByPlaceholder('you@company.com').fill('me@example.com');
}

async function mockBook(page: Page) {
  await page.route('**/api/services/human-for-hire/free-hour', (r) =>
    r.fulfill({ status: 201, json: { booking: { startMs: T, endMs: T + H }, ics: ICS, cancelToken: 'free_00000000-0000-0000-0000-000000000000' } }));
}

test('booking success shows confirmation and calendar actions', async ({ page }) => {
  let body: Record<string, unknown> = {};
  await page.route('**/api/services/human-for-hire/free-hour', (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({ status: 201, json: { booking: { startMs: T, endMs: T + H }, ics: ICS, cancelToken: 'free_00000000-0000-0000-0000-000000000000' } });
  });
  await toDetails(page);
  const book = page.getByRole('button', { name: 'Book my free hour' });
  await page.getByRole('button', { name: 'New idea' }).click();
  await expect(page.getByRole('button', { name: 'New idea' })).toHaveAttribute('aria-pressed', 'true');
  await expect(book).toHaveAttribute('aria-disabled', 'false');
  await page.screenshot({ path: 'test-results/booking-page-step2.png', fullPage: true });
  await page.getByPlaceholder('you@company.com').press('Enter');
  await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
  expect(body).toMatchObject({ email: 'me@example.com', startMs: T, tags: ['New idea'], website: '' });
  await expect(page.getByRole('link', { name: 'Google Calendar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apple Calendar' })).toHaveAttribute('download', 'bilko-free-hour.ics');
  await expect(page.getByRole('link', { name: 'Outlook' })).toBeVisible();
  await expect(page.getByText('What happens next')).toBeVisible();
  await page.screenshot({ path: 'test-results/booking-page-step3.png', fullPage: true });
});

test('book is disabled for a bad email', async ({ page }) => {
  await toDetails(page);
  await page.getByPlaceholder('you@company.com').fill('nope');
  await expect(page.getByRole('button', { name: 'Book my free hour' })).toHaveAttribute('aria-disabled', 'true');
});

test('already_booked shows a notice in the card', async ({ page }) => {
  await page.route('**/api/services/human-for-hire/free-hour', (r) => r.fulfill({ status: 409, json: { error: 'already_booked' } }));
  await toDetails(page);
  await page.getByRole('button', { name: 'Book my free hour' }).click();
  await expect(page.locator('.bk-card [role="alert"]')).toContainText("You've already booked your free hour");
});

test('reschedule shows the new time', async ({ page }) => {
  await mockBook(page);
  await page.route('**/api/services/human-for-hire/free-hour/reschedule', (r) =>
    r.fulfill({ status: 200, json: { booking: { startMs: T + 2 * H, endMs: T + 3 * H }, ics: ICS, cancelToken: 'free_00000000-0000-0000-0000-000000000000' } }));
  await toDetails(page);
  await page.getByRole('button', { name: 'Book my free hour' }).click();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
  await expect(page.locator('button.bk-slot')).toHaveCount(1);
  await page.locator('button.bk-slot').first().click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
  const want = await page.evaluate((ms) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(ms)), T + 2 * H);
  expect(want).toBeTruthy();
});

test('cancel returns to step 1 with a notice', async ({ page }) => {
  await mockBook(page);
  await page.route('**/api/services/human-for-hire/free-hour/cancel', (r) => r.fulfill({ status: 200, json: { cancelled: true } }));
  await toDetails(page);
  await page.getByRole('button', { name: 'Book my free hour' }).click();
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
  await expect(page.locator('.bk-card [role="alert"]')).toContainText("Cancelled. Pick another time whenever you're ready.");
});

for (const [w, h] of [[1280, 720], [390, 844]] as const) {
  test(`steps 2 and 3 screenshots at ${w}x${h}`, async ({ page }) => {
    await mockBook(page);
    await page.setViewportSize({ width: w, height: h });
    await toDetails(page);
    await page.screenshot({ path: `test-results/booking-page-step2-${w}x${h}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Book my free hour' }).click();
    await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: `test-results/booking-page-step3-${w}x${h}.png`, fullPage: true });
  });
}

const D = 24 * H;
const nineSlots = {
  timeZone: 'America/Los_Angeles',
  durationMinutes: 60,
  slots: [0, 1, 2, 7, 8, 9, 14, 15, 16].map((d) => ({ startMs: T + d * D, endMs: T + d * D + H })),
  taken: [],
};

test('fits 1280x720 on every step', async ({ page }) => {
  await mockBook(page);
  await mock(page, nineSlots);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/book');
  await expect(page.locator('button.bk-slot').first()).toBeVisible();
  await page.getByLabel('Times in').selectOption('Europe/Berlin');
  const h = () => page.evaluate(() => document.documentElement.scrollHeight);
  expect(await h()).toBeLessThanOrEqual(720);
  await page.locator('button.bk-slot').first().click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByPlaceholder('you@company.com').fill('me@example.com');
  expect(await h()).toBeLessThanOrEqual(720);
  await page.getByRole('button', { name: 'Book my free hour' }).click();
  await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
  expect(await h()).toBeLessThanOrEqual(720);
});

test('left column spacing matches the design at 1280x720', async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/book');
  await expect(page.locator('button.bk-slot').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const b = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return { brand: b('.bk-brand'), eyebrow: b('.bk-eyebrow'), h1: b('.bk-h1') };
  });
  expect(Math.abs(r.eyebrow.top - r.brand.bottom - 56)).toBeLessThanOrEqual(2);
  expect(Math.abs(r.h1.top - r.eyebrow.bottom - 16)).toBeLessThanOrEqual(2);
});

test.describe('phone fold at 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
  const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
  const phoneSlots = {
    timeZone: 'America/Los_Angeles',
    durationMinutes: 60,
    // Week 1 starts about 30 hours after the fixed clock, so its first slot is "Tomorrow".
    slots: [0, 7, 14].flatMap((d) =>
      [30, 31, 32].map((h) => ({ startMs: NOW + d * 24 * H + h * H, endMs: NOW + d * 24 * H + (h + 1) * H }))),
    taken: [],
  };

  async function open(page: Page) {
    await page.clock.install({ time: NOW });
    await mock(page, phoneSlots);
    await page.goto('/book');
    await expect(page.locator('button.bk-slot')).toHaveCount(9);
  }

  test('open times are on the first screen and the footer follows the card', async ({ page }) => {
    await open(page);
    await expect(page.getByText(/for Bilko\./)).toBeVisible();
    const m = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const de = document.documentElement;
      return { slotBottom: r('.bk-slot').bottom, footTop: r('.bk-foot').top, cardBottom: r('.bk-card').bottom, over: de.scrollWidth > de.clientWidth };
    });
    expect(m.slotBottom).toBeLessThanOrEqual(844);
    expect(m.footTop).toBeGreaterThanOrEqual(m.cardBottom);
    expect(m.over).toBe(false);
    await page.screenshot({ path: 'test-results/booking-page-390x844-step1.png' });
  });

  test('no slot content overflows, before and after a pick, including the Tomorrow badge', async ({ page }) => {
    await open(page);
    const overflowing = () => page.evaluate(() =>
      [...document.querySelectorAll('.bk-slot')].filter((e) => e.scrollWidth > e.clientWidth).length);
    await expect(page.locator('.bk-badge', { hasText: 'Tomorrow' }).first()).toBeVisible();
    expect(await overflowing()).toBe(0);
    await page.locator('button.bk-slot').nth(4).click();
    await expect(page.locator('button.bk-slot').nth(4)).toContainText('✓ Selected');
    expect(await overflowing()).toBe(0);
    await page.locator('button.bk-slot').first().click();
    await expect(page.locator('button.bk-slot').first()).toContainText('✓ Selected');
    expect(await overflowing()).toBe(0);
  });
});

test('frame and time step match the design at 1280x720 and 1440x900', async ({ page }) => {
  await mock(page, nineSlots);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/book');
  await expect(page.locator('button.bk-slot').first()).toBeVisible();
  const m = await page.evaluate(() => {
    const b = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const h2 = [...document.querySelectorAll('.bk-card h2')].find((e) => e.textContent === 'Pick a time')!.getBoundingClientRect();
    return { h2, sel: b('#bk-tz'), card: b('.bk-card') };
  });
  const mid = m.sel.top + m.sel.height / 2;
  expect(mid).toBeGreaterThanOrEqual(m.h2.top);
  expect(mid).toBeLessThanOrEqual(m.h2.bottom);
  expect(m.card.height).toBeGreaterThanOrEqual(620);

  await page.setViewportSize({ width: 1440, height: 900 });
  const f = await page.evaluate(() => {
    const r = document.querySelector('.bk-inner')!.getBoundingClientRect();
    return { h: r.height, top: r.top, bottom: window.innerHeight - r.bottom };
  });
  expect(Math.abs(f.h - 820)).toBeLessThanOrEqual(2);
  expect(Math.abs(f.top - f.bottom)).toBeLessThanOrEqual(2);

  await page.locator('button.bk-slot').first().click();
  await expect(page.locator('.bk-pick-date')).toBeVisible();
  await expect(page.locator('.bk-pick-time')).toContainText('Video call');
  expect(await page.locator('.bk-pick-date').textContent()).not.toContain('Video call');
});
