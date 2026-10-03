import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

// PRD: blog.config.yaml's cadence.no_new_work_fallback (spotlight) and
// cadence.current_post_published_at (authored_at) landed in a prior PRD. This suite guards that
// the blog-from-git skill's prose (SKILL.md, rotation.md, seed.md) actually describes spotlight
// mode and the no-backdating rule for current posts, so a human-invoked /blog-from-git run
// doesn't skip or backdate a spotlight post.

const SKILL_DIR = join(__dirname, '../.claude/skills/blog-from-git');

let config: any;
let skillMd: string;
let rotationMd: string;
let seedMd: string;

beforeAll(() => {
  config = yaml.load(readFileSync(join(SKILL_DIR, 'blog.config.yaml'), 'utf-8'));
  skillMd = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  rotationMd = readFileSync(join(SKILL_DIR, 'rotation.md'), 'utf-8');
  seedMd = readFileSync(join(SKILL_DIR, 'seed.md'), 'utf-8');
});

describe('blog.config.yaml: spotlight fallback is the authority prose must match', () => {
  it('sets cadence.no_new_work_fallback to spotlight', () => {
    expect(config.cadence.no_new_work_fallback).toBe('spotlight');
  });
});

describe('sub-skill prose: spotlight mode is documented', () => {
  it('SKILL.md mentions spotlight mode', () => {
    expect(skillMd).toMatch(/spotlight/i);
  });

  it('rotation.md mentions spotlight mode', () => {
    expect(rotationMd).toMatch(/spotlight/i);
  });

  it('seed.md mentions spotlight mode', () => {
    expect(seedMd).toMatch(/spotlight/i);
  });

  it('SKILL.md Mode decision lists spotlight as a fourth mode alongside portfolio/focused/catch-up', () => {
    const modeSection = skillMd.match(/## Mode decision[\s\S]{0,1500}/i);
    expect(modeSection).not.toBeNull();
    expect(modeSection![0]).toMatch(/\*\*Portfolio\*\*/);
    expect(modeSection![0]).toMatch(/\*\*Focused\*\*/);
    expect(modeSection![0]).toMatch(/\*\*Catch-up\*\*/);
    expect(modeSection![0]).toMatch(/\*\*Spotlight\*\*/i);
  });

  it('rotation.md explains spotlight subject selection: never-covered first, then oldest ledger row, cooldown still applies', () => {
    const spotlightSection = rotationMd.match(/spotlight[\s\S]{0,1200}/i);
    expect(spotlightSection).not.toBeNull();
    expect(spotlightSection![0].toLowerCase()).toMatch(/never[- ]covered/);
    expect(spotlightSection![0].toLowerCase()).toMatch(/oldest/);
    expect(spotlightSection![0].toLowerCase()).toMatch(/cooldown/);
    expect(spotlightSection![0].toLowerCase()).toMatch(/ledger row/);
  });

  it('seed.md references current_post_published_at and the authored-time rule', () => {
    expect(seedMd).toMatch(/current_post_published_at/);
  });

  it('seed.md states backdating applies only to catch-up backfill posts, keeping the never-new-Date rule', () => {
    expect(seedMd.toLowerCase()).toMatch(/catch-up/);
    expect(seedMd).toMatch(/new Date\(\)/);
  });
});
