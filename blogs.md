# Bilko.run Blog & Podcast Guidelines

## Mission
Share what we learn as we build. Every blog post is a lesson from the trenches — specific, honest, useful. The podcast is generated from the blog (audio version + expanded commentary).

## Voice & Tone
Based on the LinkedIn strategy (Irina Malkova 10/10 quality reference):
- **Bold opening** that challenges a paradigm or states something unexpected
- **Specific numbers, data points, or contrasts** — never vague claims
- **Vivid analogies** that make abstract concepts concrete
- **Professional authority** — speaks from building, not observing
- **Ends with a question or invitation** to think differently
- **150-250 words per section**. Structured with headings for scannability.

## What We Write About
1. **Build logs** — What we shipped, why, and what happened (real numbers)
2. **Lessons learned** — Specific insights from building bilko.run tools
3. **Technical deep dives** — How something works under the hood (Gemini prompting, Turso migration, scoring frameworks)
4. **Market analysis** — What competitors are doing, what we steal, what we skip
5. **User stories** — How people use the tools, what surprised us

## What We DON'T Write
- Vague "AI is changing everything" posts
- Corporate buzzwords or thought leadership fluff
- Tip lists without specific examples from our own work
- Generic tutorials that could come from any blog
- One-liner observations (that's X/Twitter, not the blog)

## Blog Post Structure (2026 Best Practices)

### Format
1. **Title**: Under 60 chars, specific, contains the key insight (not clickbait)
2. **Hook** (2-3 sentences): State the problem or surprising finding. Make the reader need to keep reading.
3. **Context** (1-2 paragraphs): Why this matters. Who should care.
4. **The meat** (3-5 sections with H2 headings): Each section is a self-contained insight. Use specific numbers. Include code snippets or screenshots where relevant.
5. **What we'd do differently** (1 paragraph): Honest reflection.
6. **CTA**: Link to the relevant tool, invite discussion, or tease the next post.

### SEO Requirements
- One H1 (the title), H2 for main sections, H3 for subsections
- 1,200-2,000 words (sweet spot for depth + scannability)
- 3-5 internal links to bilko.run tools
- 2-3 external links to sources/references
- Alt text on all images
- FAQ section at the bottom (for featured snippets)
- Meta description: 150-160 chars

### Engagement Elements
- One image every 300-400 words
- Bullet points and numbered lists for scanners
- Code blocks for technical content (syntax highlighted)
- Pull quotes for shareable insights
- Embedded tool demos where relevant (link to live tool)

## Post Backlog

- **Cellar — building a full FreeCell engine from scratch** (build-log): shipped 2026-05-10 at /projects/cellar/. Cover: domain-restricted deal-number seeding (no /dev/urandom), solvability oracle via recursive BFS with 5k-node cap, CSS specificity war between `:root` and `[data-theme]` attribute selectors, 45-test Playwright suite across 8 spec files, 5-theme WCAG AA a11y, autosave/hydration, daily streak system with freeze tokens.

- **MindSwiffer — building Minesweeper without 50/50s** (build-log): shipped 2026-05-09 at /projects/mindswiffer/. Cover: no-guess constraint solver, wave-function collapse analogy, why 50/50s are a design failure not a feature, 65-test Playwright suite, 5-theme WCAG AA a11y, cascade animations + reduced-motion.

## Content Sources
1. **Reddit knowledge base** — 5,500+ indexed discussions from 86 subreddits (ChromaDB at Local-Browser-Automation/downloads/chroma-db/)
2. **Content calendar** — 44 drafted posts in content-calendar.db
3. **LinkedIn strategy** — 5 rotating pillars mapped to blog categories
4. **Competitor research** — 35+ competitors analyzed across 7 tool categories
5. **Build logs** — Git history, deployment notes, architecture decisions

## Blog Categories
- `build-log` — What we shipped and why
- `lessons` — Insights from building solo
- `deep-dive` — Technical how-it-works
- `market` — Competitor analysis and market observations
- `product` — Tool-specific content (PageRoast, HeadlineGrader, etc.)

## Podcast Generation
Each blog post becomes a podcast episode:
- Blog → AI-generated audio narration (TTS)
- Add intro/outro bumper
- Expand with 2-3 minutes of commentary not in the blog
- Distribute: RSS feed, embed on blog page, link from social

## Publishing Cadence
- 1 blog post per week (minimum)
- Corresponding podcast within 48 hours
- Social promotion: X thread + LinkedIn post + in-tool cross-promo
- Repurpose: Blog → Thread → LinkedIn → Email newsletter

## Measurement
- Page views (from analytics)
- Time on page (engagement)
- Social shares (X + LinkedIn)
- Tool signups from blog (utm tracking)
- Email captures from blog

## Next Post Ideas
- Etch — building Mario's Picross from scratch in N PRDs and one weekend, with a verified no-guess generator + Wordle-style picture share-tile.
- FizzPop — building a Daily Solvable bubble shooter, in 12 PRDs and one weekend
