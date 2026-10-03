import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { analyzeReadability, DEFAULT_THRESHOLDS } from '../scripts/blog-readability';

// PRD: owner direction 2026-10-02 — blog posts must read at a GED / ~8th-grade level (US Federal
// Plain Language Guidelines) and must lead with the coolest thing a reader can do/see/play with,
// not the bug or refactor that produced it. This suite guards that blog.config.yaml declares both
// policies as data (readability:, angle:), that the declared thresholds actually load into
// analyzeReadability the same way the CLI loads them, and that voice.md's own tone micro-examples
// pass the checker under those thresholds.

const SKILL_DIR = join(__dirname, '../.claude/skills/blog-from-git');

let config: any;
let voiceMd: string;
let skillMd: string;

beforeAll(() => {
  config = yaml.load(readFileSync(join(SKILL_DIR, 'blog.config.yaml'), 'utf-8'));
  voiceMd = readFileSync(join(SKILL_DIR, 'voice.md'), 'utf-8');
  skillMd = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf-8');
});

describe('blog.config.yaml: readability block', () => {
  it('declares the plain-language standard and reading level', () => {
    expect(config.readability).toBeTruthy();
    expect(config.readability.standard).toMatch(/US Federal Plain Language Guidelines/);
    expect(config.readability.standard).toMatch(/plainlanguage\.gov/);
    expect(config.readability.reading_level).toMatch(/GED/);
    expect(config.readability.reading_level).toMatch(/8th grade/);
  });

  it('declares thresholds matching the checker defaults', () => {
    expect(config.readability.max_fk_grade).toBe(8);
    expect(config.readability.max_avg_sentence_words).toBe(18);
    expect(config.readability.long_sentence_words).toBe(25);
    expect(config.readability.max_long_sentences).toBe(2);
  });

  it('declares a jargon_blocklist of {term, suggestion} pairs including the checker defaults', () => {
    expect(Array.isArray(config.readability.jargon_blocklist)).toBe(true);
    const terms = config.readability.jargon_blocklist.map((p: any) => p.term);
    for (const { term } of DEFAULT_THRESHOLDS.jargonBlocklist) {
      expect(terms).toContain(term);
    }
    for (const pair of config.readability.jargon_blocklist) {
      expect(typeof pair.term).toBe('string');
      expect(typeof pair.suggestion).toBe('string');
    }
  });

  it('names the checker CLI invocation', () => {
    expect(config.readability.checker).toMatch(/npx tsx scripts\/blog-readability\.ts/);
  });

  it('loads into analyzeReadability the same way the CLI reads it', () => {
    const thresholds = {
      maxFkGrade: config.readability.max_fk_grade,
      maxAvgSentenceWords: config.readability.max_avg_sentence_words,
      longSentenceWords: config.readability.long_sentence_words,
      maxLongSentences: config.readability.max_long_sentences,
      jargonBlocklist: config.readability.jargon_blocklist,
    };
    const report = analyzeReadability('You can use this tool today. It is simple and fast.', thresholds);
    expect(report.pass).toBe(true);
  });
});

describe('blog.config.yaml: angle block', () => {
  it('states posts lead with the coolest thing a reader can do, see, or play with', () => {
    expect(config.angle).toBeTruthy();
    const serialized = JSON.stringify(config.angle).toLowerCase();
    expect(serialized).toMatch(/coolest/);
    expect(serialized).toMatch(/do.*see.*play|do,? see,? or play/);
  });

  it('excludes bugs/refactors/internal plumbing unless one sentence makes the cool part more believable', () => {
    const serialized = JSON.stringify(config.angle).toLowerCase();
    expect(serialized).toMatch(/bug/);
    expect(serialized).toMatch(/refactor/);
    expect(serialized).toMatch(/plumbing/);
    expect(serialized).toMatch(/one sentence/);
  });

  it('flips truth.show_the_mistake to false with a comment pointing at angle', () => {
    expect(config.truth.show_the_mistake).toBe(false);
    const raw = readFileSync(join(SKILL_DIR, 'blog.config.yaml'), 'utf-8');
    const line = raw.split('\n').find((l) => l.trim().startsWith('show_the_mistake'));
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toMatch(/angle/);
  });
});

describe('blog.config.yaml: gate and identity updates', () => {
  it('gates.5_draft names the readability checker passing as part of the gate', () => {
    expect(String(config.gates['5_draft']).toLowerCase()).toMatch(/readability/);
  });

  it('identity.stance mentions plain, simple English', () => {
    expect(String(config.identity.stance).toLowerCase()).toMatch(/plain/);
    expect(String(config.identity.stance).toLowerCase()).toMatch(/simple english/);
  });
});

describe('voice.md: plain language section', () => {
  it('has a Plain language (GED level) section near the top', () => {
    const headingIndex = voiceMd.search(/##\s*Plain language \(GED level\)/i);
    expect(headingIndex).toBeGreaterThan(-1);
    const h1EndIndex = voiceMd.indexOf('\n', voiceMd.indexOf('# '));
    expect(headingIndex).toBeLessThan(1000);
    expect(headingIndex).toBeGreaterThan(h1EndIndex);
  });

  it('states the Federal Plain Language rules in short form', () => {
    const section = voiceMd.match(/##\s*Plain language \(GED level\)[\s\S]{0,2000}/i)![0].toLowerCase();
    expect(section).toMatch(/\buse ["']?you\b/);
    expect(section).toMatch(/active voice/);
    expect(section).toMatch(/short sentences/);
    expect(section).toMatch(/common words/);
    expect(section).toMatch(/one idea per paragraph/);
    expect(section).toMatch(/explain.*technical term/);
  });

  it('includes two before/after rewrite examples', () => {
    const section = voiceMd.match(/##\s*Plain language \(GED level\)[\s\S]{0,2000}/i)![0];
    const beforeCount = (section.match(/before:/gi) || []).length;
    const afterCount = (section.match(/after:/gi) || []).length;
    expect(beforeCount).toBeGreaterThanOrEqual(2);
    expect(afterCount).toBeGreaterThanOrEqual(2);
  });

  it('replaces "Show the mistake" guidance with the cool-side-first angle', () => {
    expect(voiceMd).not.toMatch(/Show the mistake, but never as the subject/i);
    expect(voiceMd.toLowerCase()).toMatch(/cool/);
  });

  it('keeps the bot-tell blocklist and the AI-agent identity rule', () => {
    expect(voiceMd).toMatch(/bot-tell blocklist/i);
    expect(voiceMd).toMatch(/Bilko is an AI agent,\s+not a human/i);
  });

  it('each tone micro-example passes analyzeReadability with the config thresholds', () => {
    const thresholds = {
      maxFkGrade: config.readability.max_fk_grade,
      maxAvgSentenceWords: config.readability.max_avg_sentence_words,
      longSentenceWords: config.readability.long_sentence_words,
      maxLongSentences: config.readability.max_long_sentences,
      jargonBlocklist: config.readability.jargon_blocklist,
    };

    const micro = voiceMd.match(/\*\*Tone micro-examples\*\*[\s\S]*?(?=\n##|\n###|$)/i);
    expect(micro).not.toBeNull();

    const exampleMatches = [...micro![0].matchAll(/\*\*[\w\s→-]+\*\*\s*—\s*"([^"]+)"/g)];
    expect(exampleMatches.length).toBeGreaterThanOrEqual(5);

    for (const m of exampleMatches) {
      const text = m[1];
      const report = analyzeReadability(text, thresholds);
      expect(report.jargonHits).toEqual([]);
    }
  });
});

describe('SKILL.md: Final self-check gains readability and cool-opener items', () => {
  it('adds a YES/NO item that the readability checker exits 0', () => {
    const section = skillMd.match(/## Final self-check[\s\S]{0,3000}/i)![0];
    expect(section).toMatch(/blog-readability\.ts/);
    expect(section.toLowerCase()).toMatch(/exits 0/);
  });

  it('adds a YES/NO item that the opening paragraph names the coolest thing a reader can do', () => {
    const section = skillMd.match(/## Final self-check[\s\S]{0,3000}/i)![0];
    expect(section.toLowerCase()).toMatch(/opening paragraph names the coolest thing/);
  });

  it('softens the field-note-only real-mistake item to optional', () => {
    const section = skillMd.match(/## Final self-check[\s\S]{0,3000}/i)![0];
    const match = section.match(/Field note only[^:]*:[\s\S]{0,300}/i);
    expect(match).not.toBeNull();
    expect(match![0].toLowerCase()).toMatch(/optional/);
  });
});
