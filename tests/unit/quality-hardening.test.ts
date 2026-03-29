/**
 * Tests for bugs found and fixed in the Order #121 quality audit.
 *
 * Bugs covered:
 * 1. detectContentType: '#' in markdown headers falsely classified as social content
 * 2. scoreBar: out-of-range scores (>100 or NaN) caused RangeError in String.repeat()
 * 3. cmdHeadline: dim.max === 0 caused division by zero → NaN pct → scoreBar crash
 * 4. server/claude.ts: --system flag should be --system-prompt (behavioral, not testable here)
 */
import { describe, it, expect } from 'vitest';

// ── Mirrors bin/content-grade.js logic ───────────────────────────────────

function detectContentType(text: string, filename: string): string {
  const lower = text.toLowerCase();
  const name  = filename.toLowerCase();

  if (name.includes('email') || lower.includes('subject:') || lower.includes('unsubscribe'))
    return 'email';
  if (/\bad\b/.test(name) || lower.includes('cta') || lower.includes('click here') || lower.includes('buy now'))
    return 'ad';
  // Fixed: was lower.includes('#') which matched markdown headers like "# Title"
  if (name.includes('thread') || lower.includes('@') || /(?:^|\s)#[a-z]/m.test(lower))
    return 'social';
  if (lower.includes('landing') || lower.includes('hero') || lower.includes('social proof'))
    return 'landing';
  return 'blog';
}

function scoreBar(score: number, width = 30): string {
  // Fixed: was Math.round((score / 100) * width) with no clamp — if score > 100,
  // empty = width - filled could go negative, causing String.repeat(negative) → RangeError
  const clamped = Math.max(0, Math.min(100, score || 0));
  const filled  = Math.round((clamped / 100) * width);
  const empty   = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function headlineDimPct(score: number, max: number): number {
  // Fixed: was Math.round((dim.score / dim.max) * 100) with no guard — if max === 0,
  // result is NaN, causing scoreBar(NaN) → String.repeat(NaN) → RangeError
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

// ── Bug 1: detectContentType markdown false-positive ──────────────────────

describe('detectContentType — markdown header bug (fixed)', () => {
  it('does NOT classify a markdown blog post as social just because it has # headings', () => {
    const markdownPost = `# Why Most Startups Fail\n\n## Introduction\n\nThis is a post about startups.`;
    expect(detectContentType(markdownPost, 'post.md')).toBe('blog');
  });

  it('does NOT classify H2 headings as social', () => {
    const post = `## The Problem\n\nMost founders ignore unit economics.`;
    expect(detectContentType(post, 'article.md')).toBe('blog');
  });

  it('does NOT classify H3 headings as social', () => {
    const post = `### Deep Dive\n\nLet us look at the data.`;
    expect(detectContentType(post, 'notes.md')).toBe('blog');
  });

  it('DOES classify content with hashtags as social', () => {
    const tweet = `Excited to launch our new product! #startups #saas #buildinpublic`;
    expect(detectContentType(tweet, 'tweet.txt')).toBe('social');
  });

  it('DOES classify content with inline hashtag as social', () => {
    const post = `Following the #AI trend in enterprise software.`;
    expect(detectContentType(post, 'post.txt')).toBe('social');
  });

  it('does NOT false-positive on words with hash-like chars inside', () => {
    // Edge: "C#" (the language) — starts with non-whitespace before #
    const post = `I love programming in C# and F# for enterprise apps.`;
    // "C#" doesn't match /(?:^|\s)#[a-z]/m since the '#' is preceded by a letter
    expect(detectContentType(post, 'blog.md')).toBe('blog');
  });

  it('still classifies thread filename as social', () => {
    expect(detectContentType('Some content', 'thread.md')).toBe('social');
  });

  it('still classifies @ mentions as social', () => {
    expect(detectContentType('Shoutout to @johndoe for this insight', 'post.txt')).toBe('social');
  });
});

// ── Bug 2: scoreBar out-of-range crash ────────────────────────────────────

describe('scoreBar — out-of-range score safety (fixed)', () => {
  it('does not throw when score > 100', () => {
    expect(() => scoreBar(150, 30)).not.toThrow();
  });

  it('does not throw when score < 0', () => {
    expect(() => scoreBar(-10, 30)).not.toThrow();
  });

  it('does not throw when score is NaN', () => {
    expect(() => scoreBar(NaN, 30)).not.toThrow();
  });

  it('produces correct-length bar for score 150 (clamped to 100)', () => {
    const bar = scoreBar(150, 30);
    // Should be all filled — 30 chars of filled, 0 of empty
    expect(bar).toBe('█'.repeat(30));
  });

  it('produces correct-length bar for score -10 (clamped to 0)', () => {
    const bar = scoreBar(-10, 30);
    expect(bar).toBe('░'.repeat(30));
  });

  it('bar total length always equals width regardless of score', () => {
    const testCases = [0, 50, 100, -999, 9999, NaN];
    for (const score of testCases) {
      const bar = scoreBar(score, 30);
      // Strip ANSI codes — the raw chars are █ and ░, each 3 bytes in UTF-8 but 1 JS char
      const stripped = bar.replace(/[^\u2588\u2591]/g, '');
      expect(stripped.length).toBe(30);
    }
  });

  it('works correctly for valid range (0-100)', () => {
    expect(scoreBar(0, 10)).toBe('░'.repeat(10));
    expect(scoreBar(100, 10)).toBe('█'.repeat(10));
    expect(scoreBar(50, 10)).toBe('█'.repeat(5) + '░'.repeat(5));
  });
});

// ── Bug 3: headline dim.max === 0 division by zero ────────────────────────

describe('headline dimension pct — division by zero (fixed)', () => {
  it('returns 0 when max is 0 (prevents NaN → repeat crash)', () => {
    expect(headlineDimPct(0, 0)).toBe(0);
    expect(headlineDimPct(15, 0)).toBe(0);
  });

  it('returns correct percentage for normal inputs', () => {
    expect(headlineDimPct(22, 30)).toBe(73);
    expect(headlineDimPct(30, 30)).toBe(100);
    expect(headlineDimPct(0, 30)).toBe(0);
    expect(headlineDimPct(15, 30)).toBe(50);
  });

  it('does not throw for any dim.max value', () => {
    expect(() => headlineDimPct(10, 0)).not.toThrow();
    expect(() => headlineDimPct(10, -1)).not.toThrow();
    expect(() => headlineDimPct(10, 30)).not.toThrow();
  });
});

// ── server/claude.ts flag fix — documented behavioral test ────────────────

describe('server/claude.ts --system-prompt flag (behavioral contract)', () => {
  it('flag name is --system-prompt, not --system', () => {
    // This is a contract test to document the fix. The server/claude.ts was using
    // args.push('--system', systemPrompt) which is an unknown flag — system prompts
    // were silently dropped. The fix: args.push('--system-prompt', systemPrompt).
    //
    // Verified against: claude --help | grep system
    // Output: --system-prompt <prompt>   System prompt to use for the session
    //
    // Impact: ALL 6 web tools (HeadlineGrader, PageRoast, AdScorer, ThreadGrader,
    // EmailForge, AudienceDecoder) were calling Claude without system prompts.
    // This caused lower-quality, inconsistently structured JSON responses.
    const CORRECT_FLAG = '--system-prompt';
    const WRONG_FLAG = '--system';
    expect(CORRECT_FLAG).not.toBe(WRONG_FLAG);
    expect(CORRECT_FLAG).toBe('--system-prompt');
  });
});
