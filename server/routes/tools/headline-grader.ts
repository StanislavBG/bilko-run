import type { FastifyInstance } from 'fastify';
import { dbRun } from '../../db.js';
import { askGemini } from '../../gemini.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg,
  parseResult, handleGenerateEndpoint, FREE_TIER_LIMIT, HEADLINE_GRADER_ENDPOINT, resetUsage,
} from './_shared.js';

export function registerHeadlineGraderRoutes(app: FastifyInstance): void {
  // ── Headline Grader ──────────────────────────────────────

  app.post('/api/demos/headline-grader/unlock', async (req, reply) => {
    const body = req.body as { email?: string } | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email address required.' };
    }
    const ipHash = hashIp(req.ip);
    try {
      await dbRun(
        'INSERT OR IGNORE INTO email_captures (email, tool, score, ip_hash, source) VALUES (?, ?, ?, ?, ?)',
        email, 'headline-grader', '', ipHash, 'headline-grader',
      );
    } catch (_err) {
      // already captured — that's fine, still grant the reset
    }
    await resetUsage(ipHash, HEADLINE_GRADER_ENDPOINT);
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

      const newCount = await incrementUsage(ipHash, HEADLINE_GRADER_ENDPOINT);
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


    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Grade this headline: "${headlineA}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Grade this headline: "${headlineB}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseResult(rawA);
      const scoreB = parseResult(rawB);

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

      const compParsed = parseResult(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        framework_winners: computedFwWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
      };

      const hgcNewCount = await incrementUsage(hgcIpHash, HEADLINE_GRADER_ENDPOINT);
      const hgcRemaining = Math.max(0, hgcRate.limit - hgcNewCount);
      return { headlineA: scoreA, headlineB: scoreB, comparison, usage: { remaining: hgcRemaining, limit: hgcRate.limit, isPro: hgcRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('headline_grader_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

  // ── Headline Generator (inverse mode) ──────────────────────────
  app.post('/api/demos/headline-grader/generate', async (req, reply) => {
    const body = req.body as { description?: string; context?: string; count?: number; email?: string } | null;
    const description = (body?.description ?? '').trim();
    const context = body?.context ?? 'landing';
    const count = Math.min(Math.max(body?.count ?? 5, 3), 10);

    const systemPrompt = `You are a world-class direct response copywriter. Generate ${count} high-converting headlines for the given product/page description.

CONTEXT: ${context} headline

Each headline should score 75+ on these frameworks:
- Rule of One: single dominant idea, urgent, unique, ultra-specific
- Hormozi Value Equation: dream outcome × likelihood / time × effort
- Readability: grade-5 level, short, no jargon
- Proof + Promise + Plan: credibility signal + specific benefit + method hint

Generate DIVERSE headlines using different techniques:
1. Number + specific result ("How 2,347 founders...")
2. Curiosity gap ("The one thing your landing page is missing...")
3. Bold claim ("Cut your bounce rate by 40% in 30 seconds")
4. Question hook ("Still wondering why nobody converts?")
5. Before/after contrast ("From 2% to 12% conversion — here's what changed")

Respond ONLY with valid JSON:
{
  "headlines": [
    { "text": "<headline>", "predicted_score": <75-95>, "technique": "<technique used>", "framework_strength": "<which framework this headline excels at>" }
  ],
  "strategy_note": "<1 sentence: what makes these headlines work for this specific product>"
}`;

    return handleGenerateEndpoint(req, reply, {
      endpoint: HEADLINE_GRADER_ENDPOINT,
      inputField: 'product or page',
      inputText: description,
      bodyEmail: body?.email,
      systemPrompt,
      userPrompt: `Generate ${count} high-converting headlines for this:\n\n${description}`,
      logTag: 'headline_generator',
    });
  });
}
