import type { FastifyInstance } from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PRODUCT_KEYS } from '../../../shared/product-catalog.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg,
  enforceCallLimits, isAdminEmail, entitlementEmail, askGeminiJson, toolErrorReply,
} from './_shared.js';

/**
 * AudienceDecoder is a one-time-purchase product: same gate as freeTierGate, but the rate check
 * honours hasPurchased(PRODUCT_KEYS.AUDIENCEDECODER_REPORT). freeTierGate has no productKey option.
 */
async function audienceDecoderGate(req: FastifyRequest, reply: FastifyReply, calls = 1) {
  const ipHash = hashIp(req.ip);
  const email = await entitlementEmail(req);
  const rate = await checkRateLimit(ipHash, 'audience-decoder', email, PRODUCT_KEYS.AUDIENCEDECODER_REPORT);
  if (!rate.allowed) {
    reply.status(429).send({
      gated: true,
      isPro: rate.isPro,
      remaining: 0,
      limit: rate.limit,
      message: rate.isPro ? paidGateMsg(rate.limit) : freeGateMsg(),
    });
    return null;
  }
  const costLimit = await enforceCallLimits(
    { userEmail: email ?? null, ipHash, isAdmin: email ? isAdminEmail(email) : false, appSlug: 'audience-decoder' },
    calls,
  );
  if (!costLimit.ok) {
    reply.status(costLimit.status).send({ error: costLimit.reason });
    return null;
  }
  return { ipHash, rate };
}

export function registerAudienceDecoderRoutes(app: FastifyInstance): void {
  app.post('/api/demos/audience-decoder', async (req, reply) => {
    const body = req.body as { content?: string } | null;
    const content = (body?.content ?? '').trim();
    if (!content || content.length < 50) {
      reply.status(400);
      return { error: 'Content must be at least 50 characters. Paste 10-20 posts.' };
    }
    if (content.length > 15000) {
      reply.status(400);
      return { error: 'Content must be under 15000 characters.' };
    }

    const gate = await audienceDecoderGate(req, reply);
    if (!gate) return;

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
      const parsed = await askGeminiJson(`Analyze this creator's content portfolio:\n\n${content}`, { systemPrompt });

      const newCount = await incrementUsage(gate.ipHash, 'audience-decoder');
      const remaining = Math.max(0, gate.rate.limit - newCount);
      return { ...parsed, usage: { remaining, limit: gate.rate.limit, isPro: gate.rate.isPro, gated: false } };
    } catch (err) {
      return toolErrorReply(reply, err, 'audience_decoder_demo');
    }
  });

  app.post('/api/demos/audience-decoder/compare', async (req, reply) => {
    const body = req.body as { content_a?: string; content_b?: string } | null;
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

    const gate = await audienceDecoderGate(req, reply, 3);
    if (!gate) return;

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
      const [analysisA, analysisB] = await Promise.all([
        askGeminiJson(`Analyze this creator's content portfolio:\n\n${contentA}`, { systemPrompt: analyzeSystemPrompt }),
        askGeminiJson(`Analyze this creator's content portfolio:\n\n${contentB}`, { systemPrompt: analyzeSystemPrompt }),
      ]);

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

      const comparison = await askGeminiJson(comparisonPrompt, { systemPrompt: compareSystemPrompt });

      const newCount = await incrementUsage(gate.ipHash, 'audience-decoder');
      const remaining = Math.max(0, gate.rate.limit - newCount);
      return {
        analysis_a: analysisA,
        analysis_b: analysisB,
        comparison,
        usage: { remaining, limit: gate.rate.limit, isPro: gate.rate.isPro, gated: false },
      };
    } catch (err) {
      return toolErrorReply(reply, err, 'audience_decoder_compare');
    }
  });
}
