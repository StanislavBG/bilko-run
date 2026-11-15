# Ship: host-three-winds-online-mahjong-authoritative-ga (PRD 1789)

- Validation record: `session-manager-operations/reviews/validation/host-three-winds-online-mahjong-authoritative-ga-7da2590f/validate-three-winds-host.md`, with all 12 PRDs VERIFIED and Critical/Important both "none". PASS
- origin/main before: `ba7eccd2197305e4345601e5ef17d5244174a5d6`
- Pushed SHA: `75c6d55559ca74bcd20ee04debe802da34715967` (fast-forward `ba7eccd2..75c6d555`, `git push origin HEAD:main` to github.com/StanislavBG/bilko-run). PASS
- Pushed at: 2026-11-14 9:45:08 PM PST

## Commits pushed (log order, cherry-picked onto origin/main in a throwaway tree)

Origin SHA, then the local-main source SHA in brackets:

- `f855906976f4220aae734ce94362119c8fce3934` feat(play-currency): per-app play-currency ledger with idempotent credit/debit (47373342c4e2)
- `8cf3e7e2d185052e0ef923a0e8521cfbde7f77da` feat(play-currency): escrow and zero-sum hand settlement with ledger-only house account (9615932418ff)
- `5e9f788e43a8d8e2aeb9c4659354ad93a22b2060` feat(play): add Three Winds play-currency catalog (1748f3f88ed8)
- `c0fa62f22235c7de2bf15a4dabea7e8ba7edbc18` feat(rooms): authoritative game-agnostic GameRoom runtime with toy-game tests (9a2b64bc44d0)
- `a2af326e613d9b481d7f276b48a866df1ce9205a` feat(play-currency): tael pack Stripe checkout, balance with signup grant, webhook credit (a59528dd818b)
- `106dcb1099faaae232955ffdfcd475b510c89f6b` feat(apple-iap): StoreKit 2 / ASSN v2 verifier pinned to Apple Root CA G3 (7277a06f27c0)
- `728bfe17e6c64a00b6dcefa256ad22777ac299bc` feat(rooms): WebSocket transport for GameRoom at /api/rooms/socket/:roomId (c6664bb78054)
- `55db372361c70f58206cc554104a1e511352f69a` feat(play-currency): Apple IAP transaction and refund-notification routes (6b73e6540337)
- `5feac0759ae2450dce1af3d6c81092fd4dbf4855` feat(play-currency): taels cosmetic item purchase, entitlements list, no-transfer guard (f6a7c28189ac)
- `099c0ba9d595f7f580f1a45a7687c8125dca1f02` feat(rooms): matchmaking ticket and tiers routes with AI fill and hand escrow (b5cc71c958b2)
- `713e9f6cb25247b81977a80b53242168a698f964` feat(rooms): settle hands into the play ledger, deal next hand, sweep orphaned escrows (fb1c4a63fe7a)
- `75c6d55559ca74bcd20ee04debe802da34715967` docs(rooms): client contract for authoritative game rooms, play currency, tael packs and Render tier (2f74be50651e)

Left out on purpose: plan records (`30882d5f`, `ef4ae3ff`, `59c0980d`, `dc4a2a73`), which `scripts/sync-local-main.sh` publishes, and the card-video commits that `git cherry` marked `-` because they were already on origin.

## Gate on the pushed tree (/tmp/ship-three-winds-host)

- `pnpm install --frozen-lockfile --prefer-offline`: exit 0. It installed @apple/app-store-server-library. No symlinks were needed.
- `pnpm test`: 200 files passed and 2 skipped. 2496 tests passed and 15 skipped. Exit 0. PASS
- `pnpm typecheck`: exit 0. PASS
- `pnpm build`: exit 0. PASS

## Deploy

- At 9:47:45 PM PST, `/api/health` uptime was 41.7 s, against 158 s since the push. That means a new instance is serving the push. PASS

## Live checks (curl --max-time 15, cookie bilko_internal=1, 9:47:54 PM PST)

- GET https://bilko.run/ returned 200. PASS
- POST https://bilko.run/api/rooms/ticket, body `{}`, no Authorization: 401 `{"error":"Sign in required."}`. PASS
- POST https://bilko.run/api/play-currency/checkout, body `{}`, no Authorization: 401 `{"error":"Sign in required."}`. PASS
- GET https://bilko.run/api/realtime/lobbies?app=game-academy returned 200. PASS

Nothing is on sale yet. PLAY_CURRENCY_SALES_OPEN, the APPLE_IAP_* variables and the Render plan are all still owner steps. No game module is registered.

SHIP: PASS
