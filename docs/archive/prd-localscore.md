# PRD: LocalScore — Privacy-First Document Analyzer

## Problem
Businesses need AI to analyze sensitive documents (contracts, financials, HR, medical, legal) but can't send them to cloud AI due to privacy regulations (GDPR, HIPAA, EU AI Act) and internal security policies. Enterprise solutions cost $50K+/year. Small teams have no option — they either risk compliance violations by using ChatGPT, or they don't use AI at all.

## Evidence

### From Reddit Knowledge Base (ChromaDB)
1. **r/LocalLLaMA** — "My company has zero tolerance for data leaving" (company with 2x H200 rig, evaluating local models for privacy)
2. **r/LocalLLaMA** — Multiple threads about choosing smaller models to avoid API costs and privacy concerns
3. **r/selfhosted** — "Project Nomad - the offline knowledge repo" (bundles Kolibri, Kiwix, local AI model for offline use)
4. **r/ClaudeAI** — Rate limit frustrations (1,481 upvotes) driving interest in local alternatives

### From Market Research
- GDPR: €5.88B in cumulative fines since inception
- EU AI Act: Fines up to €35M or 7% of global turnover
- "Data sovereignty is replacing borderless data flows as the dominant paradigm"
- AI-native startups using local models growing 108% YoY

### Technology Enabler: Gemma 4 (April 2, 2026)
- E2B model: 2B effective parameters, 3.2GB at 4-bit quantization
- Runs in browser via WebGPU at 40-180 tokens/second
- 128K context window — can process entire contracts
- Apache 2.0 license — free to use commercially
- WebLLM framework provides browser integration

## Solution
**LocalScore**: A document analysis tool that runs **entirely in the user's browser**. No data sent to any server. No API costs. No rate limits. Powered by Gemma 4 E2B via WebGPU.

### How It Works
1. User opens LocalScore page on bilko.run
2. Gemma 4 E2B model downloads to browser (~1.6GB one-time, cached)
3. User pastes or uploads document text
4. AI processes document locally using WebGPU
5. Results displayed — document never left the browser
6. Works offline after initial model download

### Analysis Modes
1. **Contract Review**: Extract key terms, obligations, risks, unusual clauses, deadlines
2. **Financial Summary**: Identify key numbers, trends, risks, action items from financial documents
3. **Meeting Notes**: Extract action items, decisions, owners, deadlines from meeting transcripts
4. **General Analysis**: Summarize, extract key points, identify risks from any document

## Technical Implementation
- **WebLLM** (@mlc-ai/web-llm) for browser-based inference
- **Gemma 4 E2B** (4-bit quantized) — ~1.6GB download, cached in browser
- **WebGPU** for GPU acceleration
- No backend endpoint needed — everything runs client-side
- Frontend page at `/projects/local-score`
- Model loading progress bar (first-time setup)

## Scoring Framework
Unlike other tools, LocalScore doesn't connect to our backend for AI. Instead:
- Model runs in browser (free, private)
- The tool is FREE — no credits needed
- Monetization: drives traffic to bilko.run, builds brand, cross-sells paid tools
- Future: premium analysis modes could use server-side Gemini for deeper analysis

## Competitive Landscape
| Competitor | Price | Limitation | Our advantage |
|-----------|-------|-----------|--------------|
| ChatGPT | $20/mo | Data sent to OpenAI servers | Fully local, no data leaving |
| Claude | $20/mo | Data sent to Anthropic | Fully local |
| Microsoft Copilot | $30/user/mo | Data in Microsoft cloud | Fully local |
| Enterprise solutions | $50K+/yr | Complex setup, IT team needed | Open browser, paste doc |

## Why This is Distinct
- Current tools (1-9): All use server-side Gemini API
- LocalScore: Runs entirely in the browser — ZERO server involvement
- Current tools: Score/generate marketing content
- LocalScore: Analyze private/sensitive documents
- Current tools: Cost $1/credit
- LocalScore: FREE (no API costs = no credits needed)
- Completely new vertical: Privacy/Compliance/Document Analysis

## Success Metrics
- Page views (awareness of privacy-first AI)
- Model download completions (engagement)
- Cross-tool conversion (LocalScore → paid tools)
- Social sharing ("this tool never sees your data")
