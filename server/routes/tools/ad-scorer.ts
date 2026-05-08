import type { FastifyInstance } from 'fastify';
import { askGemini } from '../../gemini.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg,
  parseResult, handleGenerateEndpoint, enforceCallLimits, isAdminEmail,
} from './_shared.js';
import { verifyClerkToken } from '../../clerk.js';

export function registerAdScorerRoutes(app: FastifyInstance): void {
  // ── Ad Copy Generator (inverse mode) ──────────────────────────
  app.post('/api/demos/ad-scorer/generate', async (req, reply) => {
    const body = req.body as { description?: string; platform?: string; count?: number; email?: string } | null;
    const description = (body?.description ?? '').trim();
    const validPlatforms = ['facebook', 'google', 'linkedin'] as const;
    const platform = validPlatforms.includes(body?.platform as any) ? body!.platform! : 'facebook';
    const count = Math.min(Math.max(body?.count ?? 3, 2), 5);

    const platformLimits: Record<string, string> = {
      facebook: 'Primary text: 125 chars, Headline: 40 chars, Description: 30 chars',
      google: 'Headline: 30 chars x3, Description: 90 chars x2',
      linkedin: 'Intro text: 150 chars, Headline: 70 chars',
    };

    const systemPrompt = `You are an expert performance marketer. Generate ${count} high-converting ad copy variants for ${platform}.

PLATFORM CONSTRAINTS: ${platformLimits[platform] ?? platformLimits.facebook}

Each ad should score 80+ on: Hook Strength, Value Proposition, Emotional Architecture, CTA & Conversion.

Use diverse approaches: pain-point lead, benefit-first, social proof, curiosity, urgency.

Respond ONLY with valid JSON:
{
  "ads": [
    { "primary_text": "<main ad copy>", "headline": "<ad headline>", "cta": "<call to action text>", "predicted_score": <75-95>, "approach": "<technique used>" }
  ],
  "strategy_note": "<1 sentence: what makes these ads work for this product on ${platform}>"
}`;

    return handleGenerateEndpoint(req, reply, {
      endpoint: 'ad-scorer',
      inputField: 'product',
      inputText: description,
      bodyEmail: body?.email,
      systemPrompt,
      userPrompt: `Generate ${count} ${platform} ad variants for:\n\n${description}`,
      logTag: 'ad_generator',
    });
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
    const _asVerifiedEmail = await verifyClerkToken(req.headers.authorization);
    const _asLimit = await enforceCallLimits({ userEmail: _asVerifiedEmail, ipHash: _asIpHash, isAdmin: _asVerifiedEmail ? isAdminEmail(_asVerifiedEmail) : false, appSlug: 'ad-scorer' });
    if (!_asLimit.ok) { reply.status(_asLimit.status); return { error: _asLimit.reason }; }

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

      const _asNewCount = await incrementUsage(_asIpHash, 'ad-scorer');
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
    const ascVerifiedEmail = await verifyClerkToken(req.headers.authorization);
    const ascLimit = await enforceCallLimits({ userEmail: ascVerifiedEmail, ipHash: ascIpHash, isAdmin: ascVerifiedEmail ? isAdminEmail(ascVerifiedEmail) : false, appSlug: 'ad-scorer' });
    if (!ascLimit.ok) { reply.status(ascLimit.status); return { error: ascLimit.reason }; }

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


    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Score this ${platform} ad copy:\n\n"${adCopyA}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Score this ${platform} ad copy:\n\n"${adCopyB}"`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseResult(rawA);
      const scoreB = parseResult(rawB);

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

      const compParsed = parseResult(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        pillar_winners: computedPillarWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
        strategic_analysis: compParsed.strategic_analysis ?? '',
      };

      const ascNewCount = await incrementUsage(ascIpHash, 'ad-scorer');
      const ascRemaining = Math.max(0, ascRate.limit - ascNewCount);
      return { adCopyA: scoreA, adCopyB: scoreB, comparison, usage: { remaining: ascRemaining, limit: ascRate.limit, isPro: ascRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('ad_scorer_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

}
