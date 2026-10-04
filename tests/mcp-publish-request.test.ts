import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { projectDir, parseBypass, parseRegistry } from '../mcp-host-server/src/publish-request.js';

const ROOT = resolve(__dirname, '..');
const REGISTRY_JSON = resolve(ROOT, 'src/data/standalone-projects.json');
const PUBLIC_PROJECTS_ROOT = resolve(ROOT, 'public/projects');

describe('projectDir', () => {
  it('resolves a valid slug to a path inside the root', () => {
    const dir = projectDir(PUBLIC_PROJECTS_ROOT, 'outdoor-hours');
    expect(dir).toBe(resolve(PUBLIC_PROJECTS_ROOT, 'outdoor-hours'));
  });

  it('throws on a traversal slug', () => {
    expect(() => projectDir(PUBLIC_PROJECTS_ROOT, '../x')).toThrow();
  });

  it('throws on a traversal slug with encoded segments', () => {
    expect(() => projectDir(PUBLIC_PROJECTS_ROOT, '..%2f..%2fetc')).toThrow();
  });

  it.each([
    'OutdoorHours',
    'a',
    '-leading',
    'trailing-',
    'has/slash',
    'has space',
    '',
  ])('throws on bad-case slug %s', (slug) => {
    expect(() => projectDir(PUBLIC_PROJECTS_ROOT, slug)).toThrow();
  });
});

describe('parseBypass', () => {
  it('returns an empty gate set when bypass is undefined', () => {
    const result = parseBypass(undefined, undefined);
    expect('gates' in result).toBe(true);
    if ('gates' in result) {
      expect(result.gates.size).toBe(0);
    }
  });

  it('returns an empty gate set when bypass is an empty string', () => {
    const result = parseBypass('', undefined);
    expect('gates' in result).toBe(true);
    if ('gates' in result) {
      expect(result.gates.size).toBe(0);
    }
  });

  it('rejects an unknown gate name', () => {
    const result = parseBypass('typo-gate', 'a long enough reason for this');
    expect('error' in result).toBe(true);
  });

  it('rejects "manifest" even with a valid reason', () => {
    const result = parseBypass('manifest', 'a long enough reason for this');
    expect('error' in result).toBe(true);
  });

  it('rejects a bypass with no reason', () => {
    const result = parseBypass('a11y', undefined);
    expect('error' in result).toBe(true);
  });

  it('rejects a bypass with a too-short reason', () => {
    const result = parseBypass('a11y', 'too short');
    expect('error' in result).toBe(true);
  });

  it('accepts a known gate with a long-enough reason', () => {
    const result = parseBypass('a11y', 'a long enough reason for this bypass');
    expect('gates' in result).toBe(true);
    if ('gates' in result) {
      expect(result.gates.has('a11y')).toBe(true);
    }
  });

  it('accepts multiple known gates, comma-separated', () => {
    const result = parseBypass('golden,audit', 'a long enough reason for this bypass');
    expect('gates' in result).toBe(true);
    if ('gates' in result) {
      expect(result.gates.has('golden')).toBe(true);
      expect(result.gates.has('audit')).toBe(true);
      expect(result.gates.size).toBe(2);
    }
  });
});

describe('parseRegistry', () => {
  it('parses the real src/data/standalone-projects.json', () => {
    const raw = readFileSync(REGISTRY_JSON, 'utf8');
    const result = parseRegistry(raw);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws naming the bad slug and field for a malformed entry', () => {
    const malformed = JSON.stringify([
      {
        slug: 'OutdoorHours',
        name: 'Bad Entry',
        tagline: 'oops',
        category: 'Data',
        status: 'live',
        year: 2026,
        host: { kind: 'static-path', path: '/projects/OutdoorHours/' },
      },
    ]);
    expect(() => parseRegistry(malformed)).toThrowError(/OutdoorHours/);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseRegistry('{not json')).toThrow();
  });
});
