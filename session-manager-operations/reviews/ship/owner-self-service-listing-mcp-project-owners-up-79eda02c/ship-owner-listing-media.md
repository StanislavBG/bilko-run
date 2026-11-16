# Ship: owner listing media (PRD 1863)

Validation record validate-owner-listing-media.md: all 10 PRDs VERIFIED.

## Pushed commits

The job branch was origin/main (5bc41fb9) plus this plan's 12 commits plus 3 record-only commits from
the no-size-budgets plan (50d696d2, 385590af, 75b06bd9). So the 12 were cherry-picked in order onto a
temp worktree at origin/main and pushed (no force) at 5:59 PM PST, 2026-11-15: `5bc41fb9..72ee5eef`.

| origin sha | branch sha | subject |
| --- | --- | --- |
| 95cee9117d829e1ad89b9c5950651712fc6dcd95 | ba7a331f | feat(server): 302 external-url /projects/<slug> paths to host.url (leftover 1844) |
| 1105a95d0fe12c27f7f094f242e5d9923c95170c | c9b4dfec | feat(mcp-host): hosted card media path contract and share-assets skip |
| 9421ce216ae9f3b355d3cbbac3cf7b5f16564ed7 | 2ba13aa0 | feat(shared): listing-media path helpers and Buffer card-media checks |
| 120280cfccc24e6debea6d3186b07eea440cadad | 8a9af0eb | feat(listing-media): chunked DB store for owner card media |
| b130d28f868d0c702950b0130ef6496fa1c765e5 | d51629e0 | feat(mcp-host): setListingMedia core |
| 38471fc6cf55268b630c7ca615778e596caafeb3 | 250d1af0 | feat(og): serve hosted listing media in /og cards and card versions |
| 1d591b77ee221209f3b6afab150d3aafe80fe47f | e74b73e0 | feat(listing-media): serve owner card media from the DB |
| 204d2c4251c681685acb3b4b7fabd5922bb53d26 | f75570c0 | feat(mcp-host): register set_listing_media tool |
| af5c87cd7a2a92cd5c41eeaf4bbc12a5ea0b366e | f3251c11 | feat(listing-media): content-addressed PUT /api/listing-media/:slug/:file |
| bffd4ca04a235ad8c3fc4aeab50d62184230dcaa | 6a6c4f00 | feat(projects): card reads hosted video audio flag |
| 8c062857004dc5d7335f5e89b0ec95cbd298f9ea | 6f6c7ed2 | docs(host-contract): document set_listing_media |
| 72ee5eef42583c5337b259c5516a7c68275a11a9 | f42427dd | docs(validation): verify owner listing media plan |

## Shared tree sync

`bash scripts/sync-local-main.sh` in ~/Projects/Bilko exited 0: "3 record commit(s) to publish ...
pushed 3 record commit(s) to origin main ... local main is now 08a7c2f3: 0 ahead, 0 behind". The script's
own step 2 published the three no-size-budgets records; this job did not push them.
`grep -c set_listing_media ~/Projects/Bilko/mcp-host-server/dist/server.js` = 5.

## Live checks

Deploy signal: the `_media` 404 with `x-bilko-media: missing`. Tries 1-6 returned a plain 404 (old build);
try 7 at 6:02 PM PST matched.

- `curl -sI https://bilko.run/projects/escape-velocity/_media/<64 zeros>.mp4`: HTTP/2 404,
  `x-bilko-media: missing`, `cache-control: no-store`, `content-type: application/json; charset=utf-8`.
- `PUT https://bilko.run/api/listing-media/escape-velocity/<64 zeros>.mp4`: HTTP 404, body `{"error":"not declared"}`.
- `https://bilko.run/projects`: HTTP/2 200, `content-type: text/html`, `cache-control: private, no-store`.
- `https://bilko.run/og/escape-velocity.png`: HTTP/2 200, `content-type: image/png`, `content-length: 4791205`,
  `cache-control: public, max-age=300`.
- Escape Velocity card video from the registry (`/projects/escape-velocity/tile.mp4`): HTTP/2 200,
  `content-type: video/mp4`, `content-length: 7381012`, `cache-control: public, max-age=86400`.

No project's media was uploaded or declared.

## Feedback

Target: /home/bilko/Projects/family-frame. Message to send (verbatim):

> set_listing_media is live in the bilko-host MCP. Start a new session so the MCP reloads. Then call
> `set_listing_media { slug: 'family-frame', callerRepoPath: '/home/bilko/Projects/family-frame', media: { video: '<abs path to the 1200x630 MP4>', shareImage: '<abs path to the 1200x630 PNG>' } }`.
> Limits: `video` is .mp4 (ftyp) or .webm (EBML), at most 8 MB; `shareImage` is a PNG of exactly 1200x630,
> at most 5 MB; `icon` is a square PNG of 128-1024 px, at most 512 KB. A field left out keeps its value; null removes it. The card updates after about a minute. Docs:
> ~/Projects/Bilko/docs/host-contract.md, section 'Card media upload (set_listing_media)'.

## Superseded plan

PRDs 1837-1843 of Epic let-external-url-projects-publish-card-media-lis-14c11e39 were cancelled and archived at 4:31 PM PST on 2026-11-15 because they committed card media into public/projects/<slug>/ for external-url slugs only; this plan stores owner media in the host database for every host kind, so one media path ships.

FEEDBACK: NOT SENT — the session-manager-scheduler MCP tool feedback_open_session is not in this headless run's tool scope (the scheduler enforces the scope), so no call could be made. The message above is ready to send as is.
