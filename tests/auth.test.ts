import { describe, it, expect } from 'vitest';
import { EMAIL_RE, ADMIN_EMAILS } from '../server/clerk.js';

describe('Email Validation', () => {
  it('accepts valid emails', () => {
    expect(EMAIL_RE.test('user@example.com')).toBe(true);
    expect(EMAIL_RE.test('test@test.co.uk')).toBe(true);
    expect(EMAIL_RE.test('name+tag@gmail.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(EMAIL_RE.test('')).toBe(false);
    expect(EMAIL_RE.test('x@')).toBe(false);
    expect(EMAIL_RE.test('@x')).toBe(false);
    expect(EMAIL_RE.test('no-at-sign')).toBe(false);
    expect(EMAIL_RE.test('spaces in@email.com')).toBe(false);
    expect(EMAIL_RE.test('@@@')).toBe(false);
  });

  it('allows angle brackets in local part (escHtml is defense-in-depth)', () => {
    // The email regex allows < > per RFC — XSS protection comes from
    // escHtml() in HTML templates, not email validation
    expect(EMAIL_RE.test('test<script>@evil.com')).toBe(true);
  });

  it('admin emails list is defined', () => {
    expect(ADMIN_EMAILS).toContain('bilkobibitkov2000@gmail.com');
    expect(ADMIN_EMAILS.length).toBeGreaterThan(0);
  });
});
