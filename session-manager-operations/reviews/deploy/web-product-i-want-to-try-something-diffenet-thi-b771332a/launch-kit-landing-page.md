# Launch Kit landing page

- Sibling repo: `/home/bilko/Projects/Bilko-Launch-Kit`, commit `589f0b5` (`site/`)
- Stack: Vite 6 + vanilla TypeScript, gsap bundled from npm, base `/projects/launch-kit/`, entries `index.html` + `thanks/index.html`
- Dist size: 145,367 bytes on disk, 53.6 KB gzipped (7 files incl. manifest.json); `dist/manifest.json` emitted by `scripts/emit-manifest.mjs`
- Design: instalanding.ai "clay-constellation-saas-hero" brief (theme + bar + slab + measuring-frame button), launch-control copy; chat demo is labelled sample output

## Sections
nav, hero (headline, subhead, $9 one-time chip, `#buy` button, tilted page-roast chat demo), clay stat cards (8 skills, 1 shared context file, scored rubrics, $9), What's inside (8 skill cards), How it works (4 steps), pricing card, FAQ (6 Qs), Built on open source credits, final CTA, footer (bilko.run, /projects, /privacy, /terms)

## Screenshots (in sibling repo)
- `site/screenshots/desktop-1512-hero.png`, `desktop-1512-full.png`
- `site/screenshots/mobile-390-hero.png`, `mobile-390-full.png`

## Notes
- Playwright (4 tests) passes: no horizontal overflow at 1512/390, no page errors, credits/FAQ facts present, no external scripts or inline handlers, thanks page served.
- `#buy` has no behaviour yet; `thanks/` is a placeholder (launch-kit-buy-flow).
- Ran `playwright install chromium` locally (cached browser build was older than installed Playwright).
