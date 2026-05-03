import type { FastifyInstance } from 'fastify';
import { askGemini } from '../../gemini.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg,
} from './_shared.js';

export function registerEmailForgeRoutes(app: FastifyInstance): void {
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
    if (product.length > 2000) {
      reply.status(400);
      return { error: 'Product description must be under 2000 characters.' };
    }
    if (!audience || audience.length < 5) {
      reply.status(400);
      return { error: 'Audience must be at least 5 characters.' };
    }
    if (audience.length > 500) {
      reply.status(400);
      return { error: 'Audience must be under 500 characters.' };
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

      const _efNewCount = await incrementUsage(_efIpHash, 'email-forge');
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
    if (productA.length > 2000 || productB.length > 2000) {
      reply.status(400);
      return { error: 'Product descriptions must be under 2000 characters each.' };
    }
    if (!audienceA || audienceA.length < 5 || !audienceB || audienceB.length < 5) {
      reply.status(400);
      return { error: 'Both audience fields must be at least 5 characters.' };
    }
    if (audienceA.length > 500 || audienceB.length > 500) {
      reply.status(400);
      return { error: 'Audience fields must be under 500 characters each.' };
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

      const efcNewCount = await incrementUsage(efcIpHash, 'email-forge');
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

}
