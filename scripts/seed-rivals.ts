/**
 * Seed Woodinville WA rival pairs and generate social roasts.
 * Run: GEMINI_API_KEY=... npx tsx scripts/seed-rivals.ts
 */

import { getDb } from '../server/db.js';
import { addRivalPair, generateSocialRoast, listRivalPairs } from '../server/services/social-roast.js';

const RIVALS = [
  {
    name_a: 'Tinte Cellars',
    url_a: 'https://tintecellars.com',
    x_handle_a: 'tintecellars',
    name_b: 'Sparkman Cellars',
    url_b: 'https://sparkmancellars.com',
    x_handle_b: 'SparkmanCellars',
    category: 'winery',
    location: 'Woodinville, WA',
  },
  {
    name_a: 'Black Raven Brewing',
    url_a: 'https://blackravenbrewing.com',
    x_handle_a: 'blackravenbrew',
    name_b: 'Triplehorn Brewing',
    url_b: 'https://triplehornbrewing.com',
    x_handle_b: 'TriplehornBrew',
    category: 'brewery',
    location: 'Woodinville, WA',
  },
  {
    name_a: 'Woodinville Whiskey Co.',
    url_a: 'https://woodinvillewhiskeyco.com',
    x_handle_a: 'WoodinvilleWhi1',
    name_b: 'Copper Cat Distillery',
    url_b: 'https://www.coppercatdistillery.com',
    x_handle_b: 'CopperCatLLC',
    category: 'distillery',
    location: 'Woodinville, WA',
  },
];

async function main() {
  console.log('Initializing DB...');
  getDb();

  // Check if already seeded
  const existing = listRivalPairs();
  if (existing.length > 0) {
    console.log(`Already have ${existing.length} rival pairs. Skipping seed.`);
  } else {
    console.log('Seeding rival pairs...\n');
    for (const pair of RIVALS) {
      const id = addRivalPair(pair as any);
      console.log(`  Added pair #${id}: ${pair.name_a} vs ${pair.name_b}`);
    }
  }

  // Generate roasts
  const pairs = listRivalPairs();
  for (const pair of pairs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Roasting: ${pair.name_a} vs ${pair.name_b} (${pair.category})`);
    console.log('='.repeat(60));

    try {
      const { queueId, postText } = await generateSocialRoast(pair.id);
      console.log(`\nQueue ID: #${queueId}`);
      console.log('─'.repeat(40));
      console.log(postText);
      console.log('─'.repeat(40));
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  console.log('\nDone! Check /api/social/queue for all drafts.');
}

main().catch(console.error);
