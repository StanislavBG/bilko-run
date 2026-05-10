import { describe, it, expect } from 'vitest';
import standaloneRaw from '../src/data/standalone-projects.json';

interface StandaloneProject {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  status: string;
  host: { kind: string; path?: string; url?: string };
  tags?: string[];
}

const standalone = standaloneRaw as StandaloneProject[];

function isGame(p: StandaloneProject): boolean {
  return p.category?.includes('Game') || (p.tags ?? []).includes('Game');
}

describe('Games registry', () => {
  const liveGames = standalone.filter(p => isGame(p) && p.status === 'live');

  it('has at least 3 live games', () => {
    expect(liveGames.length).toBeGreaterThanOrEqual(3);
  });

  it('includes Boat Shooter (game-academy)', () => {
    expect(liveGames.some(g => g.slug === 'game-academy')).toBe(true);
  });

  it('includes Sudoku', () => {
    expect(liveGames.some(g => g.slug === 'sudoku')).toBe(true);
  });

  it('includes MindSwiffer', () => {
    expect(liveGames.some(g => g.slug === 'mindswiffer')).toBe(true);
  });

  it('Sudoku href is /projects/sudoku/', () => {
    const sudoku = liveGames.find(g => g.slug === 'sudoku');
    expect(sudoku?.host.path).toBe('/projects/sudoku/');
  });

  it('MindSwiffer href is /projects/mindswiffer/', () => {
    const ms = liveGames.find(g => g.slug === 'mindswiffer');
    expect(ms?.host.path).toBe('/projects/mindswiffer/');
  });

  it('all live games have a static-path host with a /projects/ path', () => {
    for (const g of liveGames) {
      expect(g.host.kind).toBe('static-path');
      expect(g.host.path).toMatch(/^\/projects\//);
    }
  });
});
