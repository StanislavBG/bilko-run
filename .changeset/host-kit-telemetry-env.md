---
"host-kit": minor
---

Telemetry stamps every event, log and error record with `env` (`'prod' | 'dev' | 'test'`), resolved once at init: `'prod'` on bilko.run and www.bilko.run, otherwise `'test'` when `navigator.webdriver` is true, otherwise `'dev'`. `initTelemetry({ env })` overrides it (any other value is ignored). New exports: `resolveEnv()` and the `TelemetryEnv` type.
