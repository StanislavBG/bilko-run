import { chromium, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

const GAME_SLUGS = new Set(['sudoku', 'mindswiffer', 'game-academy']);
const TIMEOUT_MS = 30_000;

const CONSOLE_ERROR_IGNORE = [
  /favicon\.ico/i,
  /net::ERR_/i, // generic network errors (often dev noise)
  /Failed to load resource.*404/i,
];

interface TargetResult {
  status: TargetStatus;
  durationMs: number;
  notes: string;
}

async function runGenericSmoke(page: Page, target: SanityTarget): Promise<TargetResult> {
  const start = Date.now();
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!CONSOLE_ERROR_IGNORE.some(re => re.test(text))) {
        consoleErrors.push(text.slice(0, 200));
      }
    }
  });

  const response = await page.goto(target.url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) {
    return { status: 'fail', durationMs: Date.now() - start, notes: `HTTP ${response?.status() ?? 'n/a'}` };
  }

  // Check for expected text from manifest if available
  const manifestPath = join(target.localPublicPath, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (manifest.golden?.expect) {
        const bodyText = await page.textContent('body', { timeout: 5_000 }).catch(() => '');
        if (!bodyText?.includes(manifest.golden.expect)) {
          return {
            status: 'fail',
            durationMs: Date.now() - start,
            notes: `golden.expect "${manifest.golden.expect}" not found in body`,
          };
        }
      }
    } catch {
      // manifest read failed — skip expect check
    }
  }

  const durationMs = Date.now() - start;
  if (consoleErrors.length > 0) {
    return { status: 'warn', durationMs, notes: `${consoleErrors.length} console error(s): ${consoleErrors[0]}` };
  }
  return { status: 'pass', durationMs, notes: '' };
}

async function runSudokuSmoke(page: Page): Promise<TargetResult> {
  const start = Date.now();
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !CONSOLE_ERROR_IGNORE.some(re => re.test(msg.text()))) {
      consoleErrors.push(msg.text().slice(0, 200));
    }
  });

  const resp = await page.goto('https://bilko.run/projects/sudoku/', { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  if (!resp?.ok()) return { status: 'fail', durationMs: Date.now() - start, notes: `HTTP ${resp?.status()}` };

  // Try to start a new game — look for common new-game trigger patterns
  const newGameBtn = page.getByRole('button', { name: /new game|play|start/i }).first();
  const newGameExists = await newGameBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (newGameExists) {
    await newGameBtn.click();
    // Pick Lite difficulty if a picker appears
    const liteBtn = page.getByRole('button', { name: /lite|easy/i }).first();
    const liteExists = await liteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (liteExists) await liteBtn.click();
  }

  // Click a cell — look for grid cells
  const cell = page.locator('[data-cell],[class*="cell"],[class*="Cell"]').first();
  const cellExists = await cell.isVisible({ timeout: 5_000 }).catch(() => false);
  if (cellExists) {
    await cell.click();
    await page.keyboard.press('5'); // press a digit
  }

  const durationMs = Date.now() - start;
  if (consoleErrors.length > 0) {
    return { status: 'warn', durationMs, notes: `${consoleErrors.length} console error(s)` };
  }
  return { status: 'pass', durationMs, notes: newGameExists ? 'new-game flow OK' : 'loaded OK (new-game btn not found)' };
}

async function runMindSwifferSmoke(page: Page): Promise<TargetResult> {
  const start = Date.now();
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !CONSOLE_ERROR_IGNORE.some(re => re.test(msg.text()))) {
      consoleErrors.push(msg.text().slice(0, 200));
    }
  });

  const resp = await page.goto('https://bilko.run/projects/mindswiffer/', { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  if (!resp?.ok()) return { status: 'fail', durationMs: Date.now() - start, notes: `HTTP ${resp?.status()}` };

  // Pick Lite difficulty
  const liteBtn = page.getByRole('button', { name: /lite|easy/i }).first();
  const liteExists = await liteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (liteExists) await liteBtn.click();

  // Click a cell to reveal
  const cell = page.locator('[data-cell],[class*="cell"],[class*="Cell"],[class*="tile"]').first();
  const cellExists = await cell.isVisible({ timeout: 5_000 }).catch(() => false);
  if (cellExists) {
    await cell.click();
    // Wait a moment for flood-fill
    await page.waitForTimeout(500);
    // Try to place a flag: right-click another cell
    const cells = page.locator('[data-cell],[class*="cell"],[class*="Cell"],[class*="tile"]');
    const count = await cells.count();
    if (count > 1) {
      await cells.nth(1).click({ button: 'right' });
    }
  }

  const durationMs = Date.now() - start;
  if (consoleErrors.length > 0) {
    return { status: 'warn', durationMs, notes: `${consoleErrors.length} console error(s)` };
  }
  return { status: 'pass', durationMs, notes: cellExists ? 'reveal+flag flow OK' : 'loaded OK (cells not found)' };
}

async function runGameAcademySmoke(page: Page): Promise<TargetResult> {
  const start = Date.now();
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !CONSOLE_ERROR_IGNORE.some(re => re.test(msg.text()))) {
      consoleErrors.push(msg.text().slice(0, 200));
    }
  });

  const resp = await page.goto('https://bilko.run/projects/game-academy/', { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  if (!resp?.ok()) return { status: 'fail', durationMs: Date.now() - start, notes: `HTTP ${resp?.status()}` };

  // Try to fire a shot — click the canvas or a fire button
  const canvas = page.locator('canvas').first();
  const canvasExists = await canvas.isVisible({ timeout: 5_000 }).catch(() => false);
  if (canvasExists) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    }
  }

  const durationMs = Date.now() - start;
  if (consoleErrors.length > 0) {
    return { status: 'warn', durationMs, notes: `${consoleErrors.length} console error(s)` };
  }
  return { status: 'pass', durationMs, notes: canvasExists ? 'canvas click OK' : 'loaded OK (canvas not found)' };
}

export async function runSmoke(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const rows: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const target of targets) {
      const page = await browser.newPage();
      page.setDefaultTimeout(TIMEOUT_MS);

      let result: TargetResult;
      try {
        if (target.slug === 'sudoku') {
          result = await runSudokuSmoke(page);
        } else if (target.slug === 'mindswiffer') {
          result = await runMindSwifferSmoke(page);
        } else if (target.slug === 'game-academy') {
          result = await runGameAcademySmoke(page);
        } else {
          result = await runGenericSmoke(page, target);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message.slice(0, 200) : String(e);
        result = { status: 'fail', durationMs: 0, notes: msg };
      } finally {
        await page.close();
      }

      perTarget[target.slug] = result.status;
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '🟡' : '❌';
      rows.push(`| ${target.slug} | ${icon} | ${(result.durationMs / 1000).toFixed(1)}s | ${result.notes} |`);

      if (failFast && result.status === 'fail') break;
    }
  } finally {
    await browser.close();
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn') ? 'warn'
    : allStatuses.some(s => s === 'error') ? 'error'
    : 'pass';

  const sectionMd = [
    '## Smoke\n',
    '| Target | Status | Duration | Notes |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');

  return {
    name: 'smoke',
    status,
    perTarget,
    details: `${allStatuses.filter(s => s === 'pass').length}/${targets.length} passed`,
    sectionMd,
  };
}
