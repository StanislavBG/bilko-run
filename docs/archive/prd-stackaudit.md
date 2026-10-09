# PRD: StackAudit — AI SaaS Stack Cost Analyzer

## Problem
Small teams and solo founders are drowning in SaaS subscriptions. The average small business pays for 20-30 tools, many of which overlap, go unused, or have cheaper/free alternatives. Enterprise audit tools (Zylo, Zluri, Torii) cost $10,000-50,000+/year and require IT integration. Nobody serves the 1-20 person team that just needs to know: "Where is my money going and what can I cut?"

## Evidence (3+ corroborating threads from Reddit knowledge base)

### Thread 1: "The SaaS model is quietly falling apart for small businesses" (461 upvotes, 283 comments, r/Entrepreneur)
> "I run a 12 person company and I just did our annual software audit and the number genuinely startled me. We are paying for 23 separate software subscriptions... total monthly spend across all of them..."
> Reply: "We cut nine subscriptions in a single afternoon and nobody noticed"
> Reply: "What you're actually paying for is the ecosystem... with tools like n8n, you can tie everything together"

### Thread 2: "I manually clicked cancel on 800+ SaaS products" (54 upvotes, 54 comments, r/SaaS)
> "To make the 'one-click cancel' feature work, I had to manually hunt down the exact cancellation URLs and flows for over 800 different software products."
> Reply: "offering an option to pause is a great move"
> Reply: "You built a slick solution to a problem most people barely care about" (but 54 upvotes says otherwise)

### Thread 3: "$100K ARR — what it actually feels like" (r/SaaS)
> "at 100K ARR with typical SaaS gross margins of 70-80%, you're looking at maybe $70-80K gross profit. subtract hosting ($1-5K/month), tools, maybe a contractor or two, and taxes (~30-40% effective). your actual take-home as a solo founder..."

### Thread 4: "Built our SaaS on AWS. Monthly bill: $2,400. Moved to Hetzner. Monthly bill: $180" (141 upvotes, r/SaaS)
> "The $2,220 monthly savings is meaningful at our revenue level. That's a part-time contractor."
> Reply: "If you build AWS applications correctly, they're cheaper than you think. But they're a completely different way of building apps"

## Target User
Solo founders, indie hackers, and small teams (1-20 people) who pay for 10-30 SaaS tools and suspect they're wasting money but don't have time to audit manually.

## Solution
**StackAudit**: Paste your list of SaaS tools (name + monthly cost), or describe your stack. AI analyzes each tool and returns:
- Total monthly/annual spend
- Tools with free or cheaper alternatives
- Overlapping tools (e.g., Slack + Teams + Discord)
- Unused tool detection signals
- Savings estimate with specific switch recommendations
- Self-hosted alternatives where applicable

## Scoring Framework (100 points — Stack Efficiency Score)

### 1. Cost Efficiency (30 pts)
- Are you paying market rate or overpaying? (0-10)
- Are there free alternatives for paid tools? (0-10)
- Could you downgrade tiers on underused tools? (0-10)

### 2. Tool Overlap (25 pts)
- Do any tools have overlapping functionality? (0-10)
- Could fewer tools cover the same workflows? (0-8)
- Are there all-in-one alternatives? (0-7)

### 3. Self-Host Potential (20 pts)
- Which tools have viable self-hosted alternatives? (0-10)
- Would self-hosting save meaningful money at your scale? (0-10)

### 4. Stack Complexity (15 pts)
- Is the stack right-sized for team size? (0-8)
- Are there integration pain points from too many tools? (0-7)

### 5. Future Risk (10 pts)
- Are you locked into vendors with high switching costs? (0-5)
- Are pricing trends going up for your key tools? (0-5)

## Input Format
User pastes a simple list:
```
Slack - $12/user/month - 5 users
GitHub - $4/user/month - 3 users
Vercel - $20/month
Supabase - $25/month
Figma - $15/user/month - 2 users
Linear - $8/user/month - 5 users
Notion - $10/user/month - 5 users
Mailchimp - $20/month
```

Or describes: "We're a 5-person SaaS team using Slack, GitHub, Vercel, Supabase, Figma, Linear, Notion, Mailchimp, Google Workspace, and 1Password."

## Output
- **Stack Efficiency Score**: 0-100
- **Monthly spend**: Calculated total
- **Annual spend**: x12
- **Potential savings**: Specific dollar amount
- **Per-tool analysis**: Keep / Switch / Cut recommendation for each
- **Alternative suggestions**: Free/cheaper options with migration difficulty rating
- **Self-host options**: Where applicable
- **One-liner**: Bilko-style roast of the stack

## Competitive Landscape
| Competitor | Price | Target | Our advantage |
|-----------|-------|--------|--------------|
| Zylo | $10K+/yr | Enterprise (305+ apps) | $1/credit, instant, no integration |
| Zluri | Custom | Mid-market | Same |
| Torii | $5K+/yr | IT teams | Same |
| SaaSRooms | Free calculator | Small biz | We go deeper (alternatives, overlap, self-host) |
| Vendr | $3K+/yr | Procurement | Same |

## Technical Implementation
- Endpoint: `POST /api/demos/stack-audit`
- Input: `{ tools: string, teamSize?: number, email: string }`
- No page fetching needed — text analysis only (faster, cheaper)
- Gemini 2.0 Flash for analysis
- Same token system, Clerk auth, rate limiting
- Frontend: New page at `/projects/stack-audit`

## Why This is Different from Current Tools
- Current 8 tools are all **content/marketing** tools (score copy, grade ads, etc.)
- StackAudit is a **financial/operations** tool (cut costs, find waste)
- Different user moment: not "I need to write better copy" but "I need to spend less money"
- Different value prop: not "improve quality" but "save money"
- Completely different vertical, same platform, same credits
