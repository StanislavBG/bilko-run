---
title: Launch Kit page: make all four buy buttons one consistent button style
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T21:50:59.713Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: bug
agentType: dev-lead
planId: pl-mv4cxsw1-4fe9c4
---
# Goal

behavior: the four [data-buy] buttons on the Launch Kit page (private sibling repo /home/bilko/Projects/Bilko-Launch-Kit/site) look like three different components. The header uses a small round yellow .pill labelled 'Get it · $9'. The hero uses the yellow lens-shaped .btn with the measuring-frame hover. The pricing card uses an inverted black .btn. The final CTA uses a round yellow .pill with no frame. Make every buy button the hero's .btn look (yellow fill, dark text, same font, 30% / 200% radius, same hover), with a compact header variant, so buyers see one consistent buy button.

# Acceptance criteria

- [ ] site/index.html: all four [data-buy] elements use class btn. Hero, pricing-card and final CTAs sit in a .btn-wrapper with the measuring-frame dots and lines. The header one is `btn btn-sm` (frame optional there). None uses .pill.
- [ ] Labels: the header reads 'Get it — $9'; the other three read 'Get the Launch Kit — $9' (em dash, no middle dot).
- [ ] site/src/style.css: .btn-sm is a compact size only (smaller padding and font-size, at least 14px). The pricing-card override no longer inverts the fill: the button is yellow there too, with a dark ring (for example a 2px #111 outline or box-shadow) so it stands out on the yellow card. The hover frame stays visible on every surface.
- [ ] site/tests/landing.spec.ts: a new test reads the computed style of all 4 [data-buy] elements and asserts the same background-color, color, font-family, font-weight and border-radius. Hero, pricing and final share font-size and height within 1px. All existing tests still pass.
- [ ] Screenshots of the four buttons at 1512px and 390px are reviewed and committed in site/screenshots/; no horizontal scroll at 390px; the header button still fits the bar on mobile.
- [ ] dist/ is rebuilt with no .zip or SKILL.md and committed in the sibling. session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-style.md is committed in Bilko with the sibling SHA and test summary.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-style.md

# Implementation notes

The real work is in the private sibling repo /home/bilko/Projects/Bilko-Launch-Kit, which must never be pushed to a public remote. The only Bilko commit is the record file.

Read first:
- /home/bilko/Projects/Bilko-Launch-Kit/site/index.html lines 14-45, 140-160 and 186-195. These hold the four data-buy CTAs: the header pill at line 20, hero #buy, the pricing-card .btn and the final .pill.
- /home/bilko/Projects/Bilko-Launch-Kit/site/src/style.css:
  - lines 26-34 (.bar, .pill, .pill-sm)
  - lines 74-98 (.btn-wrapper, .btn, hover, .dot/.line frame, `.slab-black { --dot-color; --line-color }`)
  - line 140 (`.price-card .btn { background: #111; color: #fff }`, which is the inversion to remove)
  - line 188 (aria-disabled rule)
  - lines 165-185 (mobile media query)
- /home/bilko/Projects/Bilko-Launch-Kit/site/src/buy.ts. It is behaviour only and must keep working: the data-buy handler, "Opening checkout…", errors next to the clicked CTA.
- /home/bilko/Projects/Bilko-Launch-Kit/site/tests/landing.spec.ts and golden.spec.ts. The per-CTA checkout tests must still pass.

Steps:
1. Write the computed-style consistency test first and see it fail (capture this early).
2. index.html:
   - header: `<a class="btn btn-sm" href="#pricing" data-buy>Get it — $9</a>`
   - final CTA: swap the .pill for a .btn-wrapper containing `<a class="btn" href="#pricing" data-buy>` plus the 4 dot and 4 line spans, copied from the pricing card markup.
   - Keep #buy on the hero and every data-buy attribute and href.
3. style.css:
   - Add .btn-sm.
   - Change the .price-card .btn override to a yellow fill with a dark ring, and make its hover match the other buttons.
   - Make sure the frame colours read on the yellow card, cream page and black slab.
   - Leave .pill itself alone, because the thanks page uses button.pill.
4. Build, run tests, and look at the screenshots yourself (1512px and 390px, each button, idle and hover) before committing. Retake the site/screenshots/ set the way the existing files were made.
5. Commit only your changed files in the sibling; leave the untracked site/scripts/live-purchase.mjs alone. Then write and commit the Bilko record.

Do not touch: buy.ts behaviour, pack/, dist-pack/, releases/, thanks page styling, and any Bilko file except the record. The next PRD publishes.

# Out of scope

- Publishing (next PRD)
- Copy changes beyond the two button labels
- Changing the pricing card's own colour or layout

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build
timeout 300 pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
