---
"host-kit": minor
---

Add `SiteHeader` — a shared, dependency-free Bilko top bar for static-path
sibling apps. Reproduces the host's `pf-topbar` (brand, section links to
absolute bilko.run URLs, optional Search/⌘K trigger, Online status pill, and a
`rightSlot` for app-specific controls) without needing Clerk or React Router, so
siblings served at `/projects/<slug>/` get consistent brand chrome. Theme-aware
via host-kit CSS tokens with Bilko-light fallbacks. Exports `SiteHeader`,
`DEFAULT_SECTIONS`, and the `SiteHeaderProps` / `SiteSection` types.
