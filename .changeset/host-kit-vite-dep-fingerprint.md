---
'host-kit': minor
---

Add `host-kit/vite`: `hostKitVite()` makes the Vite dev server re-bundle host-kit whenever the installed copy changes. Apps on the `file:` dependency no longer serve a stale host-kit after `pnpm install`, which Vite's lockfile-keyed dependency cache caused. The README's refresh steps now clear `node_modules/.vite` for apps without the plugin and check what the dev server serves.
