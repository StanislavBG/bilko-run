import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

// PRD: fix the blog-from-git skill so a post's git/commit history selects WHICH PROJECT and
// WHAT WINDOW to write about, never the post's subject matter. blog.config.yaml's identity.post_is
// already stated the correct intent ("a product update — what the reader can now DO, not the
// engineering it took"); this suite guards that the config states the rule explicitly and that no
// sub-skill prose still licenses the rejected post-mortem genre (see the shipped post
// 8305663 for the concrete failure this fixes).

const SKILL_DIR = join(__dirname, '../.claude/skills/blog-from-git');

let config: any;
let researchMd: string;
let voiceMd: string;
let skillMd: string;
let rotationMd: string;
let groundMd: string;

beforeAll(() => {
  config = yaml.load(readFileSync(join(SKILL_DIR, 'blog.config.yaml'), 'utf-8'));
  researchMd = readFileSync(join(SKILL_DIR, 'research.md'), 'utf-8');
  voiceMd = readFileSync(join(SKILL_DIR, 'voice.md'), 'utf-8');
  skillMd = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  rotationMd = readFileSync(join(SKILL_DIR, 'rotation.md'), 'utf-8');
  groundMd = readFileSync(join(SKILL_DIR, 'ground.md'), 'utf-8');
});

describe('blog.config.yaml: focus-vs-content grounding rule', () => {
  it('declares a grounding block stating git selects focus/window only, not subject matter', () => {
    expect(config.grounding).toBeTruthy();
    expect(String(config.grounding.git_selects).toLowerCase()).toMatch(/focus/);
    expect(String(config.grounding.git_selects).toLowerCase()).toMatch(/window/);
    expect(String(config.grounding.git_does_not_supply).toLowerCase()).toMatch(/subject/);
  });

  it('keeps identity.post_is as the product-update framing (the config was already right)', () => {
    expect(config.identity.post_is).toMatch(/product update/i);
    expect(config.identity.post_is).toMatch(/not the engineering it took/i);
  });

  it('requires that value claims still be sourced — shifting genre does not license unsourced marketing', () => {
    expect(config.grounding.value_claims_still_need_sources).toBe(true);
    expect(config.grounding.value_claims_still_need_sources).not.toBe(false);
  });

  it('handles a project with no user-facing surface explicitly (ineligible or a stated alternative)', () => {
    expect(config.grounding.ineligible_subject).toBeTruthy();
    expect(String(config.grounding.ineligible_subject)).toMatch(/ineligible|context only/i);
  });

  it('does not weaken the truth rules: no_invented_metrics, every_number_needs_a_source, honest-only backdating', () => {
    expect(config.truth.no_invented_metrics).toBe(true);
    expect(config.truth.every_number_needs_a_source).toBe(true);
    expect(config.cadence.backdating).toBe('honest-only');
  });

  it('leaves max_ctas_per_post at 1 — the how-to-use payload is prose + one link, not a CTA pile', () => {
    expect(config.links.max_ctas_per_post).toBe(1);
  });
});

describe('blog.config.yaml: every tone carries a required value/use payload', () => {
  const toneNames = ['changelog', 'shipped-note', 'problem-outcome', 'field-note', 'metric-update'];

  it('defines the shared required_value_use_payload rule', () => {
    expect(config.tones.required_value_use_payload).toBeTruthy();
    const rule = String(config.tones.required_value_use_payload).toLowerCase();
    expect(rule).toMatch(/what.*(is for|for)/);
    expect(rule).toMatch(/who it helps/);
    expect(rule).toMatch(/how a reader starts using it/);
  });

  it.each(toneNames)('tone "%s" references the required value/use payload', (name) => {
    expect(config.tones[name]).toBeTruthy();
    expect(config.tones[name].payload).toBe('required_value_use_payload');
  });

  it('redefines field-note so the bug/decision must serve a value/use point, not be the subject', () => {
    const shape = String(config.tones['field-note'].shape).toLowerCase();
    expect(shape).toMatch(/proof/);
    expect(shape).toMatch(/not.*(the )?subject/);
  });
});

describe('sub-skill prose: no file still makes engineering detail or a bug the primary material', () => {
  it('research.md no longer claims honest admissions "reliably yield the best material in the post"', () => {
    expect(researchMd).not.toMatch(/reliably yields? the best material in the post/i);
  });

  it('research.md demotes the hardest-engineering-detail and honest-admissions items to optional supporting color', () => {
    const supportingColorSection = researchMd.match(
      /Supporting color[\s\S]{0,600}/i
    );
    expect(supportingColorSection).not.toBeNull();
    expect(supportingColorSection![0].toLowerCase()).toMatch(/optional/);
    expect(supportingColorSection![0].toLowerCase()).toMatch(/subordinate/);
  });

  it('research.md promotes the value/use payload (what it is, before/after, how to use) ahead of engineering color', () => {
    const whatItIsForIndex = researchMd.search(/What the project IS and WHO it's for/i);
    const howToStartIndex = researchMd.search(/How a reader starts using it right now/i);
    const supportingColorIndex = researchMd.search(/Supporting color/i);
    expect(whatItIsForIndex).toBeGreaterThan(-1);
    expect(howToStartIndex).toBeGreaterThan(-1);
    expect(supportingColorIndex).toBeGreaterThan(-1);
    expect(whatItIsForIndex).toBeLessThan(supportingColorIndex);
    expect(howToStartIndex).toBeLessThan(supportingColorIndex);
  });

  it('voice.md marks "why it was hard or non-obvious" as optional and subordinate, not a required bullet', () => {
    const match = voiceMd.match(/Why it was hard or non-obvious[\s\S]{0,400}/i);
    expect(match).not.toBeNull();
    expect(match![0].toLowerCase()).toMatch(/optional/);
    expect(match![0].toLowerCase()).toMatch(/subordinate/);
  });

  it('voice.md requires the how-to-use payload as one of the required bullets', () => {
    expect(voiceMd).toMatch(/How a reader starts using it right now/i);
  });

  it('voice.md field-note tone row/example no longer licenses a bare bug narrative with no value point', () => {
    const row = voiceMd.match(/\|\s*4\s*\|\s*\*\*Field note\*\*[\s\S]{0,400}/i);
    expect(row).not.toBeNull();
    expect(row![0].toLowerCase()).toMatch(/proof/);
    expect(row![0].toLowerCase()).not.toMatch(/one hard bug\/decision told well, one lesson, one concrete artifact \|/i);
  });

  it('SKILL.md phase-5 self-check gains the reader-can-use-it gate with an explicit fail condition', () => {
    const checkMatch = skillMd.match(
      /Does a reader who has never heard of this project finish the post knowing what it does for\s*\n?\s*them and how to try it\?[\s\S]{0,500}/i
    );
    expect(checkMatch).not.toBeNull();
    expect(checkMatch![0].toLowerCase()).toMatch(/fails? if the post's main narrative/);
    expect(checkMatch![0].toLowerCase()).toMatch(/bug, an error code, or an internal refactor/);
  });

  it('rotation.md and ground.md reference the grounding block rather than contradicting it', () => {
    expect(rotationMd).toMatch(/grounding\.ineligible_subject/);
    expect(groundMd).toMatch(/grounding:.*policy|grounding.*policy/i);
  });
});
