import { dbGet, dbAll, dbRun } from '../db.js';
import { askGemini } from '../gemini.js';
import { validatePublicUrl, fetchPageBounded } from './page-fetch.js';
import { parseJsonResponse } from '../utils.js';

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
  hashtags?: string[];
}

export async function getRivalPair(id: number): Promise<RivalPair | null> {
  const row = await dbGet<RivalPair>('SELECT * FROM social_roast_rivals WHERE id = ?', id);
  return row ?? null;
}

export async function listRivalPairs(): Promise<RivalPair[]> {
  return dbAll<RivalPair>('SELECT * FROM social_roast_rivals ORDER BY created_at DESC');
}

export async function addRivalPair(pair: Omit<RivalPair, 'id'>): Promise<number> {
  const result = await dbRun(
    `INSERT INTO social_roast_rivals (name_a, url_a, x_handle_a, name_b, url_b, x_handle_b, category, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    pair.name_a, pair.url_a, pair.x_handle_a, pair.name_b, pair.url_b, pair.x_handle_b, pair.category, pair.location,
  );
  return result.lastInsertRowid;
}

export async function generateSocialRoast(rivalPairId: number): Promise<{ queueId: number; postText: string }> {
  const pair = await getRivalPair(rivalPairId);
  if (!pair) throw new Error(`Rival pair ${rivalPairId} not found`);

  const urlA = validatePublicUrl(pair.url_a);
  const urlB = validatePublicUrl(pair.url_b);

  let pageTextA: string, pageTextB: string;
  try {
    [pageTextA, pageTextB] = await Promise.all([fetchPageBounded(urlA), fetchPageBounded(urlB)]);
  } catch (err: any) {
    throw new Error(`Could not fetch pages: ${err.message}`);
  }

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
  "tweet": "<the fun comparison tweet — NO handles, NO links, NO hashtags, just the roast>",
  "hashtags": ["<2-3 relevant hashtags — location-based like #Woodinville or #WoodinvilleWine, plus one category like #WineryLife or #CraftBeer — lowercase, no # prefix>"]
}`;

  const prompt = `Compare these two rival ${pair.category || 'business'} websites from ${pair.location || 'the area'}:

Business A: ${pair.name_a} (${pair.url_a})
Page content: ${pageTextA.slice(0, 3000)}

Business B: ${pair.name_b} (${pair.url_b})
Page content: ${pageTextB.slice(0, 3000)}`;

  const raw = await askGemini(prompt, { systemPrompt });

  const result: SocialRoastResult = parseJsonResponse(raw);

  const handleA = pair.x_handle_a ? `@${pair.x_handle_a.replace(/^@/, '')}` : pair.name_a;
  const handleB = pair.x_handle_b ? `@${pair.x_handle_b.replace(/^@/, '')}` : pair.name_b;

  const aiTags: string[] = Array.isArray(result.hashtags) ? result.hashtags : [];
  const tags = aiTags.map(t => `#${t.replace(/^#/, '')}`);
  if (pair.location && !tags.some(t => t.toLowerCase().includes(pair.location!.split(',')[0].trim().toLowerCase().replace(/\s+/g, '')))) {
    tags.unshift(`#${pair.location.split(',')[0].trim().replace(/\s+/g, '')}`);
  }
  const hashtagLine = tags.slice(0, 4).join(' ');

  const postText = [
    result.tweet, '',
    `${pair.name_a} (${result.score_a}/100) vs ${pair.name_b} (${result.score_b}/100)`, '',
    `🔥 Get your page roasted free: https://bilko.run/projects/page-roast`, '',
    `${handleA} ${handleB}`,
    hashtagLine,
  ].join('\n');

  const insert = await dbRun(
    `INSERT INTO social_roast_queue (rival_pair_id, post_text, score_a, score_b, winner, roast_a, roast_b) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    rivalPairId, postText, result.score_a, result.score_b, result.winner, result.roast_a, result.roast_b,
  );
  await dbRun('UPDATE social_roast_rivals SET last_roasted_at = CURRENT_TIMESTAMP WHERE id = ?', rivalPairId);

  return { queueId: insert.lastInsertRowid, postText };
}

export async function listQueue(status?: string) {
  if (status) {
    return dbAll('SELECT q.*, r.name_a, r.name_b, r.category, r.location FROM social_roast_queue q JOIN social_roast_rivals r ON q.rival_pair_id = r.id WHERE q.status = ? ORDER BY q.created_at DESC', status);
  }
  return dbAll('SELECT q.*, r.name_a, r.name_b, r.category, r.location FROM social_roast_queue q JOIN social_roast_rivals r ON q.rival_pair_id = r.id ORDER BY q.created_at DESC');
}

export async function updateQueueStatus(id: number, status: 'approved' | 'rejected' | 'posted') {
  await dbRun('UPDATE social_roast_queue SET status = ? WHERE id = ?', status, id);
}
