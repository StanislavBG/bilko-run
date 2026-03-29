/**
 * URL security and input sanitization tests.
 * Covers protocol injection, SSRF vectors, Unicode edge cases, and boundary
 * conditions for all user-facing URL and text inputs.
 *
 * These mirror the validation logic in bin/content-grade.js (cmdAnalyzeUrl)
 * and server/routes/demos.ts (page-roast endpoint).
 */
import { describe, it, expect } from 'vitest';

// ── URL validation (mirrors bin/content-grade.js cmdAnalyzeUrl logic) ──────

/**
 * Primary URL validator: must start with http:// or https://, min 3 chars after scheme.
 * Control characters stripped before validation.
 */
function validateCliUrl(raw: string): { valid: boolean; error?: string; sanitized?: string } {
  const sanitized = (raw || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!sanitized || !/^https?:\/\/.{3,}/i.test(sanitized)) {
    return { valid: false, error: 'Invalid URL: must start with http:// or https://' };
  }
  if (sanitized.length > 2048) {
    return { valid: false, error: `URL too long (${sanitized.length} chars). Maximum is 2048.` };
  }
  return { valid: true, sanitized };
}

/**
 * Web API URL validator (mirrors server/routes/demos.ts page-roast endpoint).
 * Accepts http/https only.
 */
function validateApiUrl(raw: string): string | null {
  if (!raw) return 'URL is required.';
  try {
    new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return null;
  } catch {
    return 'Invalid URL.';
  }
}

// ── Protocol injection — CLI validator ────────────────────────────────────

describe('URL validation — protocol injection (CLI)', () => {
  it('rejects javascript: protocol', () => {
    expect(validateCliUrl('javascript:alert(1)').valid).toBe(false);
    expect(validateCliUrl('javascript://evil.com').valid).toBe(false);
    expect(validateCliUrl('JAVASCRIPT:alert(1)').valid).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(validateCliUrl('data:text/html,<script>alert(1)</script>').valid).toBe(false);
    expect(validateCliUrl('data:application/octet-stream;base64,aGVsbG8=').valid).toBe(false);
  });

  it('rejects file:// protocol', () => {
    expect(validateCliUrl('file:///etc/passwd').valid).toBe(false);
    expect(validateCliUrl('file:///home/user/.ssh/id_rsa').valid).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    expect(validateCliUrl('ftp://example.com/file').valid).toBe(false);
  });

  it('rejects vbscript: protocol', () => {
    expect(validateCliUrl('vbscript:msgbox(1)').valid).toBe(false);
  });

  it('rejects blob: URIs', () => {
    expect(validateCliUrl('blob:https://example.com/uuid').valid).toBe(false);
  });

  it('accepts https:// URLs', () => {
    expect(validateCliUrl('https://example.com').valid).toBe(true);
    expect(validateCliUrl('https://blog.example.com/post/123').valid).toBe(true);
  });

  it('accepts http:// URLs', () => {
    expect(validateCliUrl('http://example.com').valid).toBe(true);
    expect(validateCliUrl('http://localhost:8080/page').valid).toBe(true);
  });
});

// ── Control character stripping ───────────────────────────────────────────

describe('URL validation — control character injection (CLI)', () => {
  it('strips null bytes before validation', () => {
    // "javascript:" with null byte inserted to try to bypass validation
    const nullInjected = 'https://example.com/\x00javascript:alert(1)';
    const result = validateCliUrl(nullInjected);
    // The null is stripped, leaving a valid https URL
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('\x00');
  });

  it('strips carriage returns and linefeeds (header injection)', () => {
    const crlf = 'https://example.com/\r\nX-Injected: header';
    const result = validateCliUrl(crlf);
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('\r');
    expect(result.sanitized).not.toContain('\n');
  });

  it('strips tab characters', () => {
    const tabUrl = 'https://example.com/\t../../etc/passwd';
    const result = validateCliUrl(tabUrl);
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('\t');
  });

  it('strips all C0 control characters', () => {
    // Inject control chars between j-a-v-a-s-c-r-i-p-t
    const sneaky = 'java\x01script:alert(1)';
    const result = validateCliUrl(sneaky);
    // After stripping control chars: "javascript:alert(1)" — still rejected (no http/https)
    expect(result.valid).toBe(false);
  });
});

// ── URL length limits ─────────────────────────────────────────────────────

describe('URL validation — length limits (CLI)', () => {
  it('accepts URLs up to 2048 chars', () => {
    const longPath = 'https://example.com/' + 'a'.repeat(2048 - 20);
    const result = validateCliUrl(longPath);
    expect(result.valid).toBe(true);
  });

  it('rejects URLs over 2048 chars', () => {
    const tooLong = 'https://example.com/' + 'a'.repeat(2048);
    const result = validateCliUrl(tooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too long/);
  });

  it('rejects empty string', () => {
    expect(validateCliUrl('').valid).toBe(false);
  });

  it('rejects whitespace-only input', () => {
    expect(validateCliUrl('   ').valid).toBe(false);
    expect(validateCliUrl('\t\n\r').valid).toBe(false);
  });
});

// ── Unicode in URLs ───────────────────────────────────────────────────────

describe('URL validation — Unicode (CLI)', () => {
  it('accepts IDN hostnames', () => {
    // Punycode-encoded IDN should work as a valid https URL
    expect(validateCliUrl('https://xn--n3h.ws').valid).toBe(true);
  });

  it('accepts URLs with Unicode path segments', () => {
    // Modern URL parsers accept Unicode paths
    expect(validateCliUrl('https://example.com/café/article').valid).toBe(true);
  });

  it('accepts URLs with emoji in path', () => {
    // Unusual but technically valid in a URL
    expect(validateCliUrl('https://example.com/🎉/post').valid).toBe(true);
  });

  it('rejects URLs that are only Unicode without scheme', () => {
    expect(validateCliUrl('ünïcödé').valid).toBe(false);
  });
});

// ── API URL validation (server-side page-roast) ───────────────────────────

describe('URL validation — API endpoint (page-roast)', () => {
  it('accepts valid https URLs', () => {
    expect(validateApiUrl('https://example.com')).toBeNull();
    expect(validateApiUrl('https://blog.example.com/post?id=1')).toBeNull();
  });

  it('accepts valid http URLs', () => {
    expect(validateApiUrl('http://example.com')).toBeNull();
  });

  it('accepts bare domain (prepends https://)', () => {
    expect(validateApiUrl('example.com')).toBeNull();
    expect(validateApiUrl('sub.domain.co.uk')).toBeNull();
  });

  it('rejects empty URL', () => {
    expect(validateApiUrl('')).not.toBeNull();
  });

  it('rejects URLs with spaces (not valid URL chars)', () => {
    expect(validateApiUrl('not a url')).not.toBeNull();
  });
});

// ── Headline Unicode edge cases ───────────────────────────────────────────

/**
 * Mirrors cmdHeadline stripping logic:
 * text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
 */
function sanitizeHeadline(raw: string): string {
  return (raw || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

function validateHeadlineLength(text: string): string | null {
  if (!text || text.length < 3) return 'Headline must be at least 3 characters.';
  if (text.length > 2000) return 'Headline too long. Maximum is 2000 characters.';
  return null;
}

describe('headline — Unicode and special character handling', () => {
  it('accepts emoji in headline', () => {
    const h = sanitizeHeadline('🚀 How We Hit $1M ARR');
    expect(validateHeadlineLength(h)).toBeNull();
  });

  it('accepts RTL text (Arabic, Hebrew)', () => {
    const arabic = sanitizeHeadline('كيف نجحنا في بناء منتج ناجح');
    expect(validateHeadlineLength(arabic)).toBeNull();
  });

  it('accepts CJK characters', () => {
    const cjk = sanitizeHeadline('如何在30天内构建成功的产品');
    expect(validateHeadlineLength(cjk)).toBeNull();
  });

  it('accepts accented Latin characters', () => {
    const accented = sanitizeHeadline('Héllo: Wörld — café culture séries');
    expect(validateHeadlineLength(accented)).toBeNull();
  });

  it('strips null bytes before length check', () => {
    const withNull = 'Hello\x00World';
    const sanitized = sanitizeHeadline(withNull);
    expect(sanitized).not.toContain('\x00');
    expect(sanitized).toBe('HelloWorld');
    expect(validateHeadlineLength(sanitized)).toBeNull();
  });

  it('strips control chars but preserves tab content (tab becomes trimmed)', () => {
    // \x09 (tab) is NOT in the strip range — it's kept
    const withTab = 'Title:\tSubtitle here';
    const sanitized = sanitizeHeadline(withTab);
    expect(sanitized).toContain('\t');
  });

  it('rejects input that becomes empty after stripping control chars', () => {
    // String is all control characters — after strip, empty
    const allControl = '\x01\x02\x03\x04\x05';
    const sanitized = sanitizeHeadline(allControl);
    expect(validateHeadlineLength(sanitized)).not.toBeNull();
  });

  it('rejects input that becomes too short after stripping', () => {
    // "ab" with a control char — after strip still 2 chars
    const twoChars = 'a\x01b';
    const sanitized = sanitizeHeadline(twoChars);
    expect(sanitized).toBe('ab');
    expect(validateHeadlineLength(sanitized)).not.toBeNull();
  });

  it('handles zero-width joiners and non-breaking spaces', () => {
    // These are NOT control chars — they pass through
    const zwj = 'Hello\u200DWorld headline test';
    const sanitized = sanitizeHeadline(zwj);
    expect(validateHeadlineLength(sanitized)).toBeNull();
  });
});

// ── Very long input boundaries ────────────────────────────────────────────

describe('input length boundary conditions', () => {
  it('headline at exactly 2000 chars passes', () => {
    const h = sanitizeHeadline('a'.repeat(2000));
    expect(validateHeadlineLength(h)).toBeNull();
  });

  it('headline at 2001 chars fails', () => {
    const h = sanitizeHeadline('a'.repeat(2001));
    expect(validateHeadlineLength(h)).not.toBeNull();
  });

  it('headline at exactly 3 chars passes', () => {
    const h = sanitizeHeadline('abc');
    expect(validateHeadlineLength(h)).toBeNull();
  });

  it('headline at 2 chars fails', () => {
    const h = sanitizeHeadline('ab');
    expect(validateHeadlineLength(h)).not.toBeNull();
  });

  it('URL at exactly 2048 chars passes', () => {
    const url = 'https://example.com/' + 'a'.repeat(2028);
    expect(url.length).toBe(2048);
    expect(validateCliUrl(url).valid).toBe(true);
  });

  it('URL at 2049 chars fails', () => {
    const url = 'https://example.com/' + 'a'.repeat(2029);
    expect(url.length).toBe(2049);
    expect(validateCliUrl(url).valid).toBe(false);
  });
});
