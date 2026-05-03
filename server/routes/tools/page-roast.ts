import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../../db.js';
import { askGemini } from '../../gemini.js';
import { getActiveSubscriptionLive } from '../../services/stripe.js';
import {
  getTokenBalance, grantFreeTokens, deductToken, hasTokenAccount,
} from '../../services/tokens.js';
import { requireAuth } from '../../clerk.js';
import { validatePublicUrl, fetchPageBounded } from '../../services/page-fetch.js';
import { parseResult } from './_shared.js';

export function registerPageRoastRoutes(app: FastifyInstance): void {
  // ── Public stats (for social proof) ─────────────────────────────
  app.get('/api/roasts/stats', async () => {
    const total = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
    const users = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances');
    return { totalRoasts: total?.n ?? 0, totalUsers: users?.n ?? 0 };
  });

  // ── Recent roasts feed (public) ─────────────────────────────────
  app.get('/api/roasts/recent', async () => {
    return dbAll('SELECT url, score, grade, roast, created_at FROM roast_history ORDER BY created_at DESC LIMIT 20');
  });

  // ── User's past roasts (Clerk auth required) ──
  app.get('/api/roasts/mine', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    return dbAll('SELECT id, url, score, grade, roast, created_at FROM user_roasts WHERE email = ? ORDER BY created_at DESC LIMIT 50', email);
  });

  app.get('/api/roasts/mine/:id', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const { id } = req.params as { id: string };
    const row = await dbGet<any>('SELECT * FROM user_roasts WHERE id = ? AND email = ?', parseInt(id, 10), email);
    if (!row) {
      reply.status(404);
      return { error: 'Roast not found.' };
    }
    return { ...row, result: JSON.parse(row.result_json) };
  });

  app.post('/api/demos/page-roast', async (req, reply) => {
    const body = req.body as { url?: string; email?: string } | null;
    const rawUrl = (body?.url ?? '').trim();
    if (!rawUrl) {
      reply.status(400);
      return { error: 'URL is required.' };
    }

    const email = await requireAuth(req, reply);
    if (!email) return;

    let parsedUrl: URL;
    try {
      parsedUrl = validatePublicUrl(rawUrl);
    } catch (err: any) {
      reply.status(400);
      return { error: err.message || 'Invalid URL.' };
    }

    // Auto-grant free tokens for new users
    if (!(await hasTokenAccount(email))) {
      await grantFreeTokens(email);
    }

    // Pro subscribers skip token deduction. Free users pay AFTER success — see bottom of handler.
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 1) {
        reply.status(402);
        return { error: 'No tokens remaining.', requiresTokens: true, balance };
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
        await dbRun('INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)', domain, parsed.total_score, parsed.grade, parsed.roast);
        await dbRun('INSERT INTO user_roasts (email, url, score, grade, roast, result_json) VALUES (?, ?, ?, ?, ?, ?)',
          email, parsedUrl.toString(), parsed.total_score, parsed.grade, parsed.roast, JSON.stringify(parsed),
        );
      } catch { /* best effort */ }

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 1, 'page_roast')).balance;
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

    const email = await requireAuth(req, reply);
    if (!email) return;

    // Auto-grant free tokens for new users
    if (!(await hasTokenAccount(email))) {
      await grantFreeTokens(email);
    }

    // A/B compare costs 2 — charge AFTER success.
    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 2) {
        reply.status(402);
        return { error: 'A/B Compare costs 2 credits. Buy credits to unlock.', requiresTokens: true, balance };
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


    try {
      const [rawA, rawB] = await Promise.all([
        askGemini(`Audit this landing page (URL: ${parsedUrlA.toString()}).\n\nPage content:\n${pageTextA}`, {
          systemPrompt: scoringSystemPrompt,
        }),
        askGemini(`Audit this landing page (URL: ${parsedUrlB.toString()}).\n\nPage content:\n${pageTextB}`, {
          systemPrompt: scoringSystemPrompt,
        }),
      ]);

      const scoreA = parseResult(rawA);
      const scoreB = parseResult(rawB);

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

      const compParsed = parseResult(rawComp);
      const comparison = {
        winner: computedWinner,
        margin: computedMargin,
        section_winners: computedSectionWinners,
        analysis: compParsed.analysis ?? '',
        verdict: compParsed.verdict ?? '',
      };

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 2, 'page_roast_compare')).balance;
      return { score_a: scoreA, score_b: scoreB, comparison, usage: { balance, gated: false } };
    } catch (err: any) {
      console.error('page_roast_compare', err);
      reply.status(500);
      return { error: `Comparison failed: ${err.message}` };
    }
  });

}
