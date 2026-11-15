import { describe, it, expect } from 'vitest';
import { PORTFOLIO_PROJECTS, paletteProjects, type PortfolioProject } from '../src/data/portfolio.js';
import { PROJECTS } from '../src/data/projectsRegistry.js';

function fixture(id: string, status: PortfolioProject['status'], isPublic: boolean): PortfolioProject {
  return {
    id, name: id, kind: 'Tool', year: 2026, status, blurb: '', tags: [],
    color: 'ink', href: `/projects/${id}/`, isInternal: false, isPublic,
  };
}

const FIXTURES: readonly PortfolioProject[] = [
  fixture('pub-live', 'Live', true),
  fixture('hidden', 'Live', false),
  fixture('pub-postponed', 'Postponed', true),
  fixture('pub-cooking', 'Cooking', true),
];

describe('paletteProjects', () => {
  it('hides non-public and Postponed projects from non-admins', () => {
    expect(paletteProjects(FIXTURES, false).map(p => p.id)).toEqual(['pub-live', 'pub-cooking']);
  });

  it('shows non-public projects to the admin but still hides Postponed', () => {
    expect(paletteProjects(FIXTURES, true).map(p => p.id)).toEqual(['pub-live', 'hidden', 'pub-cooking']);
  });

  it('matches the registry public, non-postponed entries for non-admins', () => {
    const expected = PROJECTS.filter(p => p.public === true && p.status !== 'postponed').map(p => p.slug);
    expect(paletteProjects(PORTFOLIO_PROJECTS, false).map(p => p.id)).toEqual(expected);
  });
});
