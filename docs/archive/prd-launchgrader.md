# PRD: LaunchGrader — Pre-Launch Readiness Audit for SaaS Products

## Problem
Founders build products but can't tell if they're ready to launch. The most engaged Reddit post in our knowledge base (431 comments) is literally "Drop your side project, I'll give it honest review." People are desperate for structured feedback on their product — not just the landing page (PageRoast does that), but the **entire go-to-market readiness**: pricing, positioning, competitive gaps, onboarding, and launch strategy.

Existing tools (Competely at $30/mo, IdeaProof) focus on competitor analysis or idea validation in isolation. Nobody does a **unified launch readiness score** that tells a founder "you're 67% ready to launch — here's exactly what's missing."

## Target User
Solo founders, indie hackers, and small SaaS teams who've built something and need to know: "Am I ready to launch? What am I missing?"

Source evidence:
- "Finished building my SaaS — marketing is where I'm lost" (181 up, 201 cmt, r/SaaS)
- "How do you actually get your first users" (68 up, 136 cmt, r/SideProject)
- "How do you actually measure market size before building" (81 up, r/SideProject)
- "I feel so behind everyone" (107 up, 208 cmt, r/SideProject)

## Solution
**LaunchGrader**: Paste your product URL + a 2-sentence description. AI audits 5 dimensions of launch readiness, gives a score out of 100, and tells you exactly what to fix before launching.

## Scoring Framework (100 points)

### 1. Value Proposition Clarity (25 pts)
- Can a visitor understand what this product does in 5 seconds? (0-8)
- Is the target audience explicitly stated? (0-7)
- Is the differentiation from alternatives clear? (0-5)
- Is there a compelling "why now?" urgency? (0-5)

### 2. Pricing & Monetization (20 pts)
- Is pricing visible and clear? (0-7)
- Does the pricing model match the value delivery? (0-5)
- Is there a free tier or trial to reduce friction? (0-4)
- Are there clear upgrade triggers? (0-4)

### 3. Social Proof & Trust (20 pts)
- Are there testimonials, case studies, or user counts? (0-7)
- Is there a real person/team behind the product? (0-5)
- Are there trust signals (security badges, integrations, press)? (0-4)
- Is there an active community or social presence? (0-4)

### 4. Onboarding & First Value (20 pts)
- Is there a clear CTA to get started? (0-7)
- Can a user reach "first value" quickly? (0-5)
- Is the signup friction low? (0-4)
- Is there guidance/onboarding visible? (0-4)

### 5. Competitive Positioning (15 pts)
- Is there an implicit or explicit competitor comparison? (0-5)
- Does the product occupy a clear category? (0-5)
- Is the moat or unfair advantage communicated? (0-5)

## Output
- **Total score**: 0-100
- **Grade**: A+ through F
- **Per-section breakdown** with specific feedback
- **Top 3 launch blockers**: The most critical things to fix before launch
- **Launch readiness verdict**: "Ready to launch", "Almost there — fix 2 things", "Not ready — major gaps"
- **One-liner**: A savage/funny summary (PageRoast style)

## Technical Implementation
- Endpoint: `POST /api/demos/launch-grader`
- Input: `{ url: string, description: string, email: string }`
- Uses `fetchPageBounded()` from page-fetch service (same as PageRoast)
- Gemini 2.0 Flash for analysis
- Same rate limiting, token system, Clerk auth
- Frontend: New page at `/projects/launch-grader`
- Uses shared component kit (ToolHero, ScoreCard, SectionBreakdown, etc.)

## Monetization
- Same credit model: 1 credit per audit
- Free tier: 3/day (same as all tools)

## Success Metrics
- Usage: 50+ audits/week within first month
- Engagement: Average score viewed for >60 seconds
- Conversion: 5%+ of free users buy credits
- Sharing: 10%+ share their score on social

## Competitive Advantage
- **Price**: $1 vs $30-100/mo for Competely/IdeaProof
- **Speed**: 30 seconds vs hours of manual research
- **Scope**: 5-dimension audit vs single-focus tools
- **Voice**: Bilko's honest, funny tone vs corporate reports
- **Integration**: Same credits work across all 8 tools
