# Launch Kit buy flow

Sibling repo `~/Projects/Bilko-Launch-Kit`, commit `e644449` (site/).

- `src/buy.ts`: #buy POSTs `/api/web-products/launch-kit/checkout`, disables while pending, `location.assign(url)`; non-2xx shows inline error; `?checkout=cancel` shows "No charge made".
- `src/thanks.ts` + `thanks/index.html`: order verify (paid / 402 retry every 3s x10 / 400,404 help link / 429 limit + sign-in recovery); recovery uses host-kit `openSignIn`/`authFetch` on `account-download`, saves `bilko-launch-kit-<version>.zip`.
- `src/track.ts`: one `/api/analytics/pageview` per page load (path = location.pathname); landing sends `view_tool` (tool `launch-kit`); never sends `checkout_start`.
- Dependency `host-kit: file:../../Bilko/packages/host-kit` (+ react 18, required by host-kit's auth module). No host-kit build committed.
- `tests/golden.spec.ts` (all `/api/**` stubbed). `tests/landing.spec.ts` thanks test updated for the new page.

## Test output
`pnpm build` OK; `pnpm test` (site/): 13 passed (9 golden, 4 landing).
dist/ rebuilt (gitignored); no `.zip` or `SKILL.md` file under dist. `grep -rl SKILL.md dist` hits only `index.html`, where the FAQ sentence names the file; it is prose, not a bundled file.
