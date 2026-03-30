import { verifyToken, createClerkClient } from '@clerk/backend';

let _clerk: ReturnType<typeof createClerkClient> | null = null;

function getClerk() {
  if (!_clerk) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;
    _clerk = createClerkClient({ secretKey });
  }
  return _clerk;
}

/** Verify a Clerk session token and return the user's email, or null if invalid/missing. */
export async function verifyClerkToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null; // Clerk not configured — fall through to email-based auth

  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload?.sub) return null;

    const clerk = getClerk();
    if (!clerk) return null;

    const user = await clerk.users.getUser(payload.sub);
    return user.primaryEmailAddress?.emailAddress ?? null;
  } catch {
    return null;
  }
}
