import type { BlogRewrite } from './types.js';

export const rewrite: BlogRewrite = {
  slug: 'a-space-shooter-shrank-66-percent-to-fit-in-your-browser',
  migrationId: '2026-10-03-rewrite-a-space-shooter-shrank-66-percent-to-fit-in-your-browser',
  title: 'Play Escape Velocity In Your Browser, No Download',
  excerpt:
    'Escape Velocity is a space-shooter arcade run you can now play right in your browser, no download. We cut the game’s download size by two-thirds so it would actually load fast.',
  content: `Escape Velocity is a space-shooter arcade run, and you can now play it right in your browser. Open [bilko.run/projects/escape-velocity/](https://bilko.run/projects/escape-velocity/) and the game boots on the spot. Nothing to install.

The game is the Sol tutorial campaign from a bigger project called Starry Night Ships II. You fly through eight real planets. Each one has two mini-bosses and a boss fight. Clear the ring around Pluto and a bonus wizard duel waits for you. It plays with just your keyboard. Five minutes is enough for one run.

Until last week, this only ran on one desktop machine. To play it, you had to export a Linux program and start it from a command line. Now it is a browser game.

Getting there meant shrinking the game a lot. The first browser export came out at 43.4 MB. Most of that weight was textures: 15 ground images and 17 planet surface maps, each one large and stored with no compression at all. We saved those same textures again in a smaller format called WebP. That cut the game down to 14.6 MB. That is a 66% drop, with no drop in how it looks. We checked Earth and Neptune side by side to be sure.

The size cut mattered for a rule on our side. Bilko's game host gives each game a budget of 250 KB by default. A browser game engine blows past that before a player even sees one texture. Escape Velocity now gets its own 30 MB allowance instead. We also set the server to compress the game file, the same way it already compresses other code. And we opened one narrow door in our security rules so the browser would run the game engine at all. None of this shows up on screen. It is why your browser now downloads about 10 MB instead of the roughly 40 MB the export makes by default.

One bug nearly broke the launch. The quit button froze the browser tab solid. The game's quit command expected a program running on a desktop, and a browser tab is not that. We skip that command on the web now. Your save still happens, and the button now reads "Save" instead of "Quit." A new automated test opens the game, saves, reloads the page, and checks the save is still there.

What's next: the code behind the game still lives on one machine only. Pushing it to a public host comes before any new planet gets added. Whether the game grows past this one tutorial depends on whether players finish it first.`,
};
