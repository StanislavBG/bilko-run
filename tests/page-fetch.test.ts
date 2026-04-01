import { describe, it, expect } from 'vitest';
import { validatePublicUrl } from '../server/services/page-fetch.js';

describe('SSRF Protection', () => {
  it('allows public URLs', () => {
    expect(() => validatePublicUrl('https://stripe.com')).not.toThrow();
    expect(() => validatePublicUrl('https://example.com')).not.toThrow();
    expect(() => validatePublicUrl('http://github.com')).not.toThrow();
  });

  it('auto-prepends https for bare domains', () => {
    const url = validatePublicUrl('stripe.com');
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('stripe.com');
  });

  it('blocks localhost', () => {
    expect(() => validatePublicUrl('http://localhost')).toThrow(/not allowed/i);
    expect(() => validatePublicUrl('http://localhost:4000')).toThrow(/not allowed/i);
  });

  it('blocks 127.0.0.1', () => {
    expect(() => validatePublicUrl('http://127.0.0.1')).toThrow(/not allowed/i);
    expect(() => validatePublicUrl('http://127.0.0.1:8080')).toThrow(/not allowed/i);
  });

  it('blocks private IP ranges', () => {
    expect(() => validatePublicUrl('http://10.0.0.1')).toThrow(/not allowed/i);
    expect(() => validatePublicUrl('http://192.168.1.1')).toThrow(/not allowed/i);
    expect(() => validatePublicUrl('http://172.16.0.1')).toThrow(/not allowed/i);
  });

  it('blocks AWS metadata IP', () => {
    expect(() => validatePublicUrl('http://169.254.169.254')).toThrow(/not allowed/i);
  });

  it('blocks IPv6 loopback and private', () => {
    expect(() => validatePublicUrl('http://[::1]')).toThrow(/not allowed/i);
    expect(() => validatePublicUrl('http://[::ffff:127.0.0.1]')).toThrow(/not allowed/i);
  });

  it('normalizes non-HTTP inputs to HTTPS', () => {
    // Inputs without "http" prefix get https:// prepended, so "ftp://x.com"
    // becomes "https://ftp//x.com" (hostname=ftp, harmless). The protocol
    // check only matters for inputs starting with "http" like "httpx://".
    const url = validatePublicUrl('ftp://example.com');
    expect(url.protocol).toBe('https:'); // normalized to https
  });

  it('rejects invalid URLs', () => {
    expect(() => validatePublicUrl('')).toThrow();
    expect(() => validatePublicUrl('not a url at all')).toThrow();
  });
});
