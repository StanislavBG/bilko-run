---
slug: "localscore-browser-ai-that-never-sees-your-data"
title: "LocalScore: The AI Tool That Never Sees Your Data"
excerpt: "We built a document analyzer that runs entirely in your browser. No server, no API, no data transmission. Here's why browser-based AI is the future of privacy-sensitive tools."
category: "deep-dive"
published: true
published_at: "2026-04-04T09:12:07.754Z"
order: 3
---

## The privacy problem with AI tools

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
The tool itself doesn't store or transmit data, which removes the primary HIPAA concern. But consult your compliance team — HIPAA compliance involves more than just data transmission.