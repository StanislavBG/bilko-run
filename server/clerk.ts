import { verifyToken, createClerkClient } from '@clerk/backend';

export const ADMIN_EMAILS = ['bilkobibitkov2000@gmail.com'];

let _clerk: ReturnType<typeof createClerkClient> | null = null;

function getClerk() {
  if (!_clerk) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;
    _clerk = createClerkClient({ secretKey });
  }
  return _clerk;
}

// Short-lived cache: token → email (60s TTL, avoids 2 HTTP calls per request)
const _tokenCache = new Map<string, { email: string; expiresAt: number }>();

/** Verify a Clerk session token and return the user's email, or null if invalid/missing. */
export async function verifyClerkToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  // Check cache first
  const cached = _tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.email;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload?.sub) return null;

    const clerk = getClerk();
    if (!clerk) return null;

    const user = await clerk.users.getUser(payload.sub);
    const email = user.primaryEmailAddress?.emailAddress ?? null;

    // Cache for 60 seconds
    if (email) {
      _tokenCache.set(token, { email, expiresAt: Date.now() + 60_000 });
      // Prune old entries periodically
      if (_tokenCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of _tokenCache) {
          if (v.expiresAt < now) _tokenCache.delete(k);
        }
      }
    }

    return email;
  } catch {
    return null;
  }
}

/** Require authenticated user. Returns email or sends 401 and returns null. */
export async function requireAuth(req: any, reply: any): Promise<string | null> {
  const email = await verifyClerkToken(req.headers.authorization);
  if (!email) {
    reply.status(401).send({ error: 'Sign in required.' });
    return null;
  }
  return email;
}

/** Require admin user. Returns email or sends 403 and returns null. */
export async function requireAdmin(req: any, reply: any): Promise<string | null> {
  const email = await verifyClerkToken(req.headers.authorization);
  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
    reply.status(403).send({ error: 'Admin access required.' });
    return null;
  }
  return email;
}
