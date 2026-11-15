# Validation: rooms survive restarts

Base: 3abea7e65eecd4ae0fc0e428df2293c1b77fefad (given). Commits: beb226de (snapshot), 03fc3e69 (store), 2570fc57 (persist), 8c48eed5 (resume), ce38bc42 (open by default). PRD files found in prds-archived/. /code-review and /security-review were not run as separate commands; the combined diff was self-reviewed (SQL, identity, path handling, secrets).

Full run in this worktree: `pnpm typecheck` exit 0; `pnpm test` exit 0 (205 files passed, 2562 tests passed, 15 skipped).

## room-snapshot-restore — VERIFIED
- RoomSnapshot type exact: server/rooms/runtime.ts:69-78.
- snapshot() null outside a hand, JSON copy, no seed: runtime.ts:193-216 (seed field never copied).
- restore(): v!==1 / toAct / isOver throws leave room empty, no timers; AI aiDelayMs, human deadlineMs or turnMs, keeps startSeq: runtime.ts:225-262, parseSnapshot 264-284.
- onChange hook: interface runtime.ts:61; fired after startHand broadcast (:374), finishHand (:446), voidHand (:460).
- Gate `vitest run rooms-runtime rooms-routes rooms-settlement rooms-socket`: 4 files, 77 passed. tests/rooms-threewinds.test.ts also run: passed.

## room-table-store — VERIFIED
- room_tables and room_table_seats, IF NOT EXISTS, additive: server/db-schema.ts:697-720.
- All nine exports present: server/services/room-store.ts (saveTable :74, heartbeatTables :104, suspendTables :115, claimTable :129, loadTable :138, findTableIdForEmail :144, deleteTable :151, listTables :159). saveTable replaces seat rows in one transaction.
- claimTable is a single UPDATE `WHERE id = ? AND (status='suspended' OR heartbeat_at < ?)`, winner by `changes === 1` (:129-136). Test "exactly one of two concurrent claims" present.
- SQL: every statement uses `?` placeholders through dbRun/dbGet/dbAll/txRun; no interpolation (grep of room-store.ts). Extra: saveTable is fenced by `WHERE room_tables.owner IS excluded.owner`, so a stale instance cannot overwrite a claimed table.
- Gate `vitest run room-store play-currency-escrow`: 2 files, 17 passed.

## rooms-persist-tables — VERIFIED
- Owner = RENDER_INSTANCE_ID or random: server/routes/rooms.ts:125. onChange → scheduleSave, serialized per table on saveChain; failures logged, not thrown (:162-168, :431 area).
- Heartbeat 15 s, unref, only while tables exist: rooms.ts ensureHeartbeat. closeTable deletes the row (skipped after suspend so the row is kept).
- preClose hook: server/shutdown.ts (preClose runs before closeAllGameRooms), wired server/index.ts:425-428; suspendRoomTables awaits pending saves, final save, then suspendTables(OWNER).
- tests/rooms-persist.test.ts: 3 tests (snapshot equals room.snapshot, closed table no row, shutdown leaves owner NULL).
- Gate (persist, routes, settlement, threewinds): passed.

## rooms-resume-tables — VERIFIED
- Ticket route: seat lookup, resumeTable → claimTable(id, OWNER, now, 60_000), rebuild from row via GameRoom.restore, ticket for caller's own seat (identity from auth, not body): rooms.ts ticket route; 503 `table_moving` with `retry-after: 5` when the claim loses and the row exists.
- Settle-once: restored table keeps stored `escrowed` map and the same ref `room:<id>:hand:<n>` (doResume `t.escrowed = escrowed`); settleHand treats `{settled:false}` as already paid, pays nothing (rooms.ts settleHand). settlePlayHand is idempotent per ref (play-currency.ts:137-170). Test "a hand already settled before the restart pays nothing more" passes.
- Sweeper: skips escrows of any room with a room_tables row (`saved.has && !voiding`), and of rooms being restored; abandoned (suspended >10 min by updated_at, or heartbeat >10 min) rows are fenced with claimTable first, escrows released, row deleted. Test "voids a table nobody returns to within 10 minutes" passes; "503 ... sweeper keeps its escrow" passes.
- Gate (resume, persist, routes, settlement, threewinds): 5 files, 39 passed.

## rooms-open-by-default — VERIFIED
- Gate is `gated && envListIncludes('ROOMS_CLOSED', appId)` on both endpoints; ROOMS_OPEN is no longer read in server/ (grep: only tests mention it, including a test asserting it is ignored).
- tests/rooms-routes.test.ts covers default 200 with the four tiers, ROOMS_CLOSED 409 on both endpoints, env restore.
- docs/deployment.md:59-60 and docs/host-contract.md (rooms_closed rows, table_moving row, 1012 row, reconnect bullet, Three Winds "Tables open") match the code (503 + Retry-After 5, 60 s lease, 10-minute void). The doc's "about 90 s" is a prose estimate (lease 60 s + retries), not enforced in code.
- Gate (routes, threewinds, resume): passed.

## Findings

### Critical
- none

### Important
- none

### Minor
- server/routes/rooms.ts sweepOrphanedEscrows: the abandoned-table fence calls claimTable(OWNER), which makes the row active with this process's fresh heartbeat. If the following deleteTable (or a releasePlayEscrow, via `failed`) fails, the row stays owned by this process and heartbeatTables keeps renewing it while any table is live; the table then looks fresh and its escrows are skipped until restart. Narrow (needs a store error at that moment); a retry path that ignores heartbeat for non-live rows would close it.
- Edge, not a money loss: a crash between settlement and the next save leaves a row whose snapshot is the finished hand; restore() rejects an isOver state (empty room) and the stored escrows are released as a void, settlePlayHand's per-ref idempotency prevents any double pay.
- tests/rooms-threewinds.test.ts still sets ROOMS_OPEN (harmless, PRD told to leave it).
