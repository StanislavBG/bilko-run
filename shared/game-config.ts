export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  secret?: boolean;
}

export interface GameConfig {
  slug: string;
  scoreOrder: 'asc' | 'desc';  // 'desc' = higher better; 'asc' = lower-time better
  maxPlausibleScore: number;
  achievements: AchievementDef[];
}

export const GAME_CONFIGS: Record<string, GameConfig> = {
  'boat-shooter': {
    slug: 'boat-shooter',
    scoreOrder: 'desc',
    maxPlausibleScore: 1_000_000,
    achievements: [
      { key: 'first_kill', name: 'First Blood', description: 'Land your first hit.', icon: '🎯' },
    ],
  },
  // sudoku entries land via PRD 38-sudoku-stats-and-achievements
};
