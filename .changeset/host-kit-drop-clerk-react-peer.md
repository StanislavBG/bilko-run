---
"host-kit": minor
---

Drop the `@clerk/clerk-react` peer dependency — nothing in host-kit imports it (auth loads clerk-js from the host's Clerk Frontend API at runtime), so consumers no longer install the deprecated package. Add `getAuthState()` and `subscribeAuth(listener)` so non-React consumers can read and observe auth state; `useAuth` is now built on them.
