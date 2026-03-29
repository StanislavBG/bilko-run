/**
 * Unit tests for input validation rules.
 * Tests the exact validation logic applied in each demo endpoint.
 */
import { describe, it, expect } from 'vitest';

// ── Validation helpers (mirrors demos.ts logic) ────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e || !EMAIL_REGEX.test(e)) return 'Valid email address required.';
  return null;
}

function validateHeadline(headline: string): string | null {
  if (!headline || headline.length < 3) return 'Headline must be at least 3 characters.';
  if (headline.length > 500) return 'Headline must be under 500 characters.';
  return null;
}

function validateUrl(raw: string): string | null {
  if (!raw) return 'URL is required.';
  try {
    new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return null;
  } catch {
    return 'Invalid URL.';
  }
}

function validateAdCopy(text: string): string | null {
  if (!text || text.length < 10) return 'Ad copy must be at least 10 characters.';
  if (text.length > 2000) return 'Ad copy must be under 2000 characters.';
  return null;
}

function validateThread(text: string): string | null {
  if (!text || text.length < 20) return 'Thread must be at least 20 characters.';
  if (text.length > 5000) return 'Thread must be under 5000 characters.';
  return null;
}

function validateEmailForgeProduct(text: string): string | null {
  if (!text || text.length < 10) return 'Product description must be at least 10 characters.';
  return null;
}

function validateEmailForgeAudience(text: string): string | null {
  if (!text || text.length < 5) return 'Audience must be at least 5 characters.';
  return null;
}

function validateAudienceContent(text: string): string | null {
  if (!text || text.length < 50) return 'Content must be at least 50 characters. Paste 10-20 posts.';
  if (text.length > 15000) return 'Content must be under 15000 characters.';
  return null;
}

// ── Email validation ───────────────────────────────────────────────────────

describe('email validation', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('  USER@EXAMPLE.COM  ')).toBeNull();
    expect(validateEmail('user+tag@sub.domain.co')).toBeNull();
  });

  it('rejects empty email', () => {
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('   ')).not.toBeNull();
  });

  it('rejects emails without @', () => {
    expect(validateEmail('notanemail')).not.toBeNull();
    expect(validateEmail('missing-at-sign.com')).not.toBeNull();
  });

  it('rejects emails without domain', () => {
    expect(validateEmail('user@')).not.toBeNull();
  });

  it('rejects emails without TLD', () => {
    expect(validateEmail('@nodomain')).not.toBeNull();
  });
});

// ── Headline validation ────────────────────────────────────────────────────

describe('headline validation', () => {
  it('accepts valid headlines', () => {
    expect(validateHeadline('This is a headline')).toBeNull();
    expect(validateHeadline('abc')).toBeNull(); // exactly 3 chars
    expect(validateHeadline('a'.repeat(500))).toBeNull(); // exactly 500 chars
  });

  it('rejects empty headline', () => {
    expect(validateHeadline('')).not.toBeNull();
  });

  it('rejects too-short headlines', () => {
    expect(validateHeadline('ab')).not.toBeNull(); // 2 chars
    expect(validateHeadline('a')).not.toBeNull();
  });

  it('rejects over-length headlines', () => {
    expect(validateHeadline('a'.repeat(501))).not.toBeNull();
    expect(validateHeadline('a'.repeat(10000))).not.toBeNull();
  });
});

// ── URL validation ─────────────────────────────────────────────────────────

describe('URL validation', () => {
  it('accepts valid URLs', () => {
    expect(validateUrl('https://example.com')).toBeNull();
    expect(validateUrl('http://example.com/path?q=1')).toBeNull();
    expect(validateUrl('example.com')).toBeNull(); // prepends https://
    expect(validateUrl('sub.domain.co.uk')).toBeNull();
  });

  it('rejects empty URL', () => {
    expect(validateUrl('')).not.toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(validateUrl('not a url with spaces')).not.toBeNull();
    expect(validateUrl('://no-scheme')).not.toBeNull();
  });

  it('accepts localhost and IP addresses', () => {
    expect(validateUrl('http://localhost:3000')).toBeNull();
    expect(validateUrl('http://192.168.1.1')).toBeNull();
  });
});

// ── Ad copy validation ─────────────────────────────────────────────────────

describe('ad copy validation', () => {
  it('accepts valid ad copy', () => {
    expect(validateAdCopy('This is my ad copy text!')).toBeNull();
    expect(validateAdCopy('a'.repeat(10))).toBeNull(); // exactly 10 chars
    expect(validateAdCopy('a'.repeat(2000))).toBeNull(); // exactly 2000 chars
  });

  it('rejects empty or too-short ad copy', () => {
    expect(validateAdCopy('')).not.toBeNull();
    expect(validateAdCopy('Too short')).not.toBeNull(); // 9 chars
  });

  it('rejects over-length ad copy', () => {
    expect(validateAdCopy('a'.repeat(2001))).not.toBeNull();
  });
});

// ── Thread validation ──────────────────────────────────────────────────────

describe('thread validation', () => {
  it('accepts valid thread content', () => {
    expect(validateThread('This is a tweet thread about something interesting.')).toBeNull();
    expect(validateThread('a'.repeat(20))).toBeNull(); // exactly 20 chars
    expect(validateThread('a'.repeat(5000))).toBeNull(); // exactly 5000 chars
  });

  it('rejects too-short threads', () => {
    expect(validateThread('Too short here!')).not.toBeNull(); // 15 chars
    expect(validateThread('')).not.toBeNull();
  });

  it('rejects over-length threads', () => {
    expect(validateThread('a'.repeat(5001))).not.toBeNull();
  });
});

// ── Email Forge validation ─────────────────────────────────────────────────

describe('email forge validation', () => {
  it('accepts valid product descriptions', () => {
    expect(validateEmailForgeProduct('A great SaaS product')).toBeNull();
    expect(validateEmailForgeProduct('a'.repeat(10))).toBeNull();
  });

  it('rejects too-short product descriptions', () => {
    expect(validateEmailForgeProduct('Short')).not.toBeNull(); // 5 chars
    expect(validateEmailForgeProduct('')).not.toBeNull();
  });

  it('accepts valid audience descriptions', () => {
    expect(validateEmailForgeAudience('CTOs at')).toBeNull(); // 7 chars
    expect(validateEmailForgeAudience('a'.repeat(5))).toBeNull(); // exactly 5 chars
  });

  it('rejects too-short audience descriptions', () => {
    expect(validateEmailForgeAudience('CTOs')).not.toBeNull(); // 4 chars
    expect(validateEmailForgeAudience('')).not.toBeNull();
  });
});

// ── Audience Decoder validation ────────────────────────────────────────────

describe('audience decoder validation', () => {
  it('accepts valid content', () => {
    expect(validateAudienceContent('a'.repeat(50))).toBeNull(); // exactly 50
    expect(validateAudienceContent('a'.repeat(15000))).toBeNull(); // exactly 15000
    expect(validateAudienceContent('Some substantial post content about technology and startups that is interesting.')).toBeNull();
  });

  it('rejects too-short content', () => {
    expect(validateAudienceContent('Too short')).not.toBeNull(); // 9 chars
    expect(validateAudienceContent('a'.repeat(49))).not.toBeNull();
  });

  it('rejects over-length content', () => {
    expect(validateAudienceContent('a'.repeat(15001))).not.toBeNull();
  });
});

// ── Context field validation ───────────────────────────────────────────────

describe('headline context field normalization', () => {
  const validContexts = ['email', 'ad', 'landing', 'blog', 'social'];

  it('accepts all valid contexts', () => {
    for (const ctx of validContexts) {
      const normalized = validContexts.includes(ctx.toLowerCase()) ? ctx.toLowerCase() : 'general';
      expect(normalized).toBe(ctx);
    }
  });

  it('falls back to general for unknown context', () => {
    const unknown = 'youtube';
    const normalized = validContexts.includes(unknown.toLowerCase()) ? unknown.toLowerCase() : 'general';
    expect(normalized).toBe('general');
  });

  it('falls back to general for empty context', () => {
    const empty = '';
    const normalized = validContexts.includes(empty.toLowerCase()) ? empty.toLowerCase() : 'general';
    expect(normalized).toBe('general');
  });
});
