import type { FastifyInstance } from 'fastify';
import { askGemini } from '../../gemini.js';
import { hasPurchased } from '../../services/stripe.js';
import { PRODUCT_KEYS } from '../../../shared/product-catalog.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg, parseResult,
  enforceCallLimits, isAdminEmail,
} from './_shared.js';
import { verifyClerkToken } from '../../clerk.js';

export function registerAudienceDecoderRoutes(app: FastifyInstance): void {
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
    const _adRate = await checkRateLimit(_adIpHash, 'audience-decoder', _adEmail, PRODUCT_KEYS.AUDIENCEDECODER_REPORT);
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
    const _adVerifiedEmail = await verifyClerkToken(req.headers.authorization);
    const _adCostLimit = await enforceCallLimits({ userEmail: _adVerifiedEmail, ipHash: _adIpHash, isAdmin: _adVerifiedEmail ? isAdminEmail(_adVerifiedEmail) : false, appSlug: 'audience-decoder' });
    if (!_adCostLimit.ok) { reply.status(_adCostLimit.status); return { error: _adCostLimit.reason }; }

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

      const _adNewCount = await incrementUsage(_adIpHash, 'audience-decoder');
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
    const adcRate = await checkRateLimit(adcIpHash, 'audience-decoder', adcEmail, PRODUCT_KEYS.AUDIENCEDECODER_REPORT);
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
    const adcVerifiedEmail = await verifyClerkToken(req.headers.authorization);
    const adcCostLimit = await enforceCallLimits({ userEmail: adcVerifiedEmail, ipHash: adcIpHash, isAdmin: adcVerifiedEmail ? isAdminEmail(adcVerifiedEmail) : false, appSlug: 'audience-decoder' });
    if (!adcCostLimit.ok) { reply.status(adcCostLimit.status); return { error: adcCostLimit.reason }; }

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

      const adcNewCount = await incrementUsage(adcIpHash, 'audience-decoder');
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
