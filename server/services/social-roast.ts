import { getDb } from '../db.js';
import { askGemini } from '../gemini.js';
import { validatePublicUrl, fetchPageBounded } from './page-fetch.js';

interface RivalPair {
  id: number;
  name_a: string;
  url_a: string;
  x_handle_a: string | null;
  name_b: string;
  url_b: string;
  x_handle_b: string | null;
  category: string | null;
  location: string | null;
}

interface SocialRoastResult {
  score_a: number;
  score_b: number;
  winner: string;
  roast_a: string;
  roast_b: string;
  tweet: string;
}

export function getRivalPair(id: number): RivalPair | null {
  const db = getDb();
  return db.prepare('SELECT * FROM social_roast_rivals WHERE id = ?').get(id) as RivalPair | null;
}

export function listRivalPairs(): RivalPair[] {
  const db = getDb();
  return db.prepare('SELECT * FROM social_roast_rivals ORDER BY created_at DESC').all() as RivalPair[];
}

export function addRivalPair(pair: Omit<RivalPair, 'id'>): number {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO social_roast_rivals (name_a, url_a, x_handle_a, name_b, url_b, x_handle_b, category, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(pair.name_a, pair.url_a, pair.x_handle_a, pair.name_b, pair.url_b, pair.x_handle_b, pair.category, pair.location);
  return result.lastInsertRowid as number;
}

export async function generateSocialRoast(rivalPairId: number): Promise<{ queueId: number; postText: string }> {
  const pair = getRivalPair(rivalPairId);
  if (!pair) throw new Error(`Rival pair ${rivalPairId} not found`);

  // Fetch both pages
  const urlA = validatePublicUrl(pair.url_a);
  const urlB = validatePublicUrl(pair.url_b);

  let pageTextA: string, pageTextB: string;
  try {
    [pageTextA, pageTextB] = await Promise.all([fetchPageBounded(urlA), fetchPageBounded(urlB)]);
  } catch (err: any) {
    throw new Error(`Could not fetch pages: ${err.message}`);
  }

  // Single Gemini call — economic mode
  const systemPrompt = `You are a witty social media personality who roasts landing pages. You're comparing two rival local businesses' websites.

Rules:
- Max 220 characters for the tweet body (leave room for handles and link)
- Must be funny, playful, and shareable — like a friend teasing, NOT mean-spirited
- Reference specific things from their actual websites (menu items, headlines, photos, layout)
- Pick a winner based on which site actually looks better / converts better
- Keep it PG — this is going on social media
- Roast the WEBSITES, not the businesses themselves
- Make people want to click to see the full roast

Respond ONLY with valid JSON:
{
  "score_a": <0-100>,
  "score_b": <0-100>,
  "winner": "A" | "B" | "tie",
  "roast_a": "<one punchy line about A's website>",
  "roast_b": "<one punchy line about B's website>",
  "tweet": "<the fun comparison tweet — NO handles, NO links, just the roast>"
}`;

  const prompt = `Compare these two rival ${pair.category || 'business'} websites from ${pair.location || 'the area'}:

Business A: ${pair.name_a} (${pair.url_a})
Page content: ${pageTextA.slice(0, 3000)}

Business B: ${pair.name_b} (${pair.url_b})
Page content: ${pageTextB.slice(0, 3000)}`;

  const raw = await askGemini(prompt, { systemPrompt });

  let result: SocialRoastResult;
  try {
    result = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse roast response');
    result = JSON.parse(match[0]);
  }

  // Build the full post text
  const handleA = pair.x_handle_a ? `@${pair.x_handle_a.replace(/^@/, '')}` : pair.name_a;
  const handleB = pair.x_handle_b ? `@${pair.x_handle_b.replace(/^@/, '')}` : pair.name_b;

  const postText = [
    result.tweet,
    '',
    `${pair.name_a} (${result.score_a}/100) vs ${pair.name_b} (${result.score_b}/100)`,
    '',
    `Get your page roasted free: bilko.run/projects/page-roast`,
    '',
    `${handleA} ${handleB}`,
  ].join('\n');

  // Insert into queue
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO social_roast_queue (rival_pair_id, post_text, score_a, score_b, winner, roast_a, roast_b)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(rivalPairId, postText, result.score_a, result.score_b, result.winner, result.roast_a, result.roast_b);

  // Update last_roasted_at
  db.prepare('UPDATE social_roast_rivals SET last_roasted_at = CURRENT_TIMESTAMP WHERE id = ?').run(rivalPairId);

  return { queueId: insert.lastInsertRowid as number, postText };
}

export function listQueue(status?: string) {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT q.*, r.name_a, r.name_b, r.category, r.location FROM social_roast_queue q JOIN social_roast_rivals r ON q.rival_pair_id = r.id WHERE q.status = ? ORDER BY q.created_at DESC').all(status);
  }
  return db.prepare('SELECT q.*, r.name_a, r.name_b, r.category, r.location FROM social_roast_queue q JOIN social_roast_rivals r ON q.rival_pair_id = r.id ORDER BY q.created_at DESC').all();
}

export function approveQueueItem(id: number) {
  const db = getDb();
  db.prepare('UPDATE social_roast_queue SET status = ? WHERE id = ?').run('approved', id);
}

export function rejectQueueItem(id: number) {
  const db = getDb();
  db.prepare('UPDATE social_roast_queue SET status = ? WHERE id = ?').run('rejected', id);
}
