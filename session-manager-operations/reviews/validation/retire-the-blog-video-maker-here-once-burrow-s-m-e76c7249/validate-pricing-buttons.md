# Validation: portfolio-button-reset-base-layer

Base: ea717f21863b85d9785cfcd4f03ac4f3f6556bc3. PRD found at `prds-archived/1554-portfolio-button-reset-base-layer.md`. Commit `cd971c52` ("fix(site): move the shell button reset into the base layer").

## portfolio-button-reset-base-layer — VERIFIED

- Reset in `@layer base`: `git show cd971c52 -- src/styles/portfolio.css` wraps the `.portfolio-shell button` rule in `@layer base { }`. Declarations are unchanged and the diff is 4 lines (+3/-1), so no other rule moved.
- Spec: `e2e/pricing-buttons.spec.ts` checks the 'Add $3' and first 'Order' background-color against `rgba(0, 0, 0, 0)` and 'Add $3' padding-left > 0. It is a new file in the commit. I did not re-run it against the old CSS (the pre-fix failure is the executor's claim).
- Gate 1 re-run: `playwright test e2e/pricing-buttons.spec.ts` gave 1 passed.
- Gate 2 re-run: site-navigation, projects-hub, home-radar and forum specs gave 30 passed.
- Gate 3 re-run: `pnpm typecheck` exit 0.
- Commit subject is exact, so the ship PRD can find it.
- Per-page screenshots in the executor's report: not re-checked, since the screenshots were throwaway. Instead I opened /, /projects, /forum and /pricing in Chromium at 1280x720 on `pnpm dev` (port 3002) and read each full-page screenshot. I also dumped computed background, padding and color for every `<button>`. No top-up, Order or `[data-buy]` button was clicked.
  - /pricing: 'Add $3', 'Add $5' and 'Add $10' are filled orange (rgb 255,107,26) with 20px padding and white text. Their paler look in the screenshot is the disabled state (Clerk does not load on localhost), as the PRD expected. The 5 'Order' buttons and 'Book a call' have a pale fill, orange text and 20px padding.
  - /forum: the category filters are bordered pills, 'All' is dark-filled, and 'Start a thread' is a dark pill.
  - /projects: the ←/→ pager buttons are bordered, the cards are filled, and 'Full story' and 'Open →' look right.
  - /: 'Flip to the blog →' is a filled red pill. The Search and Menu buttons are intentionally transparent.
  - No button on these four pages lost its style.

## Findings

- Critical: none.
- Important: none.
- Minor: `src/styles/portfolio.css:38` — `.portfolio-shell a` is still unlayered. The PRD marks it out of scope.
- Minor: the Search and Menu buttons on every page (and the /projects pager buttons) compute a transparent background with 0 padding. This is intended, since the screenshots show them styled as header pills and bordered boxes.
- Code and security review: self-reviewed. The diff is CSS plus one read-only spec, with no input handling or secrets. The plan's wider diff (blog-video script removal) belongs to other PRDs.
