---
"host-kit": patch
---

`bilko-host-kit` manifest CLI: detect the bare `host-kit` dependency name (and still
the legacy `@bilkobibitkov/host-kit`), reading the installed version for `file:`
specifiers. Before this, bare-name consumers got `hostKit.version: "0.0.0"`.
