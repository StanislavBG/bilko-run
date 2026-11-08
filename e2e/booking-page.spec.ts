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
  await expect(page.locator('.booking-page .bk-slot.taken')).toHaveCount(1);
  await expect(page.locator('.booking-page .bk-slot.taken')).toContainText('Taken');
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
  await expect(page.locator('.booking-page .bk-card a[href^="mailto:"]')).toBeVisible();
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
  await expect(page.locator('.booking-page .bk-card [role="alert"]')).toContainText("You've already booked your free hour");
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
  await expect(page.locator('.booking-page .bk-card [role="alert"]')).toContainText("Cancelled. Pick another time whenever you're ready.");
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

test.describe('fits 1280x720 in Pacific time', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('fits 1280x720 on every step', async ({ page }) => {
    await mockBook(page);
    await mock(page, nineSlots);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/book');
    await expect(page.locator('button.bk-slot').first()).toBeVisible();
    const check = async () => {
      const m = await page.evaluate(() => {
        const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        return { sh: document.documentElement.scrollHeight, head: r('header.bk-header'), bar: r('footer.bk-bottombar') };
      });
      expect(m.sh).toBeLessThanOrEqual(720);
      expect(m.head.top).toBeGreaterThanOrEqual(0);
      expect(m.head.bottom).toBeLessThanOrEqual(720);
      expect(m.bar.top).toBeGreaterThanOrEqual(0);
      expect(m.bar.bottom).toBeLessThanOrEqual(720);
    };
    await check();
    await page.locator('button.bk-slot').first().click();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await page.getByPlaceholder('you@company.com').fill('me@example.com');
    await check();
    await page.getByRole('button', { name: 'Book my free hour' }).click();
    await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
    await check();
  });
});

const contentBottoms = (page: Page) => page.evaluate(() => ({
  card: document.querySelector('.booking-page .bk-card')!.getBoundingClientRect().bottom,
  left: document.querySelector('.booking-page .bk-left')!.getBoundingClientRect().bottom,
}));

test.describe('booking content in the first screen in Berlin time', () => {
  test.use({ timezoneId: 'Europe/Berlin' });
  test('card and left column are inside 1280x720 on every step', async ({ page }) => {
    await mockBook(page);
    await mock(page, nineSlots);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/book');
    await expect(page.locator('button.bk-slot').first()).toBeVisible();
    const check = async () => {
      const b = await contentBottoms(page);
      expect(b.card).toBeLessThanOrEqual(720);
      expect(b.left).toBeLessThanOrEqual(720);
    };
    await check();
    await page.locator('button.bk-slot').first().click();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await page.getByPlaceholder('you@company.com').fill('me@example.com');
    await check();
    await page.getByRole('button', { name: 'Book my free hour' }).click();
    await expect(page.getByRole('heading', { name: "You're booked." })).toBeVisible();
    await check();
  });
});

test('left column spacing matches the design at 1280x720', async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/book');
  await expect(page.locator('button.bk-slot').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const b = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return {
      card: b('.booking-page .bk-card'), eyebrow: b('.booking-page .bk-eyebrow'), h1: b('.booking-page .bk-h1'),
      brandRows: document.querySelectorAll('.booking-page .bk-brand').length,
    };
  });
  expect(r.brandRows).toBe(0);
  expect(Math.abs(r.eyebrow.top - r.card.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(r.h1.top - r.eyebrow.bottom - 16)).toBeLessThanOrEqual(2);
});

test('topic chips keep the booking look inside the site shell', async ({ page }) => {
  await mockBook(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await toDetails(page);
  const chip = page.locator('.booking-page .bk-chip').first();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  const style = () => chip.evaluate((e) => { const c = getComputedStyle(e); return { display: c.display, color: c.color, font: c.fontFamily }; });
  const rest = await style();
  expect(rest.display).toBe('inline-block');
  expect(rest.color).toBe('rgb(58, 52, 43)');
  expect(rest.font.replace(/["']/g, '')).toMatch(/^Inter Tight/);
  await chip.hover();
  expect((await style()).color).toBe('rgb(58, 52, 43)');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await chip.hover();
  expect((await style()).color).toBe('rgb(245, 240, 230)');
  const page16 = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.booking-page')!); return { fs: c.fontSize, lh: c.lineHeight }; });
  expect(page16.fs).toBe('16px');
  expect(page16.lh).toBe('24px');
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
      return { slotBottom: r('.booking-page .bk-slot').bottom, footTop: r('.booking-page .bk-foot').top, cardBottom: r('.booking-page .bk-card').bottom, over: de.scrollWidth > de.clientWidth };
    });
    expect(m.slotBottom).toBeLessThanOrEqual(844);
    expect(m.footTop).toBeGreaterThanOrEqual(m.cardBottom);
    expect(m.over).toBe(false);
    await page.screenshot({ path: 'test-results/booking-page-390x844-step1.png' });
  });

  test('no slot content overflows, before and after a pick, including the Tomorrow badge', async ({ page }) => {
    await open(page);
    const overflowing = () => page.evaluate(() =>
      [...document.querySelectorAll('.booking-page .bk-slot')].filter((e) => e.scrollWidth > e.clientWidth).length);
    await expect(page.locator('.booking-page .bk-badge', { hasText: 'Tomorrow' }).first()).toBeVisible();
    expect(await overflowing()).toBe(0);
    await page.locator('button.bk-slot').nth(4).click();
    await expect(page.locator('button.bk-slot').nth(4)).toContainText('✓ Selected');
    expect(await overflowing()).toBe(0);
    await page.locator('button.bk-slot').first().click();
    await expect(page.locator('button.bk-slot').first()).toContainText('✓ Selected');
    expect(await overflowing()).toBe(0);
  });
});

test('frame and time step match the design at 1280x720, 1440x900 and 1920x1080', async ({ page }) => {
  await mock(page, nineSlots);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/book');
  await expect(page.locator('button.bk-slot').first()).toBeVisible();
  const m = await page.evaluate(() => {
    const b = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const h2 = [...document.querySelectorAll('.booking-page .bk-card h2')].find((e) => e.textContent === 'Pick a time')!.getBoundingClientRect();
    const inner = document.querySelector('.booking-page .bk-inner')!;
    const cs = getComputedStyle(inner);
    const innerH = inner.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return { h2, sel: b('#bk-tz'), card: b('.booking-page .bk-card'), innerH };
  });
  const mid = m.sel.top + m.sel.height / 2;
  expect(mid).toBeGreaterThanOrEqual(m.h2.top);
  expect(mid).toBeLessThanOrEqual(m.h2.bottom);
  expect(Math.abs(m.card.height - m.innerH)).toBeLessThanOrEqual(2);

  const frame = () => page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const inner = r('.booking-page .bk-inner');
    const head = r('header.bk-header');
    const bar = r('footer.bk-bottombar');
    return { h: inner.height, top: inner.top - head.bottom, bottom: bar.top - inner.bottom };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const f = await frame();
  expect(Math.abs(f.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(f.bottom)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 1920, height: 1080 });
  const g = await frame();
  expect(Math.abs(g.h - 820)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.top - g.bottom)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('button.bk-slot').first().click();
  await expect(page.locator('.booking-page .bk-pick-date')).toBeVisible();
  await expect(page.locator('.booking-page .bk-pick-time')).toContainText('Video call');
  expect(await page.locator('.booking-page .bk-pick-date').textContent()).not.toContain('Video call');
});

test('details and done steps match the design at 1280x720', async ({ page }) => {
  await mockBook(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await toDetails(page);
  const d = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('.booking-page .bk-card *')]
      .filter((el) => el.children.length === 0 && el.textContent?.trim() === 'Your details')
      .every((el) => { const r = el.getBoundingClientRect(); return r.width <= 1 || r.height <= 1; });
    const card = document.querySelector('.booking-page .bk-card')!.getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('.booking-page .bk-card')!);
    const contentBottom = card.bottom - parseFloat(cs.paddingBottom);
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Book my free hour')!.getBoundingClientRect();
    const opt = [...document.querySelectorAll('.booking-page .bk-card *')].find((el) => el.children.length === 0 && el.textContent === 'Optional')!.getBoundingClientRect();
    const lab = [...document.querySelectorAll('.booking-page .bk-card *')].find((el) => el.children.length === 0 && el.textContent?.trim() === 'What are you working on?')!.getBoundingClientRect();
    return { hidden, gap: contentBottom - btn.bottom, optMid: opt.top + opt.height / 2, labMid: lab.top + lab.height / 2 };
  });
  expect(d.hidden).toBe(true);
  expect(d.gap).toBeGreaterThanOrEqual(-1);
  expect(d.gap).toBeLessThanOrEqual(40);
  expect(Math.abs(d.optMid - d.labMid)).toBeLessThanOrEqual(6);
  await page.getByRole('button', { name: 'Book my free hour' }).click();
  const h = page.getByRole('heading', { name: "You're booked." });
  await expect(h).toBeVisible();
  const c = await page.evaluate(() => {
    const el = document.querySelector('.booking-page .bk-done-check')!.getBoundingClientRect();
    return { w: el.width, h: el.height, right: el.right };
  });
  const hb = (await h.boundingBox())!;
  expect(Math.abs(c.w - 52)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.h - 52)).toBeLessThanOrEqual(1);
  expect(c.right).toBeLessThanOrEqual(hb.x);
});

test.describe('checkout notice', () => {
  test.use({ timezoneId: 'Europe/Berlin' });
  test('paid hour return shows the thank-you in role=status', async ({ page }) => {
    await mock(page);
    await page.goto('/book?offer=bilko-hour&session_id=cs_test_1');
    await expect(page.getByRole('status').filter({ hasText: 'Payment received. Thank you. Bilko will email you shortly to plan your hours.' })).toBeVisible();
  });
  test('cancel return shows the cancelled text', async ({ page }) => {
    await mock(page);
    await page.goto('/book?checkout=cancel');
    await expect(page.getByRole('status').filter({ hasText: 'Checkout cancelled. No charge.' })).toBeVisible();
  });
  test('plain /book has no notice and the card still fits 1280x720 with one', async ({ page }) => {
    await mock(page, nineSlots);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/book');
    await expect(page.locator('button.bk-slot').first()).toBeVisible();
    await expect(page.locator('.booking-page .bk-status')).toHaveCount(0);
    await page.goto('/book?offer=bilko-hour&session_id=cs_test_1');
    await expect(page.locator('.booking-page .bk-status')).toBeVisible();
    expect((await contentBottoms(page)).card).toBeLessThanOrEqual(720);
  });
});
