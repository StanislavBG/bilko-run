import type { FastifyInstance } from 'fastify';
import { dbRun } from '../../db.js';
import { askGemini } from '../../gemini.js';
import { getActiveSubscriptionLive } from '../../services/stripe.js';
import {
  getTokenBalance, grantFreeTokens, deductToken, hasTokenAccount,
} from '../../services/tokens.js';
import { requireAuth } from '../../clerk.js';
import { validatePublicUrl, fetchPageBounded } from '../../services/page-fetch.js';
import { hashIp, enforceCallLimits, isAdminEmail } from './_shared.js';

export function registerLaunchGraderRoutes(app: FastifyInstance): void {
  // ── Launch Grader ──────────────────────────────────
  app.post('/api/demos/launch-grader', async (req, reply) => {
    const body = req.body as { url?: string; description?: string; email?: string } | null;
    const rawUrl = (body?.url ?? '').trim();
    const description = (body?.description ?? '').trim();
    if (!rawUrl) { reply.status(400); return { error: 'URL is required.' }; }
    if (!description || description.length < 10) { reply.status(400); return { error: 'Describe your product in at least 10 characters.' }; }
    if (description.length > 2000) { reply.status(400); return { error: 'Description must be under 2000 characters.' }; }
    if (rawUrl.length > 2000) { reply.status(400); return { error: 'URL must be under 2000 characters.' }; }

    const email = await requireAuth(req, reply);
    if (!email) return;

    const costLimit = await enforceCallLimits({ userEmail: email, ipHash: hashIp(req.ip), isAdmin: isAdminEmail(email), appSlug: 'launch-grader' });
    if (!costLimit.ok) { reply.status(costLimit.status); return { error: costLimit.reason }; }

    let parsedUrl: URL;
    try { parsedUrl = validatePublicUrl(rawUrl); } catch (err: any) { reply.status(400); return { error: err.message || 'Invalid URL.' }; }

    if (!(await hasTokenAccount(email))) { await grantFreeTokens(email); }
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 1) { reply.status(402); return { error: 'No credits remaining.', requiresTokens: true, balance }; }
    }

    let pageText: string;
    try { pageText = await fetchPageBounded(parsedUrl); } catch (err: any) { reply.status(400); return { error: `Could not fetch page: ${err.message}` }; }
    if (pageText.length < 50) { reply.status(400); return { error: 'Page has too little content to audit.' }; }

    const systemPrompt = `You are a brutally honest SaaS launch advisor. You audit products for launch readiness using 5 proven frameworks.

PRODUCT DESCRIPTION: ${description}

SCORING SYSTEM (total 100 points):

**1. Value Proposition Clarity (25 pts)**
- Can a visitor understand what this does in 5 seconds? (0-8)
- Is the target audience explicitly stated? (0-7)
- Is differentiation from alternatives clear? (0-5)
- Is there a compelling "why now?" urgency? (0-5)

**2. Pricing & Monetization (20 pts)**
- Is pricing visible and clear? (0-7)
- Does the pricing model match value delivery? (0-5)
- Is there a free tier or trial? (0-4)
- Are there clear upgrade triggers? (0-4)

**3. Social Proof & Trust (20 pts)**
- Testimonials, case studies, or user counts? (0-7)
- Real person/team visible behind the product? (0-5)
- Trust signals (security, integrations, press)? (0-4)
- Active community or social presence? (0-4)

**4. Onboarding & First Value (20 pts)**
- Clear CTA to get started? (0-7)
- Can user reach "first value" quickly? (0-5)
- Low signup friction? (0-4)
- Guidance/onboarding visible? (0-4)

**5. Competitive Positioning (15 pts)**
- Implicit or explicit competitor comparison? (0-5)
- Clear category ownership? (0-5)
- Moat or unfair advantage communicated? (0-5)

GRADING: 90-100: A+ | 85-89: A | 80-84: A- | 75-79: B+ | 70-74: B | 65-69: B- | 60-64: C+ | 55-59: C | 50-54: C- | 40-49: D | 0-39: F

Respond ONLY with valid JSON:
{
  "total_score": <0-100>,
  "grade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
  "section_scores": {
    "value_prop": { "score": <0-25>, "max": 25, "feedback": "<2 sentences>" },
    "pricing": { "score": <0-20>, "max": 20, "feedback": "<2 sentences>" },
    "social_proof": { "score": <0-20>, "max": 20, "feedback": "<2 sentences>" },
    "onboarding": { "score": <0-20>, "max": 20, "feedback": "<2 sentences>" },
    "positioning": { "score": <0-15>, "max": 15, "feedback": "<2 sentences>" }
  },
  "launch_blockers": ["<blocker 1>", "<blocker 2>", "<blocker 3>"],
  "verdict": "<Ready to launch|Almost there|Not ready — major gaps>",
  "roast": "<One savage sentence about this product's launch readiness>"
}`;

    try {
      const raw = await askGemini(`Audit this product for launch readiness:\n\nURL: ${parsedUrl.toString()}\nDescription: ${description}\n\nPage content:\n${pageText.slice(0, 8000)}`, { systemPrompt });
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Could not parse response.');
        parsed = JSON.parse(m[0]);
      }

      // Save to user_roasts for tracking
      try {
        const domain = parsedUrl.hostname.replace(/^www\./, '');
        await dbRun('INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)', domain, parsed.total_score, parsed.grade, parsed.roast ?? '');
        await dbRun('INSERT INTO user_roasts (email, url, score, grade, roast, result_json) VALUES (?, ?, ?, ?, ?, ?)',
          email, parsedUrl.toString(), parsed.total_score, parsed.grade, parsed.roast ?? '', JSON.stringify(parsed));
      } catch { /* best effort */ }

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 1, 'launch_grader')).balance;
      return { ...parsed, usage: { balance, gated: false } };
    } catch (err: any) {
      console.error('launch_grader', err);
      reply.status(500);
      return { error: `Audit failed: ${err.message}` };
    }
  });

}
