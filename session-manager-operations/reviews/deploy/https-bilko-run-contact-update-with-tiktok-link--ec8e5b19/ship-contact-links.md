# Ship: contact-tiktok-forum-links

- Pushed SHA: 18a39b91efe6bd307e7893858ecaa2b5475637a4 on origin/main (StanislavBG/bilko-run), 1:4x PM PDT 2026-10-31
- Commit: `feat(contact): link TikTok and the live Forum` (cherry-picked from local 7ba77746 onto origin/main 43badbd4; no other local-main commit pushed)
- Validation record: VERIFIED, no Critical/Important finding — PASS
- Throwaway tree /tmp/ship-contact-links: `pnpm test` (1840 passed, 20 skipped), `pnpm typecheck`, `pnpm build` all exit 0 — PASS
- Push to origin only, no force — PASS
- Live check 1:54 PM PDT, try 1 (an earlier batch of tries failed only because of an unset $TMPDIR script path; the script never ran):
  - 1280x720 TikTok row: href https://www.tiktok.com/@bilkobibitkov, target _blank, rel "noopener noreferrer", text @bilkobibitkov, no "(soon)" — PASS
  - Forum click: reached /forum, heading `Forum.` visible, window.__spaMark still 1 (no full load) — PASS
  - 390x844: Forum row is top element at its center; scrollWidth 390 = innerWidth 390 — PASS
  - TikTok row never clicked
- Screenshots: /tmp/ship-contact-links-1280.png, /tmp/ship-contact-links-390.png (390 shows Email, Twitter, GitHub, LinkedIn, TikTok, Forum rows)

SHIP: PASS
