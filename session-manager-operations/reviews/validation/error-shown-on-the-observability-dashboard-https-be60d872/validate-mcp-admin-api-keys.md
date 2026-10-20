# Validation: admin API keys plan (PRDs 1454-1459)

Base: 2730a1132940887db08694a972f582ec0f70f95a (HEAD a6af4621). Gates re-run in the foreground:
`pnpm vitest run` on admin-api-keys, admin-api-keys-routes, admin-api-keys-ui, clerk-auth, observability, mcp-errors-report, mcp-dist-sync gives 7 files / 81 tests passed. `pnpm typecheck` exit 0.
/code-review and /security-review were not run as separate tools; I self-reviewed the combined diff.

## 1454 admin-api-keys-service: VERIFIED
- Table plus hash index: server/db-schema.ts:614-626 (column set matches the AC).
- Mint: server/services/admin-api-keys.ts:30-43. 'bka_' + randomBytes(32) base64url, only sha256 stored, prefix is 12 chars, ttl clamped 1..365 (default 90), label sliced to 80.
- Verify: :45-55 checks prefix, hash, revoked_at IS NULL, expires_at > now, ADMIN_EMAILS, and updates last_used_at only if 60s or more have passed.
- List selects no key_hash (:58-62). Revoke is owner-scoped (:64-68).
- Raw key never persisted: the INSERT binds only hashKey(key) and the prefix. tests/admin-api-keys.test.ts passes (5 tests).

## 1455 admin-api-keys-auth: VERIFIED
- server/clerk.ts:86-107. The bka_ branch lazy-imports the service, returns 403 on a bad key, returns 403 'Admin API keys are read-only.' for any method other than GET/HEAD, and sends non-bka_ tokens to the unchanged Clerk path. requireAdminSession keeps the Clerk-only behaviour (:73-84).
- server/routes/admin-api-keys.ts: POST, GET and POST :id/revoke all use requireAdminSession, so keys are rejected on every management route. Revoke of a non-owned key returns 404. Registered at server/index.ts:188.
- routes test (10 tests) covers read OK, key mint 403, key list 403, non-GET 403, revoked/garbage 403, mint then use, and cross-owner revoke 404. clerk-auth and observability pass unchanged.

## 1456 admin-api-keys-ui: VERIFIED
- SecretsPage.tsx adds keyStatus, an ApiKeysPanel with create form, shown-once key field with Copy, Revoke behind window.confirm, and dimmed rows. The key lives only in useState (setNewKey) and is cleared on dismiss.
- grep of the added lines finds no localStorage, sessionStorage, location or console use. keyStatus tests pass (3).

## 1457 mcp-errors-via-admin-api: VERIFIED
- errors-report.ts no longer imports db.js. It uses fetch with a 15s AbortSignal.timeout, BILKO_BASE_URL with the trailing slash stripped, and the exact missing-key message. 401/403 give an invalid/expired/revoked message, 404 gives null, and other non-2xx give status plus a body of at most 200 chars.
- The key never appears in thrown messages: the 401/403 text contains only the env var name, and the body excerpt is redacted with replaceAll(key).
- server.ts descriptions say they call the admin API read-only, and the output uses `source` instead of `database`. dist-sync test passes.
- The README documents BILKO_ADMIN_KEY and BILKO_BASE_URL, but not in the table (see Minor 1).

## 1458 mcp-usage-report-via-admin-api: VERIFIED
- adminGet is exported and used by errorsReport/errorDetail. usage_report calls adminGet('/api/admin/egress?days=N') and maps through mapEgressToUsage, with static from bySlug and api from the non-'static:' rows.
- It no longer queries the DB. hostDbSource and its 'local' note are removed, with no remaining references. dist matches src (mcp-dist-sync test passes).

## 1459 error-triage-skill-admin-api: VERIFIED
- .claude/skills/error-triage/SKILL.md has no TURSO or `database` mention. Step 1 stops with setup pointers on a missing, invalid, expired or revoked key. A One-time setup section covers /admin/secrets, mcpServers."bilko-host".env.BILKO_ADMIN_KEY, a restart, and the never-paste-the-key warning. The rest of the procedure is only renumbered.
- Tool names match server.ts. The file is under 120 lines.

## Findings
### Critical
- none
### Important
- none
### Minor
1. mcp-host-server/README.md:104-105: the BILKO_ADMIN_KEY and BILKO_BASE_URL rows were appended after the Safety-notes bullets instead of in the Environment variables table (~line 91). They render as orphan pipes. Move them under the table.
2. server/clerk.ts:92: a bka_ prefix check uses `header.startsWith('Bearer bka_')`, which is case-sensitive on 'Bearer'. A lowercase 'bearer bka_' falls through to Clerk and is refused, so this fails safe.
3. The plan's PRD files were all found in prds-archived/, so none were missing.
