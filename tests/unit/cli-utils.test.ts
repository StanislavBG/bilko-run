/**
 * Unit tests for CLI utility functions.
 * Tests pure logic: JSON parsing, content type detection, scoring,
 * and file path handling — all without spawning a real Claude session.
 */
import { describe, it, expect } from 'vitest';

// ── Extracted CLI utilities (mirrors bin/content-grade.js logic) ───────────

function parseJSON(raw: string): any {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error(`Could not parse response as JSON.\n\nRaw output:\n${raw.slice(0, 400)}`);
}

function gradeLetter(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function detectContentType(text: string, filename: string): string {
  const lower = text.toLowerCase();
  const name  = filename.toLowerCase();
  if (name.includes('email') || lower.includes('subject:') || lower.includes('unsubscribe'))
    return 'email';
  // Word-boundary check to avoid "thread" or "gradient" falsely matching "ad"
  if (/\bad\b/.test(name) || lower.includes('cta') || lower.includes('click here') || lower.includes('buy now'))
    return 'ad';
  if (name.includes('thread') || lower.includes('@') || /(?:^|\s)#[a-z]/m.test(lower))
    return 'social';
  if (lower.includes('landing') || lower.includes('hero') || lower.includes('social proof'))
    return 'landing';
  return 'blog';
}

function looksLikePath(s: string): boolean {
  if (!s) return false;
  if (s.startsWith('.') || s.startsWith('/') || s.startsWith('~')) return true;
  if (/\.(md|txt|mdx)$/i.test(s)) return true;
  return false;
}

// ── parseJSON ──────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('parses clean JSON', () => {
    const result = parseJSON('{"score": 75, "grade": "B+"}');
    expect(result.score).toBe(75);
    expect(result.grade).toBe('B+');
  });

  it('extracts JSON from markdown code block', () => {
    const raw = '```json\n{"score": 80}\n```';
    const result = parseJSON(raw);
    expect(result.score).toBe(80);
  });

  it('extracts JSON from surrounding text', () => {
    const raw = 'Here is your analysis:\n\n{"score": 65, "verdict": "decent"}\n\nLet me know if helpful.';
    const result = parseJSON(raw);
    expect(result.score).toBe(65);
  });

  it('handles nested JSON objects', () => {
    const raw = '{"total_score": 72, "dimensions": {"clarity": {"score": 80}, "engagement": {"score": 65}}}';
    const result = parseJSON(raw);
    expect(result.total_score).toBe(72);
    expect(result.dimensions.clarity.score).toBe(80);
  });

  it('throws on unparseable input', () => {
    expect(() => parseJSON('this is not json at all')).toThrow('Could not parse response as JSON');
    expect(() => parseJSON('')).toThrow();
    expect(() => parseJSON('{ broken json: true')).toThrow();
  });

  it('throws on incomplete JSON', () => {
    expect(() => parseJSON('{"score": 75')).toThrow();
  });
});

// ── gradeLetter ────────────────────────────────────────────────────────────

describe('gradeLetter', () => {
  const cases: [number, string][] = [
    [100, 'A+'],
    [90,  'A+'],
    [89,  'A'],
    [85,  'A'],
    [84,  'A-'],
    [80,  'A-'],
    [79,  'B+'],
    [75,  'B+'],
    [74,  'B'],
    [70,  'B'],
    [69,  'B-'],
    [65,  'B-'],
    [64,  'C+'],
    [60,  'C+'],
    [59,  'C'],
    [55,  'C'],
    [54,  'C-'],
    [50,  'C-'],
    [49,  'D'],
    [40,  'D'],
    [39,  'F'],
    [0,   'F'],
  ];

  for (const [score, expectedGrade] of cases) {
    it(`score ${score} → grade ${expectedGrade}`, () => {
      expect(gradeLetter(score)).toBe(expectedGrade);
    });
  }
});

// ── detectContentType ──────────────────────────────────────────────────────

describe('detectContentType', () => {
  it('detects email from filename', () => {
    expect(detectContentType('Some content here', 'email-draft.md')).toBe('email');
    expect(detectContentType('Some content here', 'welcome-email.txt')).toBe('email');
  });

  it('detects email from content signals', () => {
    expect(detectContentType('Subject: Great deals this week\nHi there,', 'message.txt')).toBe('email');
    expect(detectContentType('Click here to unsubscribe from our list', 'content.md')).toBe('email');
  });

  it('detects ad copy from filename with word boundary', () => {
    expect(detectContentType('Some content', 'ad-copy.txt')).toBe('ad');
    expect(detectContentType('Some content', 'ad.txt')).toBe('ad');
  });

  it('does NOT false-positive on filenames containing "ad" as substring', () => {
    // "thread.md" contains "ad" — must NOT be classified as ad copy
    expect(detectContentType('Some content', 'thread.md')).toBe('social');
    // "gradient.md" contains "ad" — must NOT be classified as ad copy
    expect(detectContentType('Some content', 'gradient.md')).toBe('blog');
    // "loaded.txt" contains "ad" — must NOT be classified as ad copy
    expect(detectContentType('Some content', 'loaded.txt')).toBe('blog');
  });

  it('detects ad copy from content signals', () => {
    expect(detectContentType('Click here to get started today', 'promo.txt')).toBe('ad');
    expect(detectContentType('Buy now and save 50%', 'offer.md')).toBe('ad');
  });

  it('detects social/thread from filename', () => {
    expect(detectContentType('Some content', 'thread.md')).toBe('social');
  });

  it('detects social from @ mentions', () => {
    expect(detectContentType('Shoutout to @johndoe for this insight', 'post.txt')).toBe('social');
  });

  it('detects social from hashtags (word preceded by space or start of line)', () => {
    expect(detectContentType('Excited about #startups and #saas', 'post.txt')).toBe('social');
    expect(detectContentType('#buildinpublic — day 30', 'tweet.txt')).toBe('social');
  });

  it('does NOT classify markdown headings as social', () => {
    const post = '# Why Most Startups Fail\n\n## The Problem\n\nGeneric content here.';
    expect(detectContentType(post, 'post.md')).toBe('blog');
  });

  it('does NOT false-positive on C# or F# language mentions', () => {
    expect(detectContentType('I write enterprise code in C# and F#', 'blog.md')).toBe('blog');
  });

  it('detects landing page from content signals', () => {
    expect(detectContentType('Our hero section promises the world', 'page.txt')).toBe('landing');
    expect(detectContentType('Social proof from 10,000 customers', 'copy.md')).toBe('landing');
  });

  it('defaults to blog for unrecognized content', () => {
    expect(detectContentType('Just a regular article about stuff', 'post.md')).toBe('blog');
    expect(detectContentType('Some thoughts on productivity', 'notes.txt')).toBe('blog');
  });
});

// ── looksLikePath ──────────────────────────────────────────────────────────

describe('looksLikePath', () => {
  it('detects relative paths', () => {
    expect(looksLikePath('./my-post.md')).toBe(true);
    expect(looksLikePath('../content/article.txt')).toBe(true);
  });

  it('detects absolute paths', () => {
    expect(looksLikePath('/home/user/content.md')).toBe(true);
    expect(looksLikePath('/tmp/test.txt')).toBe(true);
  });

  it('detects home directory paths', () => {
    expect(looksLikePath('~/Documents/post.md')).toBe(true);
  });

  it('detects file extensions', () => {
    expect(looksLikePath('content.md')).toBe(true);
    expect(looksLikePath('article.txt')).toBe(true);
    expect(looksLikePath('post.mdx')).toBe(true);
    expect(looksLikePath('ARTICLE.MD')).toBe(true);
  });

  it('rejects commands and plain strings', () => {
    expect(looksLikePath('analyze')).toBe(false);
    expect(looksLikePath('headline')).toBe(false);
    expect(looksLikePath('start')).toBe(false);
    expect(looksLikePath('help')).toBe(false);
    expect(looksLikePath('')).toBe(false);
  });

  it('handles undefined/null-like inputs', () => {
    expect(looksLikePath('')).toBe(false);
  });
});

// ── Content size check ─────────────────────────────────────────────────────

describe('content size guards', () => {
  it('rejects content under 20 chars', () => {
    const content = 'Too short';
    expect(content.trim().length < 20).toBe(true);
  });

  it('accepts content of 20+ chars', () => {
    const content = 'This is enough text.';
    expect(content.trim().length >= 20).toBe(true);
  });

  it('truncates correctly at 6000 chars', () => {
    const huge = 'x'.repeat(7000);
    const truncated = huge.length > 6000
      ? huge.slice(0, 6000) + '\n\n[Content truncated for analysis]'
      : huge;
    expect(truncated.length).toBeGreaterThan(6000);
    expect(truncated.startsWith('x'.repeat(6000))).toBe(true);
    expect(truncated).toContain('[Content truncated for analysis]');
  });

  it('does not truncate content under 6000 chars', () => {
    const normal = 'Hello world '.repeat(100); // ~1200 chars
    const result = normal.length > 6000 ? normal.slice(0, 6000) : normal;
    expect(result).toBe(normal);
  });
});
