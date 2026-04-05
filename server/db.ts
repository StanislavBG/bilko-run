import { createClient, type Client, type Transaction } from '@libsql/client';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (url) {
      _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    } else {
      // Local dev — file-based SQLite via libsql
      mkdirSync(resolve(__dirname, '../data'), { recursive: true });
      const dbPath = resolve(__dirname, '../data/contentgrade.db');
      _client = createClient({ url: `file:${dbPath}` });
    }
  }
  return _client;
}

// ── Query helpers ───────────────────────────────────────────────────────────

type Executor = { execute(stmt: { sql: string; args: any[] }): Promise<any> };

async function execGet<T>(exec: Executor, sql: string, ...args: unknown[]): Promise<T | undefined> {
  const result = await exec.execute({ sql, args: args as any[] });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as T;
}

async function execAll<T>(exec: Executor, sql: string, ...args: unknown[]): Promise<T[]> {
  const result = await exec.execute({ sql, args: args as any[] });
  return result.rows as unknown as T[];
}

async function execRun(exec: Executor, sql: string, ...args: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
  const result = await exec.execute({ sql, args: args as any[] });
  return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
}

// Global-scoped helpers (use the singleton client)
export const dbGet = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => execGet<T>(getClient(), sql, ...args);
export const dbAll = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => execAll<T>(getClient(), sql, ...args);
export const dbRun = (sql: string, ...args: unknown[]) => execRun(getClient(), sql, ...args);

// Transaction-scoped helpers (use a transaction object)
export const txGet = <T = Record<string, unknown>>(tx: Transaction, sql: string, ...args: unknown[]) => execGet<T>(tx, sql, ...args);
export const txRun = (tx: Transaction, sql: string, ...args: unknown[]) => execRun(tx, sql, ...args);

export async function dbTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await getClient().transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// ── Migration ───────────────────────────────────────────────────────────────

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS usage_tracking (
    id INTEGER PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ip_hash, endpoint, date)
  )`,
  `CREATE TABLE IF NOT EXISTS email_captures (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    tool TEXT NOT NULL,
    score TEXT NOT NULL DEFAULT '',
    ip_hash TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_customers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_one_time_purchases (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT NOT NULL UNIQUE,
    product_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS license_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    product_key TEXT NOT NULL DEFAULT 'contentgrade_pro',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_validated_at DATETIME,
    validation_count INTEGER DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key)`,
  `CREATE INDEX IF NOT EXISTS idx_license_keys_email ON license_keys(email)`,
  `CREATE TABLE IF NOT EXISTS token_balances (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS token_transactions (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_token_balances_email ON token_balances(email)`,
  `CREATE INDEX IF NOT EXISTS idx_token_transactions_email ON token_transactions(email)`,
  `CREATE TABLE IF NOT EXISTS social_roast_rivals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_a TEXT NOT NULL,
    url_a TEXT NOT NULL,
    x_handle_a TEXT,
    name_b TEXT NOT NULL,
    url_b TEXT NOT NULL,
    x_handle_b TEXT,
    category TEXT,
    location TEXT,
    last_roasted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS roast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    roast TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS user_roasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    roast TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_roasts_email ON user_roasts(email)`,
  `CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    country TEXT,
    ua TEXT,
    screen TEXT,
    email TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(date)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path)`,
  `CREATE TABLE IF NOT EXISTS social_roast_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rival_pair_id INTEGER REFERENCES social_roast_rivals(id),
    platform TEXT DEFAULT 'x',
    post_text TEXT NOT NULL,
    score_a INTEGER,
    score_b INTEGER,
    winner TEXT,
    roast_a TEXT,
    roast_b TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_for TEXT,
    posted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'build-log',
    cover_image TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published)`,
  `CREATE TABLE IF NOT EXISTS funnel_events (
    id INTEGER PRIMARY KEY,
    event TEXT NOT NULL,
    ip_hash TEXT,
    tool TEXT,
    email TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON funnel_events(event)`,
  `CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events(created_at)`,
  `CREATE TABLE IF NOT EXISTS referrer_rules (
    host_pattern TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    source_name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    landing_path TEXT,
    exit_path TEXT,
    page_count INTEGER DEFAULT 1,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    source_bucket TEXT,
    referrer_host TEXT,
    country TEXT,
    device TEXT,
    email TEXT,
    converted INTEGER DEFAULT 0,
    purchased INTEGER DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`,
];

const REFERRER_RULES_SEED: ReadonlyArray<[string, string, string]> = [
  // pattern, bucket, source_name
  ['twitter.com', 'social', 'twitter'],
  ['x.com', 'social', 'twitter'],
  ['t.co', 'social', 'twitter'],
  ['linkedin.com', 'social', 'linkedin'],
  ['lnkd.in', 'social', 'linkedin'],
  ['reddit.com', 'social', 'reddit'],
  ['old.reddit.com', 'social', 'reddit'],
  ['news.ycombinator.com', 'social', 'hackernews'],
  ['producthunt.com', 'social', 'producthunt'],
  ['facebook.com', 'social', 'facebook'],
  ['fb.com', 'social', 'facebook'],
  ['instagram.com', 'social', 'instagram'],
  ['google.com', 'organic', 'google'],
  ['bing.com', 'organic', 'bing'],
  ['duckduckgo.com', 'organic', 'duckduckgo'],
  ['github.com', 'referral', 'github'],
  ['bilko.run', 'internal', 'internal'],
];

const SEEDS = [
  ['stripe.com', 62, 'C+', "Stripe's landing page is so comprehensive, it's practically a textbook — and just as exciting to read."],
  ['example.com', 15, 'F', "This page has the conversion power of a 'Please take one' sign at a dentist's office."],
  ['shopify.com', 78, 'B+', "Shopify's page sells the dream of entrepreneurship while burying the pricing like a prenup."],
  ['notion.so', 71, 'B', "Notion's landing page is clean, minimal, and about as urgent as a Sunday afternoon nap."],
  ['linear.app', 85, 'A', "Linear's site is so well-designed it makes you feel bad about your own product before you even sign up."],
  ['vercel.com', 74, 'B', "Vercel's hero section deploys faster than their actual deploys. The rest of the page is still loading."],
] as const;

export async function initDb(): Promise<void> {
  const client = getClient();

  // Run all migrations in a single batch (one network round-trip)
  await client.batch(MIGRATIONS.map(sql => ({ sql, args: [] })), 'write');

  // Additive migrations for existing DBs (safe to re-run)
  for (const sql of [
    'ALTER TABLE page_views ADD COLUMN email TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_source TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_medium TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_campaign TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_term TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_content TEXT',
    'ALTER TABLE page_views ADD COLUMN visitor_id TEXT',
    'ALTER TABLE page_views ADD COLUMN session_id TEXT',
    'ALTER TABLE page_views ADD COLUMN is_new_visitor INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN referrer_host TEXT',
    'ALTER TABLE page_views ADD COLUMN source_bucket TEXT',
    'ALTER TABLE page_views ADD COLUMN device TEXT',
    'ALTER TABLE page_views ADD COLUMN browser TEXT',
    'ALTER TABLE page_views ADD COLUMN os TEXT',
    'ALTER TABLE page_views ADD COLUMN is_bot INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN is_admin INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN created_at_ms INTEGER',
    'CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_source_bucket ON page_views(source_bucket)',
    'ALTER TABLE funnel_events ADD COLUMN session_id TEXT',
    'ALTER TABLE funnel_events ADD COLUMN visitor_id TEXT',
    'ALTER TABLE funnel_events ADD COLUMN path TEXT',
  ]) {
    try { await client.execute(sql); } catch { /* column/index already exists */ }
  }

  // Seed referrer_rules (idempotent)
  for (const [pattern, bucket, source] of REFERRER_RULES_SEED) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO referrer_rules (host_pattern, bucket, source_name) VALUES (?, ?, ?)',
        args: [pattern, bucket, source],
      });
    } catch { /* ignore */ }
  }

  // Seed Wall of Shame with sample roasts (only if empty)
  const count = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
  if (!count || count.n === 0) {
    await client.batch(
      SEEDS.map(([url, score, grade, roast]) => ({
        sql: 'INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)',
        args: [url, score, grade, roast],
      })),
      'write',
    );
  }

  // Seed first blog post
  const blogCount = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM blog_posts');
  if (!blogCount || blogCount.n === 0) {
    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      'how-pageroast-went-from-frustration-to-product',
      'How PageRoast Went From "I Need Feedback" to a Product That Roasts Landing Pages for Fun',
      'The story of building PageRoast — from launching to zero signups, learning CRO the hard way, and turning frustration into a tool that scores landing pages and delivers savage one-liners.',
      `## The launch that went nowhere

I launched my first product to zero signups. The code worked. The design was decent. The product did what it said it would do. But nobody signed up.

The problem wasn't the product. It was the page selling it.

I didn't know that at the time. I thought "clear" meant the same as "clever." I thought one testimonial from a friend counted as social proof. I thought hiding the price tag made me seem premium. I was wrong about all of it.

## Learning CRO the hard way

Over the next few months, I studied conversion rate optimization — not the theory, the actual frameworks that people use to audit landing pages. Joanna Wiebe on conversion copywriting. Peep Laja on evidence-based design. Harry Dry on marketing examples.

The patterns were obvious once I saw them:

- **Hero section**: Can someone understand what you do in 5 seconds? If your headline needs a subheadline to make sense, the headline isn't working.
- **Social proof**: Real testimonials with full names, photos, and company logos. Not "J." from "a company" saying "great product."
- **Clarity**: Benefits over features. "Save 10 hours/week" beats "AI-powered automation."
- **Conversion architecture**: One CTA above the fold. Not three competing buttons asking for different things.

Most landing pages fail at least two of these. Mine failed all four.

## The tool I wished existed

I wanted a tool that would read my actual page — not a template, not a checklist — and tell me specifically what was broken. Something that applied real frameworks, not just word counts or SEO scores.

That tool didn't exist. So I built it.

## How PageRoast works

PageRoast takes any URL, fetches the page content, and sends it through **Gemini 2.0 Flash** with a carefully calibrated scoring system:

- **Hero Section (25 pts)**: Headline clarity, subheadline specificity, CTA visibility, visual hierarchy
- **Social Proof (25 pts)**: Testimonials with names/photos, trust logos, quantified proof, risk reversal
- **Clarity & Persuasion (25 pts)**: 5-second test, benefits vs features, readability, objection handling
- **Conversion Architecture (25 pts)**: CTA clarity, urgency/scarcity, risk reversal, friction reduction

Each section gets scored independently. You get a total out of 100, a letter grade, section-by-section feedback with specific fixes, and — the part people actually share — a savage one-liner roast.

## The roast was an accident

The roast line wasn't in the original plan. I added it as a debugging artifact — a quick summary to validate the AI understood the page. But when I showed the tool to friends, they screenshotted the roast and shared it. Nobody screenshotted the score breakdown.

That's when I realized: **the roast is marketing. The score is the product.**

People come for the entertainment. They stay for the actionable fixes. And they share the one-liner, which brings more people. It's a viral loop that doesn't feel like marketing because it's genuinely funny.

## What I'd do differently

I'd ship sooner. The first version was embarrassing — rough UI, imprecise scoring, roast lines that weren't funny enough. I delayed three weeks polishing. Those three weeks taught me nothing that user feedback didn't teach in three days.

I'd also charge from day one. Free users gave zero feedback. Paid users told me exactly what was wrong.

## What's next

PageRoast is one of 7 tools on [bilko.run](/projects). Each one takes something that used to require a specialist and makes it available in 30 seconds through AI.

- [HeadlineGrader](/projects/headline-grader) scores headlines against 4 proven copywriting frameworks
- [AdScorer](/projects/ad-scorer) grades ad copy for Facebook, Google, and LinkedIn
- [ThreadGrader](/projects/thread-grader) analyzes X/Twitter threads for viral potential
- [EmailForge](/projects/email-forge) generates 5-email sequences using proven persuasion frameworks
- [AudienceDecoder](/projects/audience-decoder) identifies who actually follows you

Try [PageRoast](/projects/page-roast) — your first roast is free. Just don't blame me when the score hurts.

## FAQ

**Is PageRoast actually useful or just a joke?**
Both. The roast line is entertainment. The 4-section breakdown with specific fixes is real CRO analysis. Founders use it to improve their pages, then share the roast for clout.

**How accurate is the scoring?**
It's calibrated against reference examples — a "Tips for Better Marketing" headline scores below 35, while a data-rich headline with proof elements scores 85+. The AI uses the full 0-100 range, not the compressed 50-80 that most AI tools default to.

**What does it cost?**
First roast is free. After that, $1 per credit or $5 for 7. Same credits work across all bilko.run tools. No subscriptions.`,
      'product',
      new Date().toISOString(),
    );
  }

  // Seed StackAudit blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'we-built-stackaudit-because-reddit-told-us-to',
    'We Built StackAudit Because Reddit Told Us To',
    'How a single Reddit thread with 461 upvotes and 283 comments convinced us to build a SaaS cost-cutting tool — and what we learned about research-driven product development.',
    `## The thread that started it all

"The SaaS model is quietly falling apart for small businesses and nobody in tech wants to admit it."

That's the title of a Reddit post on r/Entrepreneur that got 461 upvotes and 283 comments. The post described a 12-person company paying for 23 separate SaaS subscriptions — and the total monthly bill was startling.

But the real gold was in the replies.

## What the comments revealed

One reply said: "We cut nine subscriptions in a single afternoon and nobody noticed." Nine tools. Gone. Zero impact on productivity. That's not optimization — that's waste discovery.

Another founder shared: "We emailed 50 churned customers offering to buy them coffee and talk about why they left." The most common answer? Too many tools, too much overlap, too little clarity on what each one actually did.

A third thread — "Built our SaaS on AWS. Monthly bill: $2,400. Moved to Hetzner. Monthly bill: $180" — showed the same pattern at the infrastructure level. Not a complex migration. Just switching from an enterprise platform to one that matched their actual needs.

## The gap we found

Enterprise stack audit tools exist. Zylo, Zluri, Torii — they cost $10,000-50,000 per year and require IT integration. They're built for companies with 305+ SaaS applications and dedicated procurement teams.

Nobody was serving the 1-20 person team with 15-30 tools who just needed a quick answer: "What am I wasting money on?"

## What we built

[StackAudit](/projects/stack-audit) lets you paste your tool list and get an AI analysis in 30 seconds:

- **Cost efficiency**: Are you overpaying? Are there free alternatives?
- **Tool overlap**: Are multiple tools doing the same job?
- **Self-host potential**: Could you run it yourself for less?
- **Stack complexity**: Is your stack right-sized for your team?
- **Future risk**: Are you locked into vendors with rising prices?

Each tool gets a KEEP, SWITCH, or CUT recommendation with a specific alternative suggestion.

## The numbers

The average small team wastes $200-500 per month on tools they don't use or could replace. That's $2,400-6,000 per year — enough to fund a contractor, a marketing campaign, or six months of better hosting.

Enterprise audit tools would charge you $10,000+ to find that waste. StackAudit costs $1.

## What we learned about research-driven development

This product didn't come from a brainstorm. It came from reading 3,690 Reddit posts that our automation system had captured and indexed in a vector database. We didn't guess what people needed — we searched for corroborated pain points across multiple threads and validated them against market data.

The lesson: **your users are already describing their problems publicly. You just need a system to find and synthesize those signals.**

## Try it

[StackAudit](/projects/stack-audit) is live. Paste your tools, see what you can save. Then [roast your landing page](/projects/page-roast) while you're at it.

## FAQ

**How accurate are the savings estimates?**
They're directional, not exact. Use them as a starting point for your own audit, not a final decision.

**Will it tell me to cancel everything?**
No. Some tools are worth every penny. We flag what's wasteful, redundant, or has a better alternative.

**How is this different from Zylo or Zluri?**
They cost $10K+/year, require IT integration, and target enterprises with 300+ apps. StackAudit costs $1, runs in 30 seconds, and is built for small teams.`,
    'product',
    new Date().toISOString(),
  );

  // Seed LocalScore blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'localscore-browser-ai-that-never-sees-your-data',
    'LocalScore: The AI Tool That Never Sees Your Data',
    'We built a document analyzer that runs entirely in your browser. No server, no API, no data transmission. Here\'s why browser-based AI is the future of privacy-sensitive tools.',
    `## The privacy problem with AI tools

Every time you paste a document into ChatGPT, Claude, or any cloud AI tool, that document travels across the internet to someone else's server. For most content, that's fine. For contracts, financial statements, HR documents, or medical records, it's a compliance nightmare.

GDPR fines have hit €5.88 billion cumulatively. The EU AI Act adds penalties up to €35 million or 7% of global turnover. Companies are scared — and they should be.

But the alternative (not using AI at all) means missing out on the single biggest productivity leap of the decade.

## What if the AI ran on YOUR device?

That's the idea behind [LocalScore](/projects/local-score). The AI model downloads to your browser and runs on your device's GPU. Your document is processed locally. Nothing is uploaded. Nothing is transmitted. Nothing is stored on any server.

This isn't a theoretical architecture. It works today, in production, in Chrome.

## How Google Gemma made this possible

On April 2, 2026, Google released Gemma 4 — a family of open-weight models designed for edge and browser deployment. The E2B (Effective 2B) model runs at 40-180 tokens per second in a browser tab via WebGPU.

Key specs that make browser AI viable:
- **3.2GB** at 4-bit quantization (downloads once, cached in IndexedDB)
- **128K context window** — can process entire contracts
- **Apache 2.0 license** — free for commercial use
- **WebGPU acceleration** — uses your GPU, not your CPU

Combined with WebLLM (an open-source browser inference engine), we can run Gemma at near-native speed inside a Chrome tab.

## What LocalScore does

Four analysis modes, all running locally:

1. **Contract Review**: Extract key terms, obligations, risks, unusual clauses, deadlines
2. **Financial Summary**: Identify key numbers, trends, risks, action items
3. **Meeting Notes**: Extract action items, decisions, owners, deadlines
4. **General Analysis**: Summarize, extract key points, identify risks

After analysis, a green badge confirms: "Analyzed 100% locally. Your document was processed by AI running in your browser. Zero data was sent to any server."

## Don't trust us — verify it

Open your browser's DevTools (F12), go to the Network tab, and run an analysis. You'll see zero network requests during processing. This is the strongest possible privacy architecture: there is no server to breach, no logs to subpoena, no API call to intercept.

## Why it's free

LocalScore costs us nothing to operate. The user's GPU does all the work. No API calls, no Gemini tokens, no server compute. So we made it free — no credits, no limits, no catch.

It drives traffic to [bilko.run](/projects) and builds trust. When someone sees that we offer a genuinely free, genuinely private tool, they're more likely to try the paid tools too.

## The future of browser AI

Gemma 4 is the beginning, not the end. As models get smaller and more capable, more tasks will move to the browser:
- Real-time translation without internet
- Private code review on sensitive codebases
- Medical document analysis that stays on the hospital network
- Legal document review that never leaves the law firm

We're betting that privacy-first AI tools will become a category, not a feature.

## Try it

[LocalScore](/projects/local-score) works in Chrome 113+ and Edge 113+. First visit downloads the model (~1.6GB). After that, everything works offline.

Your documents stay yours.

## FAQ

**Is it as good as ChatGPT or Claude?**
No. Gemma 2B is smaller and less capable than frontier models. But for document analysis — extracting key terms, summarizing, identifying risks — it's surprisingly good. And the trade-off (slightly less capable but completely private) is worth it for sensitive documents.

**Does it work on my phone?**
Not yet. WebGPU support on mobile browsers is still limited. Desktop Chrome and Edge work reliably.

**Can I use this for HIPAA-compliant workflows?**
The tool itself doesn't store or transmit data, which removes the primary HIPAA concern. But consult your compliance team — HIPAA compliance involves more than just data transmission.`,
    'deep-dive',
    new Date().toISOString(),
  );

  // Seed "10 Tools, Solo" blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    '10-tools-solo-what-i-learned-shipping-bilko-run',
    '10 Tools, Solo: What I Learned Shipping bilko.run',
    'I built 10 AI tools in one sprint — from landing page audits to browser-based private document analysis. Here\'s what actually worked, what surprised me, and what I\'d do differently.',
    `## The number that surprises people

10 tools. One person. One sprint.

Not 10 MVPs. Not 10 landing pages with "coming soon" badges. 10 fully functional tools with scoring engines, compare modes, generate modes, personal libraries, cross-tool promotion, a blog, a payment system, and an admin dashboard.

People ask how. The honest answer: AI as a co-pilot and a very specific architecture decision.

## The architecture that made it possible

Every tool on [bilko.run](/projects) follows the same pattern:

1. **Input**: User pastes text (headline, ad copy, thread, email, document, tool list, URL)
2. **Analysis**: Gemini 2.0 Flash processes it against a calibrated scoring prompt
3. **Output**: Score card + section breakdown + actionable fixes + roast/verdict

The frontend uses a shared component kit — ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo. Each tool page is 200-400 lines, not 1,000+. The heavy lifting lives in reusable components.

The backend follows the same pattern: validate input, check auth, rate-limit, call Gemini, parse JSON, save to DB, return results. A shared helper handles the boilerplate for generate endpoints.

This means adding a new tool is a matter of writing a scoring prompt and a page layout. Not building infrastructure from scratch.

## What each tool taught me

**[PageRoast](/projects/page-roast)** — The roast line was an accident. I added it as a debugging artifact. People screenshotted it and shared it. Lesson: the most shareable feature isn't always the most useful one.

**[HeadlineGrader](/projects/headline-grader)** — Adding a Generate mode (not just scoring) doubled the tool's value. People who came to score a headline stayed to generate five better ones.

**[AdScorer](/projects/ad-scorer)** — Platform-specific scoring matters. A great Facebook ad is not a great Google ad. The same copy scores differently depending on where it runs.

**[ThreadGrader](/projects/thread-grader)** — The X algorithm data (reply = 27x a like, bookmarks = 5x) surprised users. They knew threads mattered but not why specific structures worked.

**[EmailForge](/projects/email-forge)** — The deliverability score was inspired by Instantly.ai. Flagging spam trigger words before sending prevents emails from dying in spam folders.

**[AudienceDecoder](/projects/audience-decoder)** — The personality typing (Provocateur, Amplifier, Educator, Slow Burn, Generalist) gave people an identity to rally around. More shareable than raw engagement numbers.

**[LaunchGrader](/projects/launch-grader)** — Born from a Reddit thread with 431 comments asking for product reviews. The demand was obvious once I looked for it.

**[StackAudit](/projects/stack-audit)** — "The SaaS model is quietly falling apart" (461 upvotes, 283 comments). Four corroborating threads. Clear pain, clear gap, clear solution.

**[Stepproof](/projects/stepproof)** — The hardest to build as a web service. YAML parsing, multi-provider LLM adapters, assertion engines — all ported from a CLI tool into a Fastify endpoint.

**[LocalScore](/projects/local-score)** — The outlier. Runs entirely in the browser via WebGPU. Zero server involvement. Free forever. Timed with Gemma 4's launch. Our most technically interesting tool.

## What surprised me

**Credits beat subscriptions.** Every Reddit thread about SaaS pricing complaints is about subscriptions. $1/credit with no recurring charge removes the biggest objection.

**Cross-tool handoffs work.** "Turn this headline into ad copy" and "Generate an email sequence from this thread" connect the tools into workflows. No single-tool competitor can do this.

**Below-fold content matters more than I thought.** Educational sections (How It Works, FAQ, scoring explanations) keep users on the page and build trust. Pages with this content have lower bounce rates.

**The blog drives tool discovery.** Posts about how tools were built (with real Reddit threads as evidence) attract exactly the right audience.

## What I'd do differently

**Ship the blog earlier.** I built 10 tools before writing a single blog post. The blog should have been tool #1 — it's the top of the funnel.

**Start with 3 tools, not 10.** PageRoast, HeadlineGrader, and StackAudit cover three distinct verticals and validate the platform model. The other 7 could have been added based on usage data.

**Test the payment flow sooner.** I added Stripe early but didn't test the full purchase-to-credit-to-usage flow with real users until late.

## The tools

All 10 are live at [bilko.run/projects](/projects). Your first analysis is free. After that, $1/credit or $5 for 7. [LocalScore](/projects/local-score) is completely free — it runs in your browser.

If you're building something and need marketing help, start with [PageRoast](/projects/page-roast). If you're spending too much on tools, start with [StackAudit](/projects/stack-audit). If you have sensitive documents, start with [LocalScore](/projects/local-score).

## FAQ

**Did you really build all of this alone?**
Yes, with AI as a co-pilot. Claude for architecture decisions, code reviews, and the copy you're reading. Gemini for the tool analysis engines. The code is mine; the speed is AI-assisted.

**How long did it take?**
The core platform (10 tools + blog + payments + admin) shipped in one intensive sprint. Each tool takes 2-4 hours when the architecture is reusable.

**Is it profitable?**
Early. The credit model means every use generates revenue. No free-tier subsidization problem.`,
    'build-log',
    new Date().toISOString(),
  );

  console.log('[DB] Initialized' + (process.env.TURSO_DATABASE_URL ? ' (Turso)' : ' (local SQLite)'));
}
