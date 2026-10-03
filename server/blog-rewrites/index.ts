import type { BlogRewrite } from './types.js';
import { rewrite as spaceShooterRewrite } from './a-space-shooter-shrank-66-percent-to-fit-in-your-browser.js';
import { rewrite as schedulerViewRewrite } from './twelve-releases-in-four-days-for-the-scheduler-view.js';
import { rewrite as sigmaRewrite } from './sigma-now-shows-who-sits-behind-a-contract.js';
import { rewrite as bookRewrite } from './the-book-didnt-know-what-it-already-held.js';
import { rewrite as newGameRewrite } from './a-new-game-a-week-old-and-already-playable.js';

export type { BlogRewrite } from './types.js';

export const BLOG_REWRITES: BlogRewrite[] = [
  spaceShooterRewrite,
  schedulerViewRewrite,
  sigmaRewrite,
  bookRewrite,
  newGameRewrite,
].filter((r): r is BlogRewrite => r !== null);
