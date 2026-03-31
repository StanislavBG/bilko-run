import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { getDb } from '../db.js';
import { askGemini } from '../gemini.js';
import { getActiveSubscriptionLive, hasPurchased } from '../services/stripe.js';
import { getTokenBalance, grantFreeTokens, deductToken, hasTokenAccount } from '../services/tokens.js';
import { verifyClerkToken, requireAuth } from '../clerk.js';
import { validatePublicUrl, fetchPageBounded } from '../services/page-fetch.js';

// ── Usage tracking utilities ──────────────────────────────────────

const FREE_TIER_LIMIT = 3;
// Pro/Business/Team subscribers get effectively unlimited runs. 1_000_000 is large
// enough to never be hit in practice and serialises cleanly to JSON (unlike Infinity).
const PRO_TIER_LIMIT = 1_000_000;
const BUSINESS_TIER_LIMIT = 1_000_000;
const TEAM_TIER_LIMIT = 1_000_000;
const HEADLINE_GRADER_ENDPOINT = 'headline-grader';
const UPGRADE_URL = 'https://bilko.run/pricing';

const TIER_LIMITS: Record<string, number> = {
  free: FREE_TIER_LIMIT,
  pro: PRO_TIER_LIMIT,
  business: BUSINESS_TIER_LIMIT,
  team: TEAM_TIER_LIMIT,
};

function freeGateMsg(_what: string): string {
  return `Free limit reached (${FREE_TIER_LIMIT} per session). Upgrade to Pro for unlimited: ${UPGRADE_URL}`;
}
function paidGateMsg(limit: number): string {
  return `Rate limit reached (${limit}/day). Upgrade for more at bilko.run/pricing. Resets at midnight UTC.`;
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsageCount(ipHash: string, endpoint: string): number {
  const db = getDb();
  const row = db.prepare(
    'SELECT count FROM usage_tracking WHERE ip_hash = ? AND endpoint = ? AND date = ?'
  ).get(ipHash, endpoint, todayUTC()) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementUsage(ipHash: string, endpoint: string): number {
  const db = getDb();
  db.prepare(`
    INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = count + 1
  `).run(ipHash, endpoint, todayUTC());
  return getUsageCount(ipHash, endpoint);
}

function resetUsage(ipHash: string, endpoint: string): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 0) ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = 0'
  ).run(ipHash, endpoint, todayUTC());
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  isPro: boolean;
}

// Checks free vs Pro tier. Pass email from request body when available.
// Pro users (active subscription) get PRO_TIER_LIMIT instead of FREE_TIER_LIMIT.
// AudienceDecoder passes productKey='audiencedecoder_report' to check one-time purchase.
// Verifies subscription status against Stripe API directly (5-min cache) instead of a stale DB flag.
function recordFunnelEvent(event: string, ipHash: string, tool?: string, email?: string): void {
  try {
    const db = getDb();
    db.prepare('INSERT INTO funnel_events (event, ip_hash, tool, email) VALUES (?, ?, ?, ?)').run(event, ipHash, tool ?? null, email ?? null);
  } catch { /* non-critical */ }
}

async function checkRateLimit(ipHash: string, endpoint: string, email?: string, productKey?: string): Promise<RateLimitResult> {
  if (email) {
    // One-time purchases (e.g. AudienceDecoder) get Pro-level limits
    if (productKey && hasPurchased(email, productKey)) {
      const count = getUsageCount(ipHash, endpoint);
      const limit = PRO_TIER_LIMIT;
      if (count >= limit) return { allowed: false, remaining: 0, limit, isPro: true };
      return { allowed: true, remaining: limit - count, limit, isPro: true };
    }
    // Subscription users — resolve their actual tier
    const sub = await getActiveSubscriptionLive(email);
    if (sub.isPro) {
      const limit = TIER_LIMITS[sub.tier] || PRO_TIER_LIMIT;
      const count = getUsageCount(ipHash, endpoint);
      if (count >= limit) return { allowed: false, remaining: 0, limit, isPro: true };
      return { allowed: true, remaining: limit - count, limit, isPro: true };
    }
  }
  const count = getUsageCount(ipHash, endpoint);
  if (count >= FREE_TIER_LIMIT) {
    recordFunnelEvent('free_limit_hit', ipHash, endpoint, email);
    return { allowed: false, remaining: 0, limit: FREE_TIER_LIMIT, isPro: false };
  }
  return { allowed: true, remaining: FREE_TIER_LIMIT - count, limit: FREE_TIER_LIMIT, isPro: false };
}

function parseResult(raw: string): any {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not parse analysis response.');
  return JSON.parse(m[0]);
}

export function registerDemoRoutes(app: FastifyInstance): void {

  // ── Headline Grader ──────────────────────────────────────

  app.post('/api/demos/headline-grader/unlock', async (req, reply) => {
    const body = req.body as { email?: string } | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email address required.' };
    }
    const ipHash = hashIp(req.ip);
    const db = getDb();
    try {
      db.prepare(
        'INSERT OR IGNORE INTO email_captures (email, tool, score, ip_hash, source) VALUES (?, ?, ?, ?, ?)'
      ).run(email, 'headline-grader', '', ipHash, 'headline-grader');
    } catch (_err) {
      // already captured — that's fine, still grant the reset
    }
    resetUsage(ipHash, HEADLINE_GRADER_ENDPOINT);
    return { unlocked: true, remaining: FREE_TIER_LIMIT };
  });

  app.post('/api/demos/headline-grader', async (req, reply) => {
    const body = req.body as { headline?: string; context?: string; email?: string } | null;
    const headline = (body?.headline ?? '').trim();
    const context = (['email', 'ad', 'landing', 'blog', 'social'].includes((body?.context ?? '').toLowerCase())
      ? body!.context!.toLowerCase()
      : 'general') as string;
    if (!headline || headline.length < 3) {
      reply.status(400);
      return { error: 'Headline must be at least 3 characters.' };
    }
    if (headline.length > 500) {
      reply.status(400);
      return { error: 'Headline must be under 500 characters.' };
    }

    const ipHash = hashIp(req.ip);
    const email = (body?.email ?? '').trim().toLowerCase() || undefined;
    const rate = await checkRateLimit(ipHash, HEADLINE_GRADER_ENDPOINT, email);
    if (!rate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: rate.isPro,
        remaining: 0,
        limit: rate.limit,
        message: rate.isPro ? paidGateMsg(rate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const wordCountByContext: Record<string, string> = {
      email: '4–9 words ideal (penalize beyond 12)',
      social: '10–20 words acceptable when curiosity gap is strong',
      landing: '8–18 words acceptable — positioning headlines are legitimately longer',
      ad: '6–12 words ideal',
      blog: '6–14 words ideal (numbered lists get specificity bonus)',
      general: '6–12 words ideal',
    };
    const wordCountGuide = wordCountByContext[context] ?? wordCountByContext['general'];

    const systemPrompt = `You are a world-class direct response copywriting analyst. You evaluate headlines using four proven conversion frameworks.

CONTENT TYPE: ${context}
This headline is a ${context === 'general' ? 'web headline' : context + ' headline'}. Apply context-appropriate standards throughout your evaluation.

SCORING SYSTEM (total 100 points):

**Pillar 1: Masterson's Rule of One + 4 U's (30 points)**
- Single dominant idea — one big promise, not multiple competing claims (scores 0–7.5)
- Urgent: time pressure or implied scarcity (0–7.5)
- Unique: novel angle or differentiated claim (0–7.5)
- Ultra-Specific: concrete numbers, timeframes, named methods (0–7.5)

**Pillar 2: Hormozi's Value Equation (30 points)**
Formula: Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
- Dream Outcome communicated: what is the big prize? (0–10)
- Perceived Likelihood: believable? proof elements present? (0–10)
- Low Time Delay implied: speed of result suggested? (0–5)
- Low Effort/Sacrifice implied: ease suggested? (0–5)

**Pillar 3: Readability & Clarity (20 points)**
- Flesch-Kincaid grade level — target 5th grade or lower (0–10)
- Word count: ${wordCountGuide} (0–5)
- No passive voice, no jargon, no corporate speak (0–5)

**Pillar 4: Proof + Promise + Plan (20 points)**
- Proof element: number, credential, named source, social proof signal (0–7)
  — For landing page or new-product positioning, a clear competitor differentiation claim counts as implicit proof (score up to 5/7 without explicit data)
- Clear promise: specific outcome or benefit stated (0–7)
- Plan hint: method, framework, or "how" implied (0–6)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

CALIBRATION ANCHORS — compare the headline under review against these reference examples:
95+: "I asked 2,347 SaaS founders what killed their first startup — #1 answer shocked me" [data authority + curiosity gap + specific number + single reveal]
88–92: "I analyzed 10,000 landing pages and found that 73% fail the same test — here's the 30-second fix" [strong proof + promise + plan, dream outcome slightly implied]
75–84: "Cut Your AWS Bill by 40% in 30 Days — No Migration Required" [clear value equation, objection handling, lacks social proof]
65–74: "The Headline Grader That Uses Real Conversion Frameworks Instead of Word Counting" [clear differentiator/positioning, no urgency, proof is implicit — valid for landing page H1]
50–64: "7 Ways to Write Better Headlines" [decent structure — number + benefit — but vague and unspecific]
35–49: "Don't Miss Our Sale" [generic cliché, no specifics, no proof, no real promise]
20–30: "Tips for Better Marketing" [zero specifics, zero proof, zero urgency, commodity topic]
10–25: "Some Thoughts on Marketing" [corporate filler, zero hook, zero promise, zero reason to click]

SPECIAL CASE — DIFFERENTIATOR HEADLINES:
If the headline uses the pattern "The [X] that does [Y] instead of [Z]" or "The [X] for [audience] who [pain]", treat it as a valid positioning strategy (not a failure). Score the CLARITY and SPECIFICITY of the differentiation, not the absence of data proof. These headlines belong in the 65–78 range when the comparison is clear and the audience benefit is inferable.

CRITICAL SCORING RULES:
1. USE THE FULL RANGE. Scores below 30 and above 90 MUST exist. If every headline you score lands between 50-80, you are compressing and failing at your job.
2. A headline that hits 3+ calibration anchor criteria at the 88-92 level MUST score 88-92, not 75.
3. A generic headline like "Tips for Better Marketing" MUST score below 35, not 55.
4. Score the headline FIRST against the calibration anchors by finding the closest match, THEN adjust ±5 based on framework analysis. Do NOT score frameworks first and average — that causes compression.
5. The grade letter MUST match the score: 90-100=A+, 85-89=A, 80-84=A-, etc. Never assign a grade that doesn't match.

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "framework_scores": {
    "rule_of_one": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences>" },
    "value_equation": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences>" },
    "readability": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences>" },
    "proof_promise_plan": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences>" }
  },
  "diagnosis": "<One sharp sentence: the single biggest weakness or strength>",
  "rewrites": [
    { "text": "<rewritten headline>", "predicted_score": <number>, "optimized_for": "rule_of_one", "technique": "<specific technique applied, e.g. 'Added number + timeframe'>" },
    { "text": "<rewritten headline>", "predicted_score": <number>, "optimized_for": "value_equation", "technique": "<specific technique applied>" },
    { "text": "<rewritten headline>", "predicted_score": <number>, "optimized_for": "proof_promise_plan", "technique": "<specific technique applied>" }
  ],
  "upgrade_hook": "<One sentence teasing what a full above-the-fold audit would reveal — vary based on what's actually missing: subhead clarity, CTA friction, proof density, or social signal placement>"
}`;

    try {
      const raw = await askGemini(`Grade this headline: "${headline}"`, {
        systemPrompt,
      });

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse scoring response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      const newCount = incrementUsage(ipHash, HEADLINE_GRADER_ENDPOINT);
      const remaining = Math.max(0, rate.limit - newCount);
      return { ...parsed, usage: { remaining, limit: rate.limit, isPro: rate.isPro, gated: false } };
    } catch (err: any) {
      console.error('headline_grader_demo', err);
      reply.status(500);
      return { error: `Scoring failed: ${err.message}` };
    }
  });

  app.post('/api/demos/headline-grader/compare', async (req, reply) => {
    const body = req.body as { headlineA?: string; headlineB?: string; email?: string } | null;
    const headlineA = (body?.headlineA ?? '').trim();
    const headlineB = (body?.headlineB ?? '').trim();
    if (!headlineA || headlineA.length < 3 || !headlineB || headlineB.length < 3) {
      reply.status(400);
      return { error: 'Both headlines must be at least 3 characters.' };
    }
    if (headlineA.length > 500 || headlineB.length > 500) {
      reply.status(400);
      return { error: 'Headlines must be under 500 characters each.' };
    }

    const hgcIpHash = hashIp(req.ip);
    const hgcEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const hgcRate = await checkRateLimit(hgcIpHash, HEADLINE_GRADER_ENDPOINT, hgcEmail);
    if (!hgcRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: hgcRate.isPro,
        remaining: 0,
        limit: hgcRate.limit,
        message: hgcRate.isPro
          ? paidGateMsg(hgcRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const scoringSystemPrompt = `You are a world-class direct response copywriting analyst. You evaluate headlines using four proven conversion frameworks.

SCORING SYSTEM (total 100 points):

**Pillar 1: Masterson's Rule of One + 4 U's (30 points)**
- Single dominant idea — one big promise, not multiple competing claims (scores 0–7.5)
- Urgent: time pressure or implied scarcity (0–7.5)
- Unique: novel angle or differentiated claim (0–7.5)
- Ultra-Specific: concrete numbers, timeframes, named methods (0–7.5)

**Pillar 2: Hormozi's Value Equation (30 points)**
Formula: Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
- Dream Outcome communicated: what is the big prize? (0–10)
- Perceived Likelihood: believable? proof elements present? (0–10)
- Low Time Delay implied: speed of result suggested? (0–5)
- Low Effort/Sacrifice implied: ease suggested? (0–5)

**Pillar 3: Readability & Clarity (20 points)**
- Flesch-Kincaid grade level — target 5th grade or lower (0–10)
- Word count: 6–12 words ideal for web headlines (0–5)
- No passive voice, no jargon, no corporate speak (0–5)

**Pillar 4: Proof + Promise + Plan (20 points)**
- Proof element: number, credential, named source, social proof signal (0–7)
- Clear promise: specific outcome or benefit stated (0–7)
- Plan hint: method, framework, or "how" implied (0–6)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "framework_scores": {
    "rule_of_one": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences>" },
    "value_equation": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences>" },
    "readability": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences>" },
    "proof_promise_plan": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences>" }
  },
  "diagnosis": "<One sharp sentence: the single biggest weakness or strength>"
}`;

    const compareSystemPrompt = `You are a world-class direct response copywriting analyst. You will be given two scored headlines with their framework breakdowns. Your job is to:
1. Write a sharp 2-sentence verdict explaining WHY the winner is stronger — reference the specific framework scores and gaps (e.g. "Headline A's Rule of One score (24/30 vs 12/30) shows a single dominant promise...")
2. Write a suggested hybrid headline that steals the best element from each — be specific about what was borrowed

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "verdict": "<2 sentences citing specific framework score gaps — name the frameworks and numbers>",
  "suggested_hybrid": "<the rewritten headline itself — punchy, direct, no quotes> | <one sentence: what was taken from A and what was taken from B>"
}`;

    function parseScore(raw: string): any {
      try { return JSON.parse(raw); } catch {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse scoring response.');
      return JSON.parse(m[0]);
    }

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Grade this headline: "${headlineA}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Grade this headline: "${headlineB}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseScore(rawA);
      const scoreB = parseScore(rawB);

      // Compute winner/margin/framework_winners deterministically — never trust the model for arithmetic
      const fA = scoreA.framework_scores;
      const fB = scoreB.framework_scores;
      const computedMargin = Math.abs(scoreA.total_score - scoreB.total_score);
      const computedWinner: 'A' | 'B' | 'tie' =
        scoreA.total_score > scoreB.total_score ? 'A' :
        scoreB.total_score > scoreA.total_score ? 'B' : 'tie';
      const fwWin = (a: number, b: number): 'A' | 'B' | 'tie' =>
        a > b ? 'A' : b > a ? 'B' : 'tie';
      const computedFwWinners = {
        rule_of_one: fwWin(fA.rule_of_one.score, fB.rule_of_one.score),
        value_equation: fwWin(fA.value_equation.score, fB.value_equation.score),
        readability: fwWin(fA.readability.score, fB.readability.score),
        proof_promise_plan: fwWin(fA.proof_promise_plan.score, fB.proof_promise_plan.score),
      };

      const comparisonPrompt = `Headline A: "${headlineA}"
Total: ${scoreA.total_score}/100 | Rule of One: ${fA.rule_of_one.score}/30 | Value Equation: ${fA.value_equation.score}/30 | Readability: ${fA.readability.score}/20 | Proof+Promise+Plan: ${fA.proof_promise_plan.score}/20

Headline B: "${headlineB}"
Total: ${scoreB.total_score}/100 | Rule of One: ${fB.rule_of_one.score}/30 | Value Equation: ${fB.value_equation.score}/30 | Readability: ${fB.readability.score}/20 | Proof+Promise+Plan: ${fB.proof_promise_plan.score}/20

Overall winner: Headline ${computedWinner}${computedWinner !== 'tie' ? ` by ${computedMargin} points` : ' (tied)'}
Framework winners: Rule of One → ${computedFwWinners.rule_of_one} | Value Equation → ${computedFwWinners.value_equation} | Readability → ${computedFwWinners.readability} | Proof+Promise+Plan → ${computedFwWinners.proof_promise_plan}

Write the verdict and suggested hybrid.`;

      const rawComp = await askGemini(comparisonPrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const compParsed = parseScore(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        framework_winners: computedFwWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
      };

      const hgcNewCount = incrementUsage(hgcIpHash, HEADLINE_GRADER_ENDPOINT);
      const hgcRemaining = Math.max(0, hgcRate.limit - hgcNewCount);
      return { headlineA: scoreA, headlineB: scoreB, comparison, usage: { remaining: hgcRemaining, limit: hgcRate.limit, isPro: hgcRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('headline_grader_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Page Roast ──────────────────────────────────────

  // ── Recent roasts feed (public) ─────────────────────────────────
  app.get('/api/roasts/recent', async () => {
    const rows = getDb().prepare(
      'SELECT url, score, grade, roast, created_at FROM roast_history ORDER BY created_at DESC LIMIT 20'
    ).all();
    return rows;
  });

  // ── User's past roasts (Clerk auth required) ──
  app.get('/api/roasts/mine', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const rows = getDb().prepare(
      'SELECT id, url, score, grade, roast, created_at FROM user_roasts WHERE email = ? ORDER BY created_at DESC LIMIT 50'
    ).all(email);
    return rows;
  });

  app.get('/api/roasts/mine/:id', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const { id } = req.params as { id: string };
    const row = getDb().prepare(
      'SELECT * FROM user_roasts WHERE id = ? AND email = ?'
    ).get(parseInt(id, 10), email) as any;
    if (!row) {
      reply.status(404);
      return { error: 'Roast not found.' };
    }
    return { ...row, result: JSON.parse(row.result_json) };
  });

  // ── Token balance endpoint ──────────────────────────────────────
  app.get('/api/tokens/balance', async (req, reply) => {
    const email = ((req.query as any)?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      reply.status(400);
      return { error: 'Valid email required.' };
    }
    const account = hasTokenAccount(email);
    if (!account) {
      grantFreeTokens(email);
    }
    return { balance: getTokenBalance(email), hasAccount: true };
  });

  app.post('/api/demos/page-roast', async (req, reply) => {
    const body = req.body as { url?: string; email?: string } | null;
    const rawUrl = (body?.url ?? '').trim();
    if (!rawUrl) {
      reply.status(400);
      return { error: 'URL is required.' };
    }

    // Prefer Clerk-verified email; fall back to body email if no valid token
    const clerkEmail = await verifyClerkToken(req.headers.authorization);
    const bodyEmail = (body?.email ?? '').trim().toLowerCase();
    const email = clerkEmail || bodyEmail;
    if (!email || !email.includes('@')) {
      reply.status(401);
      return { error: 'Sign in required to use PageRoast.', requiresEmail: true };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = validatePublicUrl(rawUrl);
    } catch (err: any) {
      reply.status(400);
      return { error: err.message || 'Invalid URL.' };
    }

    // Auto-grant free tokens for new users
    if (!hasTokenAccount(email)) {
      grantFreeTokens(email);
    }

    // Pro subscribers skip token deduction
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const deduction = deductToken(email, 1, 'page_roast');
      if (!deduction.success) {
        reply.status(402);
        return { error: 'No tokens remaining.', requiresTokens: true, balance: deduction.balance };
      }
    }

    let pageText: string;
    try {
      pageText = await fetchPageBounded(parsedUrl);
    } catch (err: any) {
      reply.status(400);
      return { error: `Could not fetch page: ${err.message}` };
    }

    if (pageText.length < 50) {
      reply.status(400);
      return { error: 'Page has too little text content to audit.' };
    }

    const systemPrompt = `You are a brutally honest landing page conversion expert. You audit pages using four proven CRO frameworks.

SCORING SYSTEM (total 100 points):

**Section 1: Hero Section (25 points)**
- Headline clarity — does it communicate the value prop in under 8 words? (0–8)
- Subheadline — does it expand on the promise with specifics? (0–7)
- CTA visibility — is there a clear, contrasting call-to-action above the fold? (0–5)
- Visual hierarchy — does the eye flow naturally headline → subhead → CTA? (0–5)

**Section 2: Social Proof (25 points)**
- Testimonials present with names/photos/companies? (0–8)
- Trust logos — recognizable brands, press mentions, certifications? (0–7)
- Quantified proof — user counts, revenue numbers, success metrics? (0–5)
- Risk reversal — guarantees, free trials, money-back signals? (0–5)

**Section 3: Clarity & Persuasion (25 points)**
- 5-second test — can a visitor understand what this is and who it's for in 5 seconds? (0–8)
- Benefits over features — does it lead with outcomes, not capabilities? (0–7)
- Readability — short sentences, simple words, scannable formatting? (0–5)
- Objection handling — are common doubts addressed before the CTA? (0–5)

**Section 4: Conversion Architecture (25 points)**
- CTA frequency — multiple CTAs without being pushy? (0–7)
- Friction reduction — minimal form fields, clear next step? (0–7)
- Urgency/scarcity — legitimate time or supply constraints? (0–5)
- Page speed/load signals — bloated content, excessive scripts mentioned? (0–6)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "section_scores": {
    "hero": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "social_proof": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "clarity": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "conversion": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] }
  },
  "roast": "<One savage but constructive sentence roasting the biggest flaw — make it memorable>",
  "top_fixes": [
    "<Highest-impact fix with specific instructions>",
    "<Second-highest fix>",
    "<Third fix>"
  ],
  "competitor_edge": "<One sentence about what a full audit with rewritten copy would unlock>"
}`;

    try {
      const raw = await askGemini(
        `Audit this landing page (URL: ${parsedUrl.toString()}).\n\nPage content:\n${pageText}`,
        { systemPrompt },
      );

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse audit response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      // Save to public wall (anonymized domain only) + user's personal history (full result)
      try {
        const domain = parsedUrl.hostname.replace(/^www\./, '');
        const db = getDb();
        db.prepare('INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)').run(domain, parsed.total_score, parsed.grade, parsed.roast);
        db.prepare('INSERT INTO user_roasts (email, url, score, grade, roast, result_json) VALUES (?, ?, ?, ?, ?, ?)').run(
          email, parsedUrl.toString(), parsed.total_score, parsed.grade, parsed.roast, JSON.stringify(parsed)
        );
      } catch { /* best effort */ }

      const balance = getTokenBalance(email);
      return { ...parsed, usage: { balance, gated: false } };
    } catch (err: any) {
      console.error('page_roast_demo', err);
      reply.status(500);
      return { error: `Roast failed: ${err.message}` };
    }
  });

  app.post('/api/demos/page-roast/compare', async (req, reply) => {
    const body = req.body as { url_a?: string; url_b?: string; email?: string } | null;
    const rawUrlA = (body?.url_a ?? '').trim();
    const rawUrlB = (body?.url_b ?? '').trim();
    if (!rawUrlA || !rawUrlB) {
      reply.status(400);
      return { error: 'Both URLs are required.' };
    }

    // Prefer Clerk-verified email; fall back to body email if no valid token
    const clerkEmail = await verifyClerkToken(req.headers.authorization);
    const bodyEmail = (body?.email ?? '').trim().toLowerCase();
    const email = clerkEmail || bodyEmail;
    if (!email || !email.includes('@')) {
      reply.status(401);
      return { error: 'Sign in required to use PageRoast.', requiresEmail: true };
    }

    // Auto-grant free tokens for new users
    if (!hasTokenAccount(email)) {
      grantFreeTokens(email);
    }

    // A/B compare requires purchased tokens (free grant not enough) — costs 2
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const deduction = deductToken(email, 2, 'page_roast_compare');
      if (!deduction.success) {
        reply.status(402);
        return { error: 'A/B Compare costs 2 credits. Buy credits to unlock.', requiresTokens: true, balance: deduction.balance };
      }
    }

    let parsedUrlA: URL, parsedUrlB: URL;
    try { parsedUrlA = validatePublicUrl(rawUrlA); } catch (e: any) { reply.status(400); return { error: e.message || 'Invalid URL A.' }; }
    try { parsedUrlB = validatePublicUrl(rawUrlB); } catch (e: any) { reply.status(400); return { error: e.message || 'Invalid URL B.' }; }

    let pageTextA: string, pageTextB: string;
    try {
      [pageTextA, pageTextB] = await Promise.all([fetchPageBounded(parsedUrlA), fetchPageBounded(parsedUrlB)]);
    } catch (err: any) {
      reply.status(400);
      return { error: `Could not fetch pages: ${err.message}` };
    }

    if (pageTextA.length < 50) { reply.status(400); return { error: 'Page A has too little text content to audit.' }; }
    if (pageTextB.length < 50) { reply.status(400); return { error: 'Page B has too little text content to audit.' }; }

    const scoringSystemPrompt = `You are a brutally honest landing page conversion expert. You audit pages using four proven CRO frameworks.

SCORING SYSTEM (total 100 points):

**Section 1: Hero Section (25 points)**
- Headline clarity — does it communicate the value prop in under 8 words? (0–8)
- Subheadline — does it expand on the promise with specifics? (0–7)
- CTA visibility — is there a clear, contrasting call-to-action above the fold? (0–5)
- Visual hierarchy — does the eye flow naturally headline → subhead → CTA? (0–5)

**Section 2: Social Proof (25 points)**
- Testimonials present with names/photos/companies? (0–8)
- Trust logos — recognizable brands, press mentions, certifications? (0–7)
- Quantified proof — user counts, revenue numbers, success metrics? (0–5)
- Risk reversal — guarantees, free trials, money-back signals? (0–5)

**Section 3: Clarity & Persuasion (25 points)**
- 5-second test — can a visitor understand what this is and who it's for in 5 seconds? (0–8)
- Benefits over features — does it lead with outcomes, not capabilities? (0–7)
- Readability — short sentences, simple words, scannable formatting? (0–5)
- Objection handling — are common doubts addressed before the CTA? (0–5)

**Section 4: Conversion Architecture (25 points)**
- CTA frequency — multiple CTAs without being pushy? (0–7)
- Friction reduction — minimal form fields, clear next step? (0–7)
- Urgency/scarcity — legitimate time or supply constraints? (0–5)
- Page speed/load signals — bloated content, excessive scripts mentioned? (0–6)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "section_scores": {
    "hero": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "social_proof": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "clarity": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] },
    "conversion": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>", "fixes": ["<specific fix>"] }
  },
  "roast": "<One savage but constructive sentence roasting the biggest flaw — make it memorable>",
  "top_fixes": ["<Highest-impact fix>", "<Second fix>", "<Third fix>"],
  "competitor_edge": "<One sentence about what a full audit would unlock>"
}`;

    const compareSystemPrompt = `You are a world-class landing page conversion expert. You will be given two scored landing pages with their section breakdowns. Your job is to determine which page converts better and why.

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "verdict": "<2-3 sentences citing specific section score gaps — name the sections and numbers, explain WHY the winner converts better>",
  "analysis": "<3-4 sentences of deeper strategic analysis: what each page does well, what the loser could steal from the winner>"
}`;

    function parseScore(raw: string): any {
      try { return JSON.parse(raw); } catch {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse scoring response.');
      return JSON.parse(m[0]);
    }

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Audit this landing page (URL: ${parsedUrlA.toString()}).\n\nPage content:\n${pageTextA}`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Audit this landing page (URL: ${parsedUrlB.toString()}).\n\nPage content:\n${pageTextB}`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseScore(rawA);
      const scoreB = parseScore(rawB);

      const sA = scoreA.section_scores;
      const sB = scoreB.section_scores;
      const computedMargin = Math.abs(scoreA.total_score - scoreB.total_score);
      const computedWinner: 'A' | 'B' | 'tie' =
        scoreA.total_score > scoreB.total_score ? 'A' :
        scoreB.total_score > scoreA.total_score ? 'B' : 'tie';
      const sWin = (a: number, b: number): 'A' | 'B' | 'tie' =>
        a > b ? 'A' : b > a ? 'B' : 'tie';
      const computedSectionWinners = {
        hero: sWin(sA.hero.score, sB.hero.score),
        social_proof: sWin(sA.social_proof.score, sB.social_proof.score),
        clarity: sWin(sA.clarity.score, sB.clarity.score),
        conversion: sWin(sA.conversion.score, sB.conversion.score),
      };

      const comparisonPrompt = `Page A: ${parsedUrlA.toString()}
Total: ${scoreA.total_score}/100 | Hero: ${sA.hero.score}/25 | Social Proof: ${sA.social_proof.score}/25 | Clarity: ${sA.clarity.score}/25 | Conversion: ${sA.conversion.score}/25

Page B: ${parsedUrlB.toString()}
Total: ${scoreB.total_score}/100 | Hero: ${sB.hero.score}/25 | Social Proof: ${sB.social_proof.score}/25 | Clarity: ${sB.clarity.score}/25 | Conversion: ${sB.conversion.score}/25

Overall winner: Page ${computedWinner}${computedWinner !== 'tie' ? ` by ${computedMargin} points` : ' (tied)'}
Section winners: Hero → ${computedSectionWinners.hero} | Social Proof → ${computedSectionWinners.social_proof} | Clarity → ${computedSectionWinners.clarity} | Conversion → ${computedSectionWinners.conversion}

Write the verdict and analysis.`;

      const rawComp = await askGemini(comparisonPrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const compParsed = parseScore(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        section_winners: computedSectionWinners,
        analysis: compParsed.analysis ?? '',
        verdict: compParsed.verdict ?? '',
      };

      const balance = getTokenBalance(email);
      return { score_a: scoreA, score_b: scoreB, comparison, usage: { balance, gated: false } };
    } catch (err: any) {
      console.error('page_roast_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Ad Scorer ──────────────────────────────────────

  app.post('/api/demos/ad-scorer', async (req, reply) => {
    const body = req.body as { adCopy?: string; platform?: string; email?: string } | null;
    const adCopy = (body?.adCopy ?? '').trim();
    const platform = (body?.platform ?? 'facebook').toLowerCase();
    if (!adCopy || adCopy.length < 10) {
      reply.status(400);
      return { error: 'Ad copy must be at least 10 characters.' };
    }
    if (adCopy.length > 2000) {
      reply.status(400);
      return { error: 'Ad copy must be under 2000 characters.' };
    }

    const _asIpHash = hashIp(req.ip);
    const _asEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const _asRate = await checkRateLimit(_asIpHash, 'ad-scorer', _asEmail);
    if (!_asRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: _asRate.isPro,
        remaining: 0,
        limit: _asRate.limit,
        message: _asRate.isPro ? paidGateMsg(_asRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const systemPrompt = `You are a world-class performance ad copywriting analyst. You evaluate ad copy for paid platforms (Facebook, Google, LinkedIn) using proven direct response frameworks.

SCORING SYSTEM (total 100 points):

**Pillar 1: Hook Strength (25 points)**
- Pattern interrupt — does the opening line break the scroll? (0–8)
- Curiosity gap — does it create an open loop the reader must close? (0–7)
- Audience callout — does it immediately qualify who this is for? (0–5)
- First-line readability — under 12 words, punchy, no jargon? (0–5)

**Pillar 2: Value Proposition (25 points)**
- Specificity — concrete numbers, timeframes, outcomes vs vague promises? (0–8)
- Hormozi Value Equation — dream outcome high, perceived likelihood high, time delay low, effort/sacrifice low? (0–7)
- Differentiation — what makes this different from every other ad? (0–5)
- Proof element — testimonial, case study, credential, or social proof embedded? (0–5)

**Pillar 3: Emotional Architecture (25 points)**
- Pain/desire identification — does it name a specific pain or desire the reader recognizes? (0–8)
- Story element — micro-narrative, transformation arc, or before/after? (0–7)
- Tone match — does the voice match the target audience (formal for B2B, casual for D2C, etc)? (0–5)
- Objection handling — does it preempt the top reason someone would scroll past? (0–5)

**Pillar 4: CTA & Conversion (25 points)**
- CTA clarity — one clear action, no ambiguity about what happens next? (0–8)
- Urgency/scarcity — legitimate reason to act now? (0–7)
- Risk reversal — free trial, guarantee, or low-commitment entry point? (0–5)
- Platform compliance — no flagged terms, follows ${platform} ad policies? (0–5)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "pillar_scores": {
    "hook": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "value_prop": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "emotional": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "cta_conversion": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" }
  },
  "verdict": "<One sharp sentence: the single biggest weakness or strength>",
  "rewrites": [
    { "text": "<rewritten ad copy — full replacement, not just the hook>", "predicted_score": <number>, "optimized_for": "hook" },
    { "text": "<rewritten ad copy>", "predicted_score": <number>, "optimized_for": "value_prop" },
    { "text": "<rewritten ad copy>", "predicted_score": <number>, "optimized_for": "emotional" }
  ],
  "upgrade_hook": "<One sentence teasing what a full ad creative audit (copy + visuals + targeting) would reveal>"
}`;

    try {
      const raw = await askGemini(
        `Score this ${platform} ad copy:\n\n"${adCopy}"`,
        {
          systemPrompt,
        },
      );

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse scoring response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      const _asNewCount = incrementUsage(_asIpHash, 'ad-scorer');
      const _asRemaining = Math.max(0, _asRate.limit - _asNewCount);
      return { ...parsed, usage: { remaining: _asRemaining, limit: _asRate.limit, isPro: _asRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('ad_scorer_demo', err);
      reply.status(500);
      return { error: `Scoring failed: ${err.message}` };
    }
  });

  app.post('/api/demos/ad-scorer/compare', async (req, reply) => {
    const body = req.body as { adCopyA?: string; adCopyB?: string; platform?: string; email?: string } | null;
    const adCopyA = (body?.adCopyA ?? '').trim();
    const adCopyB = (body?.adCopyB ?? '').trim();
    const platform = (body?.platform ?? 'facebook').toLowerCase();

    if (!adCopyA || adCopyA.length < 10 || !adCopyB || adCopyB.length < 10) {
      reply.status(400);
      return { error: 'Both ad copies must be at least 10 characters.' };
    }
    if (adCopyA.length > 2000 || adCopyB.length > 2000) {
      reply.status(400);
      return { error: 'Ad copies must be under 2000 characters each.' };
    }

    const ascIpHash = hashIp(req.ip);
    const ascEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const ascRate = await checkRateLimit(ascIpHash, 'ad-scorer', ascEmail);
    if (!ascRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: ascRate.isPro,
        remaining: 0,
        limit: ascRate.limit,
        message: ascRate.isPro ? paidGateMsg(ascRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const scoringSystemPrompt = `You are a world-class performance ad copywriting analyst. You evaluate ad copy for paid platforms (Facebook, Google, LinkedIn) using proven direct response frameworks.

SCORING SYSTEM (total 100 points):

**Pillar 1: Hook Strength (25 points)**
- Pattern interrupt — does the opening line break the scroll? (0–8)
- Curiosity gap — does it create an open loop the reader must close? (0–7)
- Audience callout — does it immediately qualify who this is for? (0–5)
- First-line readability — under 12 words, punchy, no jargon? (0–5)

**Pillar 2: Value Proposition (25 points)**
- Specificity — concrete numbers, timeframes, outcomes vs vague promises? (0–8)
- Hormozi Value Equation — dream outcome high, perceived likelihood high, time delay low, effort/sacrifice low? (0–7)
- Differentiation — what makes this different from every other ad? (0–5)
- Proof element — testimonial, case study, credential, or social proof embedded? (0–5)

**Pillar 3: Emotional Architecture (25 points)**
- Pain/desire identification — does it name a specific pain or desire the reader recognizes? (0–8)
- Story element — micro-narrative, transformation arc, or before/after? (0–7)
- Tone match — does the voice match the target audience (formal for B2B, casual for D2C, etc)? (0–5)
- Objection handling — does it preempt the top reason someone would scroll past? (0–5)

**Pillar 4: CTA & Conversion (25 points)**
- CTA clarity — one clear action, no ambiguity about what happens next? (0–8)
- Urgency/scarcity — legitimate reason to act now? (0–7)
- Risk reversal — free trial, guarantee, or low-commitment entry point? (0–5)
- Platform compliance — no flagged terms, follows ${platform} ad policies? (0–5)

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "pillar_scores": {
    "hook": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "value_prop": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "emotional": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "cta_conversion": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" }
  },
  "verdict": "<One sharp sentence: the single biggest weakness or strength>"
}`;

    const compareSystemPrompt = `You are a world-class direct response ad copywriting analyst. You will be given two scored ad copies with their pillar breakdowns. Your job is to:
1. Write a sharp 2-sentence verdict explaining WHY the winner is stronger — reference the specific pillar scores and gaps (e.g. "Copy A's Hook score (22/25 vs 10/25) shows a pattern interrupt that stops the scroll...")
2. Write a suggested hybrid ad copy that steals the best element from each — be specific about what was borrowed from each
3. Write a one-sentence strategic analysis: what this result means for the advertiser's next test

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "verdict": "<2 sentences citing specific pillar score gaps — name the pillars and numbers>",
  "suggested_hybrid": "<full rewritten ad copy combining best elements> | <one sentence: what was taken from A and what was taken from B>",
  "strategic_analysis": "<one sentence tactical recommendation for the next iteration>"
}`;

    function parseScore(raw: string): any {
      try { return JSON.parse(raw); } catch {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse scoring response.');
      return JSON.parse(m[0]);
    }

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Score this ${platform} ad copy:\n\n"${adCopyA}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Score this ${platform} ad copy:\n\n"${adCopyB}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseScore(rawA);
      const scoreB = parseScore(rawB);

      const pA = scoreA.pillar_scores;
      const pB = scoreB.pillar_scores;
      const computedMargin = Math.abs(scoreA.total_score - scoreB.total_score);
      const computedWinner: 'A' | 'B' | 'tie' =
        scoreA.total_score > scoreB.total_score ? 'A' :
        scoreB.total_score > scoreA.total_score ? 'B' : 'tie';
      const pillarWin = (a: number, b: number): 'A' | 'B' | 'tie' =>
        a > b ? 'A' : b > a ? 'B' : 'tie';
      const computedPillarWinners = {
        hook: pillarWin(pA.hook.score, pB.hook.score),
        value_prop: pillarWin(pA.value_prop.score, pB.value_prop.score),
        emotional: pillarWin(pA.emotional.score, pB.emotional.score),
        cta_conversion: pillarWin(pA.cta_conversion.score, pB.cta_conversion.score),
      };

      const comparisonPrompt = `Ad Copy A: "${adCopyA}"
Total: ${scoreA.total_score}/100 | Hook: ${pA.hook.score}/25 | Value Prop: ${pA.value_prop.score}/25 | Emotional: ${pA.emotional.score}/25 | CTA: ${pA.cta_conversion.score}/25

Ad Copy B: "${adCopyB}"
Total: ${scoreB.total_score}/100 | Hook: ${pB.hook.score}/25 | Value Prop: ${pB.value_prop.score}/25 | Emotional: ${pB.emotional.score}/25 | CTA: ${pB.cta_conversion.score}/25

Overall winner: Copy ${computedWinner}${computedWinner !== 'tie' ? ` by ${computedMargin} points` : ' (tied)'}
Pillar winners: Hook → ${computedPillarWinners.hook} | Value Prop → ${computedPillarWinners.value_prop} | Emotional → ${computedPillarWinners.emotional} | CTA → ${computedPillarWinners.cta_conversion}

Write the verdict, suggested hybrid, and strategic analysis.`;

      const rawComp = await askGemini(comparisonPrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const compParsed = parseScore(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        pillar_winners: computedPillarWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
        strategic_analysis: compParsed.strategic_analysis ?? '',
      };

      const ascNewCount = incrementUsage(ascIpHash, 'ad-scorer');
      const ascRemaining = Math.max(0, ascRate.limit - ascNewCount);
      return { adCopyA: scoreA, adCopyB: scoreB, comparison, usage: { remaining: ascRemaining, limit: ascRate.limit, isPro: ascRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('ad_scorer_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Thread Grader ──────────────────────────────────────

  app.post('/api/demos/thread-grader', async (req, reply) => {
    const body = req.body as { threadText?: string; email?: string } | null;
    const threadText = (body?.threadText ?? '').trim();
    if (!threadText || threadText.length < 20) {
      reply.status(400);
      return { error: 'Thread must be at least 20 characters.' };
    }
    if (threadText.length > 5000) {
      reply.status(400);
      return { error: 'Thread must be under 5000 characters.' };
    }

    const _tgIpHash = hashIp(req.ip);
    const _tgEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const _tgRate = await checkRateLimit(_tgIpHash, 'thread-grader', _tgEmail);
    if (!_tgRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: _tgRate.isPro,
        remaining: 0,
        limit: _tgRate.limit,
        message: _tgRate.isPro ? paidGateMsg(_tgRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const systemPrompt = `You are a viral content analyst specializing in X/Twitter threads. Score this thread on 4 pillars:

SCORING SYSTEM (total 100 points):

**Pillar 1: Hook Strength (30 points)**
- Does tweet 1 stop the scroll? Curiosity gap, specificity, controversy, bold claim?
- Does the opening create an open loop that demands resolution?
- Is it specific enough to signal expertise, not generic enough to be ignored?

**Pillar 2: Tension Chain (25 points)**
- Does each tweet pull you to the next? Does the reader NEED to keep reading or can they drop off?
- Is there a logical escalation — setup → complication → revelation?
- Does each tweet end with enough unresolved tension to demand the next?

**Pillar 3: Payoff (25 points)**
- Does the thread deliver real value? Surprise, actionable insight, or earned conclusion?
- Is the payoff proportional to the promise made in tweet 1?
- Will the reader feel their time was well spent?

**Pillar 4: Share Trigger (20 points)**
- Is there a moment worth screenshotting or quoting?
- Quotable line, surprising stat, hot take, or counter-intuitive truth?
- Does it make the reader look smart or insightful if they share it?

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Tweets are separated by "---" or double newlines. Parse each tweet individually.

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "pillar_scores": {
    "hook": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences specific to tweet 1>" },
    "tension": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences on the chain>" },
    "payoff": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences on the conclusion>" },
    "share_trigger": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences on shareability>" }
  },
  "tweet_breakdown": [
    { "tweet_index": <number starting at 1>, "text_preview": "<first 60 chars>", "score": <0-10>, "note": "<one specific observation>" }
  ],
  "rewrites": [
    { "label": "Max curiosity gap", "text": "<rewritten hook tweet that stops the scroll>", "why_better": "<one sentence>" },
    { "label": "Bold claim", "text": "<rewritten hook with a specific bold claim>", "why_better": "<one sentence>" },
    { "label": "Contrast hook", "text": "<rewritten hook using unexpected contrast>", "why_better": "<one sentence>" }
  ],
  "verdict": "<One sharp sentence: the single biggest strength or weakness of this thread>",
  "upgrade_hook": "<One sentence teasing what a full thread strategy audit (structure, timing, CTA, audience) would reveal>"
}`;

    try {
      const raw = await askGemini(
        `Score this X/Twitter thread:\n\n${threadText}`,
        {
          systemPrompt,
        },
      );

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse scoring response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      const _tgNewCount = incrementUsage(_tgIpHash, 'thread-grader');
      const _tgRemaining = Math.max(0, _tgRate.limit - _tgNewCount);
      return { ...parsed, usage: { remaining: _tgRemaining, limit: _tgRate.limit, isPro: _tgRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('thread_grader_demo', err);
      reply.status(500);
      return { error: `Scoring failed: ${err.message}` };
    }
  });

  app.post('/api/demos/thread-grader/compare', async (req, reply) => {
    const body = req.body as { threadA?: string; threadB?: string; email?: string } | null;
    const threadA = (body?.threadA ?? '').trim();
    const threadB = (body?.threadB ?? '').trim();

    if (!threadA || threadA.length < 20 || !threadB || threadB.length < 20) {
      reply.status(400);
      return { error: 'Both threads must be at least 20 characters.' };
    }
    if (threadA.length > 5000 || threadB.length > 5000) {
      reply.status(400);
      return { error: 'Threads must be under 5000 characters each.' };
    }

    const tgcIpHash = hashIp(req.ip);
    const tgcEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const tgcRate = await checkRateLimit(tgcIpHash, 'thread-grader', tgcEmail);
    if (!tgcRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: tgcRate.isPro,
        remaining: 0,
        limit: tgcRate.limit,
        message: tgcRate.isPro ? paidGateMsg(tgcRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const scoringSystemPrompt = `You are a viral content analyst specializing in X/Twitter threads. Score this thread on 4 pillars:

SCORING SYSTEM (total 100 points):

**Pillar 1: Hook Strength (30 points)**
Does tweet 1 stop the scroll? Curiosity gap, specificity, controversy, bold claim?

**Pillar 2: Tension Chain (25 points)**
Does each tweet pull you to the next? Does the reader NEED to keep reading?

**Pillar 3: Payoff (25 points)**
Does the thread deliver real value? Surprise, actionable insight, or earned conclusion?

**Pillar 4: Share Trigger (20 points)**
Is there a moment worth screenshotting or quoting?

GRADING SCALE:
90–100: A+ | 85–89: A | 80–84: A- | 75–79: B+ | 70–74: B | 65–69: B- | 60–64: C+ | 55–59: C | 50–54: C- | 40–49: D | 0–39: F

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "total_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">,
  "pillar_scores": {
    "hook": { "score": <0-30>, "max": 30, "feedback": "<1-2 sentences>" },
    "tension": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "payoff": { "score": <0-25>, "max": 25, "feedback": "<1-2 sentences>" },
    "share_trigger": { "score": <0-20>, "max": 20, "feedback": "<1-2 sentences>" }
  },
  "verdict": "<One sharp sentence: the single biggest strength or weakness>"
}`;

    const compareSystemPrompt = `You are a viral content analyst specializing in X/Twitter threads. You will be given two scored threads with their pillar breakdowns. Your job is to:
1. Write a sharp 2-sentence verdict explaining WHY the winner is stronger — reference the specific pillar scores and gaps
2. Write a suggested hybrid thread hook that steals the best element from each — be specific about what was borrowed
3. Write a one-sentence strategic analysis: what this result means for the creator's next thread

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "verdict": "<2 sentences citing specific pillar score gaps>",
  "suggested_hybrid": "<rewritten hook tweet combining best elements> | <one sentence: what was taken from A and what was taken from B>",
  "strategic_analysis": "<one sentence tactical recommendation for the next thread>"
}`;

    function parseScore(raw: string): any {
      try { return JSON.parse(raw); } catch {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse scoring response.');
      return JSON.parse(m[0]);
    }

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Score this X/Twitter thread:\n\n${threadA}`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Score this X/Twitter thread:\n\n${threadB}`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseScore(rawA);
      const scoreB = parseScore(rawB);

      const pA = scoreA.pillar_scores;
      const pB = scoreB.pillar_scores;
      const computedMargin = Math.abs(scoreA.total_score - scoreB.total_score);
      const computedWinner: 'A' | 'B' | 'tie' =
        scoreA.total_score > scoreB.total_score ? 'A' :
        scoreB.total_score > scoreA.total_score ? 'B' : 'tie';
      const pillarWin = (a: number, b: number): 'A' | 'B' | 'tie' =>
        a > b ? 'A' : b > a ? 'B' : 'tie';
      const computedPillarWinners = {
        hook: pillarWin(pA.hook.score, pB.hook.score),
        tension: pillarWin(pA.tension.score, pB.tension.score),
        payoff: pillarWin(pA.payoff.score, pB.payoff.score),
        share_trigger: pillarWin(pA.share_trigger.score, pB.share_trigger.score),
      };

      const comparisonPrompt = `Thread A:
${threadA.substring(0, 200)}...
Total: ${scoreA.total_score}/100 | Hook: ${pA.hook.score}/30 | Tension: ${pA.tension.score}/25 | Payoff: ${pA.payoff.score}/25 | Share: ${pA.share_trigger.score}/20

Thread B:
${threadB.substring(0, 200)}...
Total: ${scoreB.total_score}/100 | Hook: ${pB.hook.score}/30 | Tension: ${pB.tension.score}/25 | Payoff: ${pB.payoff.score}/25 | Share: ${pB.share_trigger.score}/20

Overall winner: Thread ${computedWinner}${computedWinner !== 'tie' ? ` by ${computedMargin} points` : ' (tied)'}
Pillar winners: Hook → ${computedPillarWinners.hook} | Tension → ${computedPillarWinners.tension} | Payoff → ${computedPillarWinners.payoff} | Share → ${computedPillarWinners.share_trigger}

Write the verdict, suggested hybrid hook, and strategic analysis.`;

      const rawComp = await askGemini(comparisonPrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const compParsed = parseScore(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        pillar_winners: computedPillarWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
        strategic_analysis: compParsed.strategic_analysis ?? '',
      };

      const tgcNewCount = incrementUsage(tgcIpHash, 'thread-grader');
      const tgcRemaining = Math.max(0, tgcRate.limit - tgcNewCount);
      return { threadA: scoreA, threadB: scoreB, comparison, usage: { remaining: tgcRemaining, limit: tgcRate.limit, isPro: tgcRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('thread_grader_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Email Forge ──────────────────────────────────────

  app.post('/api/demos/email-forge', async (req, reply) => {
    const body = req.body as {
      product?: string;
      audience?: string;
      goal?: string;
      tone?: string;
      email?: string;
    } | null;
    const product = (body?.product ?? '').trim();
    const audience = (body?.audience ?? '').trim();
    const goal = (body?.goal ?? 'cold_outreach').trim();
    const tone = (body?.tone ?? 'professional').trim();

    if (!product || product.length < 10) {
      reply.status(400);
      return { error: 'Product description must be at least 10 characters.' };
    }
    if (!audience || audience.length < 5) {
      reply.status(400);
      return { error: 'Audience must be at least 5 characters.' };
    }

    const _efIpHash = hashIp(req.ip);
    const _efEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const _efRate = await checkRateLimit(_efIpHash, 'email-forge', _efEmail);
    if (!_efRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: _efRate.isPro,
        remaining: 0,
        limit: _efRate.limit,
        message: _efRate.isPro ? paidGateMsg(_efRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const GOAL_LABELS: Record<string, string> = {
      cold_outreach: 'Cold Outreach',
      nurture: 'Nurture Sequence',
      launch: 'Product Launch',
      're-engagement': 'Re-engagement',
    };
    const TONE_LABELS: Record<string, string> = {
      professional: 'Professional',
      casual: 'Casual',
      urgent: 'Urgent',
      storytelling: 'Storytelling',
    };

    const systemPrompt = `You are an elite email copywriter who has studied AIDA, PAS, Hormozi, Cialdini, and narrative frameworks deeply. You write high-converting email sequences for real businesses.

Generate a 5-email sequence. Each email MUST use a DIFFERENT framework from this list:
1. AIDA (Attention-Interest-Desire-Action)
2. PAS (Problem-Agitate-Solve)
3. Hormozi Value Equation (Dream Outcome × Perceived Likelihood / Time Delay × Effort & Sacrifice)
4. Cialdini Reciprocity (give massive free value, then present the offer)
5. Storytelling Arc (Setup → Conflict → Resolution → Call to Action)

The sequence should have logical progression:
- Email 1: Hook — stops the scroll, creates a curiosity gap or bold promise
- Email 2: Trust — proves credibility, shares social proof or insight
- Email 3: Value — presents the core offer with maximum perceived value
- Email 4: Urgency — creates legitimate urgency or scarcity
- Email 5: Final CTA — last chance with scarcity, addresses objections

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "emails": [
    {
      "position": 1,
      "subject_line": "<subject line that gets opened — max 60 chars>",
      "preview_text": "<preview/preheader text — max 90 chars>",
      "body": "<full email body — 100-200 words, formatted with line breaks>",
      "cta": "<call-to-action button text — max 30 chars>",
      "framework_used": "<framework name from the list above>",
      "framework_explanation": "<one sentence: how this framework is applied in this email>",
      "estimated_open_rate": "<percentage range, e.g. '28-35%'>",
      "estimated_click_rate": "<percentage range, e.g. '4-7%'>"
    }
  ],
  "sequence_strategy": "<2-3 sentences: the overall strategy and why this sequence will convert>",
  "overall_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">
}`;

    const userPrompt = `Generate a 5-email sequence for:

Product: ${product}
Target Audience: ${audience}
Goal: ${GOAL_LABELS[goal] ?? goal}
Tone: ${TONE_LABELS[tone] ?? tone}

Make each email feel distinct — different frameworks, different emotional levers, different angles. The sequence should feel like a progression, not five versions of the same pitch.`;

    try {
      const raw = await askGemini(userPrompt, {
        systemPrompt,
      });

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse email sequence response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      const _efNewCount = incrementUsage(_efIpHash, 'email-forge');
      const _efRemaining = Math.max(0, _efRate.limit - _efNewCount);
      return { ...parsed, usage: { remaining: _efRemaining, limit: _efRate.limit, isPro: _efRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('email_forge_demo', err);
      reply.status(500);
      return { error: `Generation failed: ${err.message}` };
    }
  });

  app.post('/api/demos/email-forge/compare', async (req, reply) => {
    const body = req.body as {
      product_a?: string; audience_a?: string; goal_a?: string; tone_a?: string;
      product_b?: string; audience_b?: string; goal_b?: string; tone_b?: string;
      email?: string;
    } | null;

    const productA = (body?.product_a ?? '').trim();
    const audienceA = (body?.audience_a ?? '').trim();
    const goalA = (body?.goal_a ?? 'cold_outreach').trim();
    const toneA = (body?.tone_a ?? 'professional').trim();
    const productB = (body?.product_b ?? '').trim();
    const audienceB = (body?.audience_b ?? '').trim();
    const goalB = (body?.goal_b ?? 'cold_outreach').trim();
    const toneB = (body?.tone_b ?? 'professional').trim();

    if (!productA || productA.length < 10 || !productB || productB.length < 10) {
      reply.status(400);
      return { error: 'Both product descriptions must be at least 10 characters.' };
    }
    if (!audienceA || audienceA.length < 5 || !audienceB || audienceB.length < 5) {
      reply.status(400);
      return { error: 'Both audience fields must be at least 5 characters.' };
    }

    const efcIpHash = hashIp(req.ip);
    const efcEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const efcRate = await checkRateLimit(efcIpHash, 'email-forge', efcEmail);
    if (!efcRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: efcRate.isPro,
        remaining: 0,
        limit: efcRate.limit,
        message: efcRate.isPro ? paidGateMsg(efcRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const systemPrompt = `You are an elite email copywriter who has studied AIDA, PAS, Hormozi, Cialdini, and narrative frameworks deeply. You write high-converting email sequences for real businesses.

Generate a 5-email sequence. Each email MUST use a DIFFERENT framework from this list:
1. AIDA (Attention-Interest-Desire-Action)
2. PAS (Problem-Agitate-Solve)
3. Hormozi Value Equation
4. Cialdini Reciprocity
5. Storytelling Arc

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "emails": [
    {
      "position": 1,
      "subject_line": "<subject line — max 60 chars>",
      "preview_text": "<preview text — max 90 chars>",
      "body": "<full email body — 100-200 words>",
      "cta": "<CTA button text — max 30 chars>",
      "framework_used": "<framework name>",
      "framework_explanation": "<one sentence>",
      "estimated_open_rate": "<percentage range>",
      "estimated_click_rate": "<percentage range>"
    }
  ],
  "sequence_strategy": "<2-3 sentences>",
  "overall_score": <number 0-100>,
  "grade": <"A+"|"A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F">
}`;

    function buildPrompt(product: string, audience: string, goal: string, tone: string): string {
      const GOAL_LABELS: Record<string, string> = {
        cold_outreach: 'Cold Outreach', nurture: 'Nurture Sequence',
        launch: 'Product Launch', 're-engagement': 'Re-engagement',
      };
      const TONE_LABELS: Record<string, string> = {
        professional: 'Professional', casual: 'Casual',
        urgent: 'Urgent', storytelling: 'Storytelling',
      };
      return `Generate a 5-email sequence for:\n\nProduct: ${product}\nTarget Audience: ${audience}\nGoal: ${GOAL_LABELS[goal] ?? goal}\nTone: ${TONE_LABELS[tone] ?? tone}`;
    }

    function parseSeq(raw: string): any {
      try { return JSON.parse(raw); } catch {}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse sequence response.');
      return JSON.parse(m[0]);
    }

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(buildPrompt(productA, audienceA, goalA, toneA), {
          systemPrompt,
        }),
        askGemini(buildPrompt(productB, audienceB, goalB, toneB), {
          systemPrompt,
        }),
      ]);

      const seqA = parseSeq(rawA);
      const seqB = parseSeq(rawB);

      const margin = Math.abs(seqA.overall_score - seqB.overall_score);
      const winner: 'A' | 'B' = seqA.overall_score >= seqB.overall_score ? 'A' : 'B';

      const compareSystemPrompt = `You are an email marketing strategist. Compare two email sequences and provide analysis.

Respond ONLY with valid JSON — no markdown:
{
  "reasoning": "<2-3 sentences on why the winner performs better — reference specific frameworks and subject lines>",
  "per_email_comparison": [
    { "position": 1, "winner": "A", "reason": "<one sentence specific to this email>" },
    { "position": 2, "winner": "B", "reason": "<one sentence>" },
    { "position": 3, "winner": "A", "reason": "<one sentence>" },
    { "position": 4, "winner": "B", "reason": "<one sentence>" },
    { "position": 5, "winner": "A", "reason": "<one sentence>" }
  ]
}`;

      const comparePrompt = `Sequence A (score: ${seqA.overall_score}, grade: ${seqA.grade}):
Product: ${productA.substring(0, 150)}
Strategy: ${seqA.sequence_strategy ?? ''}
Subject lines: ${(seqA.emails ?? []).map((e: any) => `Email ${e.position}: "${e.subject_line}"`).join(' | ')}
Frameworks: ${(seqA.emails ?? []).map((e: any) => `Email ${e.position}: ${e.framework_used}`).join(', ')}

Sequence B (score: ${seqB.overall_score}, grade: ${seqB.grade}):
Product: ${productB.substring(0, 150)}
Strategy: ${seqB.sequence_strategy ?? ''}
Subject lines: ${(seqB.emails ?? []).map((e: any) => `Email ${e.position}: "${e.subject_line}"`).join(' | ')}
Frameworks: ${(seqB.emails ?? []).map((e: any) => `Email ${e.position}: ${e.framework_used}`).join(', ')}

Overall winner: Sequence ${winner} by ${margin} points.`;

      const rawComp = await askGemini(comparePrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const compParsed = parseSeq(rawComp);

      const efcNewCount = incrementUsage(efcIpHash, 'email-forge');
      const efcRemaining = Math.max(0, efcRate.limit - efcNewCount);
      return {
        sequence_a: seqA,
        sequence_b: seqB,
        comparison: {
          winner,
          margin,
          reasoning: compParsed.reasoning ?? '',
          per_email_comparison: compParsed.per_email_comparison ?? [],
        },
        usage: { remaining: efcRemaining, limit: efcRate.limit, isPro: efcRate.isPro, gated: false },
      };
    } catch (err: any) {
      console.error('email_forge_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Email Capture ──────────────────────────────────────

  app.post('/api/demos/email-capture', async (req, reply) => {
    const body = req.body as { email?: string; tool?: string; score?: string } | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    const tool = (body?.tool ?? '').trim();
    const score = String(body?.score ?? '').trim();
    if (!email || !email.includes('@') || !tool) {
      reply.status(400);
      return { error: 'Valid email and tool are required.' };
    }
    try {
      const db = getDb();
      const ipHash = hashIp(req.ip);
      db.prepare(
        'INSERT OR IGNORE INTO email_captures (email, tool, score, ip_hash, source) VALUES (?, ?, ?, ?, ?)'
      ).run(email, tool, score, ipHash, tool);
      return { ok: true };
    } catch (err: any) {
      console.error('email_capture', err);
      reply.status(500);
      return { error: 'Failed to save.' };
    }
  });

  // ── Audience Decoder ──────────────────────────────────────

  app.post('/api/demos/audience-decoder', async (req, reply) => {
    const body = req.body as { content?: string; email?: string } | null;
    const content = (body?.content ?? '').trim();
    if (!content || content.length < 50) {
      reply.status(400);
      return { error: 'Content must be at least 50 characters. Paste 10-20 posts.' };
    }
    if (content.length > 15000) {
      reply.status(400);
      return { error: 'Content must be under 15000 characters.' };
    }

    // AudienceDecoder is a one-time purchase product — check hasPurchased instead of subscription
    const _adIpHash = hashIp(req.ip);
    const _adEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const _adRate = await checkRateLimit(_adIpHash, 'audience-decoder', _adEmail, 'audiencedecoder_report');
    if (!_adRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: _adRate.isPro,
        remaining: 0,
        limit: _adRate.limit,
        message: _adRate.isPro ? paidGateMsg(_adRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const systemPrompt = `You are an audience intelligence analyst. Analyze the creator's content portfolio and return a JSON object.

Identify:
1. Audience archetypes — who reads this content (2-4 distinct segments, with percentages totaling 100, real evidence from the text)
2. Content patterns — what works vs what doesn't, the optimal format and length, voice analysis
3. Engagement model — hook effectiveness, CTA effectiveness, controversy index, shareability
4. Growth opportunities — 3-5 specific, ranked opportunities with impact/effort ratings
5. Content calendar — weekly mix recommendation, theme rotation, gaps to fill
6. Overall score (0-100) and letter grade (A-F scale)
7. A memorable, shareable headline — like a personality type result (e.g. "The Aspiration Architect — strong voice, weak CTAs, massive thread potential")

Rules:
- Be specific — cite actual phrases or content excerpts as evidence
- Scores must be differentiated — not everything is 70-80, use the full range
- Grade on A-F scale: 90-100 A, 80-89 B, 70-79 C, 60-69 D, below 60 F
- Growth opportunities must be actionable — not generic advice
- The headline must be memorable and shareable — it IS the viral hook

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "audience_archetypes": [
    { "name": "<archetype name>", "percentage": <number>, "description": "<2 sentences>", "evidence": ["<quote or excerpt from their content>"] }
  ],
  "content_patterns": {
    "top_performing_themes": [{ "theme": "<theme>", "frequency": <number>, "avg_engagement_signal": "high|medium|low" }],
    "underperforming_themes": [{ "theme": "<theme>", "frequency": <number>, "avg_engagement_signal": "high|medium|low" }],
    "optimal_format": "thread|single_post|question|story|list",
    "optimal_length": "short|medium|long",
    "voice_analysis": { "tone": "<describe tone>", "unique_phrases": ["<phrase>"], "brand_words": ["<word>"] }
  },
  "engagement_model": {
    "hook_effectiveness": { "score": <0-100>, "best_hooks": ["<excerpt>"], "worst_hooks": ["<excerpt>"] },
    "cta_effectiveness": { "score": <0-100>, "recommendation": "<specific advice>" },
    "controversy_index": { "score": <0-100>, "note": "<context>" },
    "shareability_score": <0-100>
  },
  "growth_opportunities": [
    { "opportunity": "<specific opportunity>", "impact": "high|medium|low", "effort": "high|medium|low", "explanation": "<why this works for their audience>" }
  ],
  "content_calendar": {
    "weekly_mix": { "threads": <number>, "single_posts": <number>, "questions": <number> },
    "theme_rotation": ["<day: theme>"],
    "gaps_to_fill": ["<content gap>"]
  },
  "overall_score": <0-100>,
  "grade": "<A|B|C|D|F>",
  "headline": "<memorable shareable one-liner about this creator's profile>"
}`;

    try {
      const raw = await askGemini(
        `Analyze this creator's content portfolio:\n\n${content}`,
        {
          systemPrompt,
        },
      );

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse analysis response.');
        parsed = JSON.parse(jsonMatch[0]);
      }

      const _adNewCount = incrementUsage(_adIpHash, 'audience-decoder');
      const _adRemaining = Math.max(0, _adRate.limit - _adNewCount);
      return { ...parsed, usage: { remaining: _adRemaining, limit: _adRate.limit, isPro: _adRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('audience_decoder_demo', err);
      reply.status(500);
      return { error: `Analysis failed: ${err.message}` };
    }
  });

  app.post('/api/demos/audience-decoder/compare', async (req, reply) => {
    const body = req.body as { content_a?: string; content_b?: string; email?: string } | null;
    const contentA = (body?.content_a ?? '').trim();
    const contentB = (body?.content_b ?? '').trim();
    if (!contentA || contentA.length < 50 || !contentB || contentB.length < 50) {
      reply.status(400);
      return { error: 'Both content portfolios must be at least 50 characters.' };
    }
    if (contentA.length > 15000 || contentB.length > 15000) {
      reply.status(400);
      return { error: 'Content must be under 15000 characters each.' };
    }

    const adcIpHash = hashIp(req.ip);
    const adcEmail = (body?.email ?? '').trim().toLowerCase() || undefined;
    const adcRate = await checkRateLimit(adcIpHash, 'audience-decoder', adcEmail, 'audiencedecoder_report');
    if (!adcRate.allowed) {
      reply.status(429);
      return {
        gated: true,
        isPro: adcRate.isPro,
        remaining: 0,
        limit: adcRate.limit,
        message: adcRate.isPro ? paidGateMsg(adcRate.limit) : freeGateMsg('Upgrade for more at bilko.run/pricing'),
      };
    }

    const analyzeSystemPrompt = `You are an audience intelligence analyst. Analyze the creator's content portfolio and return a JSON object.

Identify audience archetypes, content patterns, engagement model, growth opportunities, content calendar, overall score and grade, and a memorable headline.

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "audience_archetypes": [
    { "name": "<archetype>", "percentage": <number>, "description": "<2 sentences>", "evidence": ["<excerpt>"] }
  ],
  "content_patterns": {
    "top_performing_themes": [{ "theme": "<theme>", "frequency": <number>, "avg_engagement_signal": "high|medium|low" }],
    "underperforming_themes": [{ "theme": "<theme>", "frequency": <number>, "avg_engagement_signal": "high|medium|low" }],
    "optimal_format": "thread|single_post|question|story|list",
    "optimal_length": "short|medium|long",
    "voice_analysis": { "tone": "<tone>", "unique_phrases": ["<phrase>"], "brand_words": ["<word>"] }
  },
  "engagement_model": {
    "hook_effectiveness": { "score": <0-100>, "best_hooks": ["<excerpt>"], "worst_hooks": ["<excerpt>"] },
    "cta_effectiveness": { "score": <0-100>, "recommendation": "<advice>" },
    "controversy_index": { "score": <0-100>, "note": "<context>" },
    "shareability_score": <0-100>
  },
  "growth_opportunities": [
    { "opportunity": "<opportunity>", "impact": "high|medium|low", "effort": "high|medium|low", "explanation": "<why>" }
  ],
  "content_calendar": {
    "weekly_mix": { "threads": <number>, "single_posts": <number>, "questions": <number> },
    "theme_rotation": ["<day: theme>"],
    "gaps_to_fill": ["<gap>"]
  },
  "overall_score": <0-100>,
  "grade": "<A|B|C|D|F>",
  "headline": "<memorable shareable one-liner>"
}`;

    const compareSystemPrompt = `You are an audience intelligence analyst. Two creator profiles have been analyzed. Write a comparative analysis.

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "audience_overlap": <0-100 percentage>,
  "differentiation_score": <0-100>,
  "collaboration_potential": "high|medium|low",
  "winner_by_category": {
    "hooks": "A|B|tie",
    "depth": "A|B|tie",
    "shareability": "A|B|tie",
    "consistency": "A|B|tie",
    "audience_clarity": "A|B|tie"
  },
  "strategic_advice": "<2 sentences: what each creator should adopt from the other>"
}`;

    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Analyze this creator's content portfolio:\n\n${contentA}`, {
          systemPrompt: analyzeSystemPrompt,
        }),
        askGemini(`Analyze this creator's content portfolio:\n\n${contentB}`, {
          systemPrompt: analyzeSystemPrompt,
        }),
      ]);

      const analysisA = parseResult(rawA);
      const analysisB = parseResult(rawB);

      const comparisonPrompt = `Creator A: "${analysisA.headline}"
Score: ${analysisA.overall_score}/100 | Grade: ${analysisA.grade}
Top archetype: ${analysisA.audience_archetypes?.[0]?.name ?? 'unknown'}
Hook effectiveness: ${analysisA.engagement_model?.hook_effectiveness?.score ?? '?'}/100
Shareability: ${analysisA.engagement_model?.shareability_score ?? '?'}/100

Creator B: "${analysisB.headline}"
Score: ${analysisB.overall_score}/100 | Grade: ${analysisB.grade}
Top archetype: ${analysisB.audience_archetypes?.[0]?.name ?? 'unknown'}
Hook effectiveness: ${analysisB.engagement_model?.hook_effectiveness?.score ?? '?'}/100
Shareability: ${analysisB.engagement_model?.shareability_score ?? '?'}/100

Compare these two creators and identify collaboration potential, audience overlap, and what each should learn from the other.`;

      const rawComp = await askGemini(comparisonPrompt, {
        systemPrompt: compareSystemPrompt,
      });

      const comparison = parseResult(rawComp);

      const adcNewCount = incrementUsage(adcIpHash, 'audience-decoder');
      const adcRemaining = Math.max(0, adcRate.limit - adcNewCount);
      return {
        analysis_a: analysisA,
        analysis_b: analysisB,
        comparison,
        usage: { remaining: adcRemaining, limit: adcRate.limit, isPro: adcRate.isPro, gated: false },
      };
    } catch (err: any) {
      console.error('audience_decoder_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });
}
