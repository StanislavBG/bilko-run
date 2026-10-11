---
"host-kit": patch
---

Drop the Academy link from `SiteHeader`'s `DEFAULT_SECTIONS` so it matches the host nav (Home, Projects, Blog, Contact). Build `dist/` on install (`prepare`) so `file:` consumers never pick up a stale build.
