/**
 * Unit tests for CLI edge-case hardening.
 * Tests binary detection, file size guards, timeout error classification,
 * and the guards added to prevent raw stack traces for strangers.
 */
import { describe, it, expect } from 'vitest';

// ── Binary content detection (mirrors bin/content-grade.js logic) ──────────

function isBinaryContent(content: string): boolean {
  return content.includes('\x00');
}

// ── File size guard (mirrors bin/content-grade.js logic) ───────────────────

const MAX_BYTES = 500 * 1024; // 500 KB

function isFileTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_BYTES;
}

// ── Timeout error classification (mirrors bin/content-grade.js logic) ───────

function isTimeoutError(err: { killed?: boolean; message: string }): boolean {
  return !!(err.killed || /timeout|ETIMEDOUT|timed out/i.test(err.message));
}

// ── Binary content detection ───────────────────────────────────────────────

describe('binary content detection', () => {
  it('detects null bytes as binary', () => {
    expect(isBinaryContent('hello\x00world')).toBe(true);
    expect(isBinaryContent('\x00')).toBe(true);
  });

  it('detects PNG magic bytes as binary', () => {
    // PNG files start with \x89PNG\r\n\x1a\n — contains null bytes
    const pngLike = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR';
    expect(isBinaryContent(pngLike)).toBe(true);
  });

  it('detects ELF binary header', () => {
    // ELF binaries start with \x7fELF followed by null bytes
    const elfLike = '\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00';
    expect(isBinaryContent(elfLike)).toBe(true);
  });

  it('accepts clean UTF-8 text', () => {
    expect(isBinaryContent('# My Blog Post\n\nThis is a great article.')).toBe(false);
  });

  it('accepts text with unicode characters', () => {
    expect(isBinaryContent('Héllo Wörld — a post about café culture 🌍')).toBe(false);
  });

  it('accepts text with tab and newline characters', () => {
    expect(isBinaryContent('Column A\tColumn B\nRow 1\tRow 2')).toBe(false);
  });

  it('accepts an empty string as non-binary', () => {
    // Empty files are caught by the too-short guard separately
    expect(isBinaryContent('')).toBe(false);
  });

  it('accepts text with only whitespace as non-binary', () => {
    expect(isBinaryContent('   \n\n\t  ')).toBe(false);
  });
});

// ── File size guard ────────────────────────────────────────────────────────

describe('file size guard', () => {
  it('allows files at exactly 500 KB', () => {
    expect(isFileTooLarge(500 * 1024)).toBe(false);
  });

  it('rejects files over 500 KB', () => {
    expect(isFileTooLarge(500 * 1024 + 1)).toBe(true);
    expect(isFileTooLarge(1024 * 1024)).toBe(true); // 1 MB
    expect(isFileTooLarge(10 * 1024 * 1024)).toBe(true); // 10 MB
  });

  it('allows typical content file sizes', () => {
    expect(isFileTooLarge(1024)).toBe(false);          // 1 KB
    expect(isFileTooLarge(50 * 1024)).toBe(false);     // 50 KB
    expect(isFileTooLarge(200 * 1024)).toBe(false);    // 200 KB
    expect(isFileTooLarge(499 * 1024)).toBe(false);    // 499 KB
  });

  it('allows zero-byte files (caught by too-short guard separately)', () => {
    expect(isFileTooLarge(0)).toBe(false);
  });
});

// ── Timeout error classification ───────────────────────────────────────────

describe('timeout error classification', () => {
  it('classifies killed process as timeout', () => {
    expect(isTimeoutError({ killed: true, message: 'Command failed' })).toBe(true);
  });

  it('classifies ETIMEDOUT in message as timeout', () => {
    expect(isTimeoutError({ killed: false, message: 'spawnSync claude ETIMEDOUT' })).toBe(true);
    expect(isTimeoutError({ killed: false, message: 'Error: ETIMEDOUT' })).toBe(true);
  });

  it('classifies "timeout" in message as timeout', () => {
    expect(isTimeoutError({ killed: false, message: 'Command timed out after 120000ms' })).toBe(true);
    expect(isTimeoutError({ killed: false, message: 'timeout exceeded' })).toBe(true);
  });

  it('classifies "timed out" in message as timeout', () => {
    expect(isTimeoutError({ killed: false, message: 'Process timed out' })).toBe(true);
  });

  it('does not classify regular errors as timeout', () => {
    expect(isTimeoutError({ killed: false, message: 'Command failed: claude not found' })).toBe(false);
    expect(isTimeoutError({ killed: false, message: 'JSON parse error' })).toBe(false);
    expect(isTimeoutError({ killed: false, message: 'Authentication failed' })).toBe(false);
    expect(isTimeoutError({ killed: false, message: '' })).toBe(false);
  });

  it('is case-insensitive for timeout keywords', () => {
    expect(isTimeoutError({ killed: false, message: 'TIMEOUT exceeded' })).toBe(true);
    expect(isTimeoutError({ killed: false, message: 'Timeout reached' })).toBe(true);
  });
});

// ── Content too-short guard ────────────────────────────────────────────────

describe('content too-short guard', () => {
  const MIN_CHARS = 20;

  it('rejects content below minimum', () => {
    const content = 'Too short';
    expect(content.trim().length < MIN_CHARS).toBe(true);
  });

  it('rejects empty content', () => {
    expect(''.trim().length < MIN_CHARS).toBe(true);
  });

  it('rejects whitespace-only content', () => {
    expect('   \n\n\t  '.trim().length < MIN_CHARS).toBe(true);
  });

  it('accepts content at exactly the minimum', () => {
    const content = 'a'.repeat(MIN_CHARS);
    expect(content.trim().length < MIN_CHARS).toBe(false);
  });

  it('accepts normal content', () => {
    const content = '# My Blog Post\n\nThis is a real article with content.';
    expect(content.trim().length < MIN_CHARS).toBe(false);
  });
});
