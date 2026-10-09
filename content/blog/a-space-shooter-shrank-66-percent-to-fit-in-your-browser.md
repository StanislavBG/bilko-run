---
slug: "a-space-shooter-shrank-66-percent-to-fit-in-your-browser"
title: "A Space Shooter Shrank 66% to Fit In Your Browser"
excerpt: "Escape Velocity now runs straight in a browser tab, no download. Getting there meant cutting the game package from 43.4 MB to 14.6 MB and teaching the host to compress and serve wasm."
category: "product"
published: true
published_at: "2026-09-26T19:00:00.000Z"
order: 41
---

[Escape Velocity](/projects/escape-velocity/) is a keyboard-only space-survivors arcade run — the Sol tutorial campaign of a bigger game called Starry Night Ships II, eight real planets as levels with two mini-bosses and a boss per planet, plus a bonus wizard duel waiting on Pluto once you clear the ring. It's for anyone who wants five minutes of an arcade run on a weeknight. To start, open the tile above — it boots in the browser, nothing to install.

**Was.** Until last week this only existed as a desktop Godot build on my machine, not even pushed to a remote yet. Playing it meant exporting a Linux binary and running it from a terminal.

**Now.** It's a browser game. The Godot project exports straight to WebAssembly, which sounds like it should just work, and mostly did — except the resulting package was 43.4 MB, almost all of it fifteen Blender-baked 2048×2048 ground textures and seventeen planet surface maps, imported lossless. Re-importing them as lossy WebP at the same resolution got the package to 14.6 MB with no visible drop in quality side by side (I diffed before/after captures on Earth and Neptune to check). The source art never changed — only how Godot packs it for export.

That number mattered because of what it unblocked on the host side. Bilko's publish pipeline gives every game a 250 KB size budget by default, which a wasm engine blows through before the player ever sees a texture; Escape Velocity now gets an explicit 30 MB exemption instead, the compressor got taught to gzip \`application/wasm\` the same way it already gzips JS, and the CSP had to open a narrow door — \`wasm-unsafe-eval\`, wasm compilation only, not JS eval — before a browser would run the engine at all. None of that is visible to a player; all of it is why the tab downloads a roughly 10 MB payload instead of the uncompressed ~40 MB the export produces by default.

The bug worth mentioning: the quit button froze the browser tab solid on first try. Godot's \`get_tree().quit()\` assumes there's a process to exit, and a browser tab isn't one — that call is now skipped on web, the save still runs, and the menu relabels Quit to Save so it doesn't claim to do something it can't. A Playwright spec now boots the exported build headless and checks the save survives a reload, so that regression can't sneak back in quietly.

What's next: the underlying repo (\`starry-night-2\`) is still local-only — pushing it to GitHub is the next real task, not a game feature. After that, whether Escape Velocity grows past the Sol tutorial into the rest of the six-system universe depends on whether anyone actually finishes Sol first.