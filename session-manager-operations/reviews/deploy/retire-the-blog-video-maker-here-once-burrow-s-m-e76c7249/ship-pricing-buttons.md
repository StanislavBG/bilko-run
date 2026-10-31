# Ship: pricing buttons

- Pushed SHA: 43badbd4d0649365303460204afe359192b4f4e5 (cherry-pick of cd971c52)
- Commit: `fix(site): move the shell button reset into the base layer`
- Pushed: 2026-10-31 1:31 PM PDT, `git push origin HEAD:main` to StanislavBG/bilko-run only (3d3162f0..43badbd4). No other local-main commit (e.g. ea717f21) was pushed.
- Live check passed: 2026-10-31 1:34 PM PDT (try 6 of 20; tries 1-5 showed the old CSS while Render deployed)

## Checks
- Validation record VERIFIED, no Critical/Important finding: PASS
- Exactly one matching commit, cherry-pick clean onto origin/main: PASS
- `pnpm test` (1837 passed, 20 skipped) on pushed tree: PASS
- `pnpm typecheck` on pushed tree: PASS
- `pnpm build` on pushed tree: PASS
- Origin URL is StanislavBG/bilko-run: PASS
- Live /pricing 1280x720 signed out, 'Add $3': background rgb(255, 107, 26), padding-left 20px: PASS (no button clicked)
- Screenshot: /tmp/pricing-live.png

SHIP: PASS
