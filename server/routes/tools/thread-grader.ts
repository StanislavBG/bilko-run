import type { FastifyInstance } from 'fastify';
import { askGemini } from '../../gemini.js';
import {
  hashIp, checkRateLimit, incrementUsage, paidGateMsg, freeGateMsg,
  parseResult, handleGenerateEndpoint,
} from './_shared.js';

export function registerThreadGraderRoutes(app: FastifyInstance): void {
  // ── Thread Generator (inverse mode) ───────────────────────────
  app.post('/api/demos/thread-grader/generate', async (req, reply) => {
    const body = req.body as { topic?: string; tweetCount?: number; email?: string } | null;
    const topic = (body?.topic ?? '').trim();
    const tweetCount = Math.min(Math.max(body?.tweetCount ?? 7, 3), 15);

    const systemPrompt = `You are a viral X/Twitter thread writer. Generate a ${tweetCount}-tweet thread on the given topic.

RULES FOR VIRAL THREADS:
- Tweet 1 (Hook): Must stop the scroll. Use a bold claim, surprising stat, or curiosity gap. This tweet determines if anyone reads the rest.
- Middle tweets: Build tension. Each tweet should make the reader NEED the next one.
- Final tweet: Strong payoff + CTA (follow, bookmark, share).
- Each tweet: Max 280 chars. No hashtags (algorithm doesn't boost them). No external links (kills reach).
- Reply = 27x a like. Write tweets that provoke replies.
- Bookmark = 5x a like. Include a "save this" moment.

Respond ONLY with valid JSON:
{
  "thread": [
    { "position": 1, "text": "<tweet text under 280 chars>", "purpose": "<hook|tension|payoff|cta>" }
  ],
  "hook_technique": "<technique used for tweet 1>",
  "predicted_viral_score": <60-95>,
  "strategy_note": "<1 sentence: why this thread structure works>"
}`;

    return handleGenerateEndpoint(req, reply, {
      endpoint: 'thread-grader',
      inputField: 'topic',
      inputText: topic,
      bodyEmail: body?.email,
      systemPrompt,
      userPrompt: `Write a ${tweetCount}-tweet viral thread about:\n\n${topic}`,
      logTag: 'thread_generator',
    });
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

      const _tgNewCount = await incrementUsage(_tgIpHash, 'thread-grader');
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


    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Score this X/Twitter thread:\n\n${threadA}`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Score this X/Twitter thread:\n\n${threadB}`, {
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

      const compParsed = parseResult(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        verdict: compParsed.verdict ?? '',
        pillar_winners: computedPillarWinners,
        suggested_hybrid: compParsed.suggested_hybrid ?? '',
        strategic_analysis: compParsed.strategic_analysis ?? '',
      };

      const tgcNewCount = await incrementUsage(tgcIpHash, 'thread-grader');
      const tgcRemaining = Math.max(0, tgcRate.limit - tgcNewCount);
      return { threadA: scoreA, threadB: scoreB, comparison, usage: { remaining: tgcRemaining, limit: tgcRate.limit, isPro: tgcRate.isPro, gated: false } };
    } catch (err: any) {
      console.error('thread_grader_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

}
