import type { FastifyInstance } from 'fastify';
import {
  getTokenBalance, grantFreeTokens, hasTokenAccount,
} from '../../services/tokens.js';
import { requireAuth } from '../../clerk.js';

export function registerTokensRoutes(app: FastifyInstance): void {
  app.get('/api/tokens/balance', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    const account = await hasTokenAccount(email);
    if (!account) {
      await grantFreeTokens(email);
    }
    return { balance: await getTokenBalance(email), hasAccount: true };
  });
}
