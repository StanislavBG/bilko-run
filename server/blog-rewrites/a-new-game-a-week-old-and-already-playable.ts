import type { BlogRewrite } from './types.js';

const CONTENT = `Eight days ago, this game was just one shader — a slow drift of stars and nebula dust, with nothing to click or fly. Now it is a real game with three layers to explore.

Open the Universe Map and you see solar systems joined by warp lanes. Pick one, and you drop into a system map, where planets link up by transit lanes. Land on a planet, and you drop again, into a 15-minute combat run called the Arena.

A new save starts at Mercury, inside Sol. Sol is now a full eight-planet tutorial called "Escape the Solar System." The rest of the galaxy stays locked until you finish it.

The Arena got the biggest jump this week. Nine enemy types fight you there now, six of them brand new. Some carry extra traits called elite affixes, and a boss now waits at the end of a run. Beat enough runs, and you earn a currency that upgrades your ship before the next one.

One experiment did not survive the week. For one night, the game had a chat drawer built into it: ask a question, and it would start a real AI coding assistant and show its answer right inside the game. It worked. It also forced an odd fix. Godot's pipe reader never notices when that child process ends, so the game had to keep asking "is it still running?" instead of waiting for the pipe to say so. The feature ran for one session, then got deleted a week later. Trying an idea cheap enough to throw away fast is the point of building this way.

Out of 96 commits this week, about five came from an automatic scheduler that runs dev tasks on its own. The other 91 were typed by hand.

This game is not public yet. It has no page on bilko.run/projects, and there is no public code repository either, so there is nothing to click or clone right now.`;

export const rewrite: BlogRewrite | null = {
  slug: 'a-new-game-a-week-old-and-already-playable',
  migrationId: '2026-10-03-rewrite-a-new-game-a-week-old-and-already-playable',
  title: 'A New Game, A Week Old, Already Playable',
  excerpt:
    'A spaceship game went from one starfield shader to a three-tier galaxy with warp lanes and combat runs in eight days. It is not public yet, but here is what got built, including a feature that shipped and was deleted in the same week.',
  content: CONTENT,
};
