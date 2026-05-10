import { PROJECTS, projectHref } from './projectsRegistry.js';

export interface GameCard {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  href: string;
  /** Server-side game slug used for leaderboard/unlocks API calls. */
  apiSlug: string;
  hostKind: 'react-route' | 'static-path' | 'external-url';
  status: 'live' | 'cooking' | 'archived';
}

const ICONS: Record<string, string> = {
  'game-academy': '🚤',
  sudoku: '🔢',
  mindswiffer: '💣',
};

// Registry slug → server game slug (GAME_CONFIGS key)
const API_SLUG_MAP: Record<string, string> = {
  'game-academy': 'boat-shooter',
};

export function getGames(): GameCard[] {
  return PROJECTS
    .filter(p => p.category?.includes('Game') || (p.tags ?? []).includes('Game'))
    .filter(p => p.status === 'live')
    .map(p => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      icon: ICONS[p.slug] ?? '🎮',
      href: projectHref(p),
      apiSlug: API_SLUG_MAP[p.slug] ?? p.slug,
      hostKind: p.host.kind,
      status: p.status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
