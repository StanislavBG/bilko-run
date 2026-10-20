import { describe, it, expect } from 'vitest';
import { keyStatus } from '../src/pages/admin/SecretsPage.js';

describe('keyStatus', () => {
  const now = 1_000_000;
  it('is active before expiry and not revoked', () => {
    expect(keyStatus({ revoked_at: null, expires_at: now + 10 }, now)).toBe('active');
  });
  it('is expired at or after expires_at', () => {
    expect(keyStatus({ revoked_at: null, expires_at: now }, now)).toBe('expired');
    expect(keyStatus({ revoked_at: null, expires_at: now - 1 }, now)).toBe('expired');
  });
  it('is revoked when revoked_at is set, even if also expired', () => {
    expect(keyStatus({ revoked_at: now - 5, expires_at: now + 10 }, now)).toBe('revoked');
    expect(keyStatus({ revoked_at: now - 5, expires_at: now - 1 }, now)).toBe('revoked');
  });
});
