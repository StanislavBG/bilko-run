---
"host-kit": minor
---

Fix: `useSaveState`, `useUnlocks` and `useLeaderboard().submit` sent cookies only,
which the bilko.run host ignores — every authenticated call 401'd. They now send
`Authorization: Bearer <Clerk JWT>` via the new auth helpers, and skip the request
entirely when no user is signed in.

New exports: `initAuth`, `useAuth`, `openSignIn`, `signOut`, `getAuthToken`,
`authFetch`, `hasSignedInCookie`, and the `AuthState` type. They lazy-load clerk-js
from `clerk.bilko.run`, only when the `__client_uat` cookie shows a prior sign-in.
