import { describe, it, expect } from 'vitest';
import { tickerDurationSeconds, parseTickerSpeed } from '../src/pages/admin/command/KpiStrip.js';

describe('tickerDurationSeconds', () => {
  it('scales with count per speed', () => {
    expect(tickerDurationSeconds(100, 'crawl')).toBe(800);
    expect(tickerDurationSeconds(100, 'slow')).toBe(400);
    expect(tickerDurationSeconds(100, 'normal')).toBe(200);
  });
  it('floors at 60 seconds', () => {
    expect(tickerDurationSeconds(5, 'crawl')).toBe(60);
    expect(tickerDurationSeconds(10, 'normal')).toBe(60);
  });
  it('count 0 gives the floor', () => {
    expect(tickerDurationSeconds(0, 'crawl')).toBe(60);
  });
});

describe('parseTickerSpeed', () => {
  it('accepts valid values', () => {
    expect(parseTickerSpeed('crawl')).toBe('crawl');
    expect(parseTickerSpeed('slow')).toBe('slow');
    expect(parseTickerSpeed('normal')).toBe('normal');
  });
  it('falls back to crawl for null and garbage', () => {
    expect(parseTickerSpeed(null)).toBe('crawl');
    expect(parseTickerSpeed('fast')).toBe('crawl');
    expect(parseTickerSpeed('')).toBe('crawl');
  });
});
