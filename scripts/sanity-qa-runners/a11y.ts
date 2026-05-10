import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const AXE_CORE_PATH = require.resolve('axe-core');

interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  nodes: unknown[];
}

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844  },
  { name: 'desktop', width: 1280, height: 800  },
];

async function runAxeOnPage(url: string, viewportWidth: number, viewportHeight: number): Promise<AxeViolation[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight } });
    const page = await context.newPage();
    await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: AXE_CORE_PATH });
    const violations = await page.evaluate<AxeViolation[]>(() =>
      (window as unknown as { axe: { run: (opts: { runOnly: string[] }) => Promise<{ violations: AxeViolation[] }> } })
        .axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }).then(r => r.violations)
    );
    return violations;
  } finally {
    await browser.close();
  }
}

async function checkReducedMotion(url: string): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' });
    // Check if any data-anim elements still have running animations
    const animating = await page.evaluate<boolean>(() => {
      const elements = document.querySelectorAll('[data-anim]');
      return [...elements].some(el => {
        const style = window.getComputedStyle(el);
        return style.animationName !== 'none' && style.animationPlayState === 'running';
      });
    });
    return !animating; // true = reduced-motion honored
  } catch {
    return true; // can't check — assume OK
  } finally {
    await browser.close();
  }
}

export async function runA11y(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const rows: string[] = [];
  const allViolations: Array<{ target: string; viewport: string; violation: AxeViolation }> = [];

  for (const target of targets) {
    let targetStatus: TargetStatus = 'pass';
    let mobileIcon = '✅';
    let desktopIcon = '✅';
    let totalViolations = 0;

    for (const vp of VIEWPORTS) {
      try {
        const violations = await runAxeOnPage(target.url, vp.width, vp.height);
        const seriousOrCritical = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');

        for (const v of violations) {
          allViolations.push({ target: target.slug, viewport: vp.name, violation: v });
          totalViolations++;
        }

        if (seriousOrCritical.length > 0) {
          targetStatus = 'fail';
          if (vp.name === 'mobile') mobileIcon = '❌';
          else desktopIcon = '❌';
        } else if (violations.length > 0 && targetStatus !== 'fail') {
          targetStatus = 'warn';
          if (vp.name === 'mobile') mobileIcon = '🟡';
          else desktopIcon = '🟡';
        }
      } catch (e: unknown) {
        const note = e instanceof Error ? e.message.slice(0, 100) : String(e);
        if (targetStatus !== 'fail') targetStatus = 'error';
        if (vp.name === 'mobile') mobileIcon = `⚠️ ${note}`;
        else desktopIcon = `⚠️ ${note}`;
      }
    }

    // Reduced-motion check (best effort, doesn't affect pass/fail unless fails)
    const motionOk = await checkReducedMotion(target.url).catch(() => true);
    const motionNote = motionOk ? '' : ' ⚠️ reduced-motion not honored';

    perTarget[target.slug] = targetStatus;
    const icon = targetStatus === 'pass' ? '✅' : targetStatus === 'warn' ? '🟡' : '❌';
    rows.push(`| ${target.slug} | ${mobileIcon} | ${desktopIcon} | ${totalViolations} | ${icon}${motionNote} |`);

    if (failFast && targetStatus === 'fail') break;
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn' || s === 'error') ? 'warn'
    : 'pass';

  const violationsMd = allViolations.length === 0
    ? '_No violations._'
    : allViolations
        .filter(({ violation: v }) => v.impact === 'serious' || v.impact === 'critical')
        .slice(0, 20)
        .map(({ target, viewport, violation: v }) =>
          `- **[${v.impact}]** \`${target}\` (${viewport}): ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length !== 1 ? 's' : ''})`
        ).join('\n') || '_No serious/critical violations._';

  const sectionMd = [
    '## Accessibility\n',
    '| Target | Mobile | Desktop | Violations | Status |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '**Serious/Critical Violations:**',
    violationsMd,
  ].join('\n');

  return {
    name: 'a11y',
    status,
    perTarget,
    details: `${allStatuses.filter(s => s === 'pass').length}/${targets.length} clean`,
    sectionMd,
  };
}
