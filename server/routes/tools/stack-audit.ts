import type { FastifyInstance } from 'fastify';
import { dbRun } from '../../db.js';
import { askGemini } from '../../gemini.js';
import { getActiveSubscriptionLive } from '../../services/stripe.js';
import {
  getTokenBalance, grantFreeTokens, deductToken, hasTokenAccount,
} from '../../services/tokens.js';
import { requireAuth } from '../../clerk.js';
import { hashIp, enforceCallLimits, isAdminEmail } from './_shared.js';

export function registerStackAuditRoutes(app: FastifyInstance): void {
  // ── Stack Audit ────────────────────────────────────
  app.post('/api/demos/stack-audit', async (req, reply) => {
    const body = req.body as { tools?: string; teamSize?: number; email?: string } | null;
    const tools = (body?.tools ?? '').trim();
    if (!tools || tools.length < 10) { reply.status(400); return { error: 'List your tools (at least 10 characters).' }; }
    if (tools.length > 5000) { reply.status(400); return { error: 'Input must be under 5000 characters.' }; }

    const email = await requireAuth(req, reply);
    if (!email) return;

    const costLimit = await enforceCallLimits({ userEmail: email, ipHash: hashIp(req.ip), isAdmin: isAdminEmail(email), appSlug: 'stack-audit' });
    if (!costLimit.ok) { reply.status(costLimit.status); return { error: costLimit.reason }; }

    if (!(await hasTokenAccount(email))) { await grantFreeTokens(email); }
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 1) { reply.status(402); return { error: 'No credits remaining.', requiresTokens: true, balance }; }
    }

    const teamSize = Math.max(1, Math.min(200, Math.floor(Number(body?.teamSize) || 5)));

    const systemPrompt = `You are a SaaS cost optimization expert. Analyze this software stack for a team of ${teamSize} people and identify waste, overlap, and savings opportunities.

SCORING SYSTEM (Stack Efficiency Score, 100 points):

**1. Cost Efficiency (30 pts)**
- Paying market rate or overpaying? (0-10)
- Free alternatives exist for paid tools? (0-10)
- Could downgrade tiers on underused tools? (0-10)

**2. Tool Overlap (25 pts)**
- Any tools with overlapping functionality? (0-10)
- Could fewer tools cover same workflows? (0-8)
- All-in-one alternatives available? (0-7)

**3. Self-Host Potential (20 pts)**
- Viable self-hosted alternatives exist? (0-10)
- Would self-hosting save money at this scale? (0-10)

**4. Stack Complexity (15 pts)**
- Right-sized for team of ${teamSize}? (0-8)
- Integration pain from too many tools? (0-7)

**5. Future Risk (10 pts)**
- Vendor lock-in with high switching costs? (0-5)
- Pricing trends going up for key tools? (0-5)

GRADING: 90-100: A+ | 85-89: A | 80-84: A- | 75-79: B+ | 70-74: B | 65-69: B- | 60-64: C+ | 55-59: C | 50-54: C- | 40-49: D | 0-39: F

For each tool, determine: estimated monthly cost (if not provided), whether to KEEP/SWITCH/CUT, and if SWITCH, name the specific alternative with its price.

Respond ONLY with valid JSON:
{
  "total_score": <0-100>,
  "grade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "monthly_spend": <estimated total monthly $>,
  "annual_spend": <monthly x 12>,
  "potential_savings_monthly": <$ amount>,
  "potential_savings_annual": <$ amount x 12>,
  "section_scores": {
    "cost_efficiency": { "score": <0-30>, "max": 30, "feedback": "<2 sentences>" },
    "overlap": { "score": <0-25>, "max": 25, "feedback": "<2 sentences>" },
    "self_host": { "score": <0-20>, "max": 20, "feedback": "<2 sentences>" },
    "complexity": { "score": <0-15>, "max": 15, "feedback": "<2 sentences>" },
    "future_risk": { "score": <0-10>, "max": 10, "feedback": "<2 sentences>" }
  },
  "tools": [
    { "name": "<tool>", "monthly_cost": <$>, "verdict": "<KEEP|SWITCH|CUT>", "reason": "<1 sentence>", "alternative": "<name (free/$X/mo) or null>", "savings": <$/mo or 0> }
  ],
  "top_savings": ["<saving 1>", "<saving 2>", "<saving 3>"],
  "roast": "<One savage sentence about this stack's spending habits>"
}`;

    try {
      const raw = await askGemini(`Audit this SaaS stack for a team of ${teamSize}:\n\n${tools}`, { systemPrompt });
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Could not parse response.');
        parsed = JSON.parse(m[0]);
      }

      try {
        await dbRun('INSERT INTO user_roasts (email, url, score, grade, roast, result_json) VALUES (?, ?, ?, ?, ?, ?)',
          email, 'stack-audit', parsed.total_score, parsed.grade, parsed.roast ?? '', JSON.stringify(parsed));
      } catch { /* best effort */ }

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 1, 'stack_audit')).balance;
      return { ...parsed, usage: { balance, gated: false } };
    } catch (err: any) {
      console.error('stack_audit', err);
      reply.status(500);
      return { error: `Audit failed: ${err.message}` };
    }
  });

}
