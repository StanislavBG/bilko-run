---
"host-kit": patch
---

Telemetry SDK: log and error enqueues now refresh the session cookies once instead of twice, and visitor/session ids fall back to a Math.random v4 UUID where `crypto.randomUUID` is unavailable (e.g. plain-http pages) instead of `anon`.
