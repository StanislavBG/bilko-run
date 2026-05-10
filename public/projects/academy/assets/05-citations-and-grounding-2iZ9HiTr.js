import{u as c,j as e}from"./index-QmZ7u8yN.js";const l={slug:"citations-and-grounding",moduleSlug:"safety-and-verification",courseSlug:"foundations",title:'Citations, grounding, and "show me the source"',tagline:"When retrieval helps, when it lies, and how to read a cited answer.",estimatedMinutes:11,objectives:[{statement:'Distinguish "the model claims a citation" from "the model is actually quoting a document I can see."'},{statement:'Use the "find the relevant quotes first, then answer" pattern.'},{statement:"Recognize hybrid systems (Claude + web search, Perplexity, ChatGPT browse) and the failure modes specific to them."}],sources:[{label:"Anthropic — Reduce hallucinations: find quotes first",url:"https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations",retrievedOn:"2026-05-09"},{label:"Anthropic — Citations API",url:"https://platform.claude.com/docs/en/build-with-claude/citations",retrievedOn:"2026-05-09"}],prerequisites:["when-to-trust-when-to-verify"],publishedOn:"2026-05-09"};function r(n){const t={code:"code",em:"em",h2:"h2",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...c(),...n.components},{Quiz:a,Reflect:o,Term:i}=t;return a||s("Quiz"),o||s("Reflect"),i||s("Term"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"A citation is not a source."}),`
`,e.jsx(t.p,{children:"A citation is the model's claim that a source exists. If the model hallucinated the citation, the source doesn't exist. If the source exists but doesn't say what the model says it says, the citation is misleading. Either way, you're worse off than if the model had said nothing — because now you have a false sense of security."}),`
`,e.jsxs(t.p,{children:["This lesson draws the line between citations that help and citations that don't, explains how ",e.jsx(i,{word:"grounding",children:"grounding"})," works when it works, and gives you a sixty-second drill you can run on any AI answer that comes with sources attached."]}),`
`,e.jsx(t.h2,{children:"The Citations API — when grounding is real"}),`
`,e.jsx(t.p,{children:"Anthropic publishes a Citations API that enables a specific, verifiable form of grounding.[2] When you use it, the workflow looks like this:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"You pass source documents into the API along with your question."}),`
`,e.jsx(t.li,{children:"The model answers using only those documents."}),`
`,e.jsxs(t.li,{children:["The API returns each claim with a ",e.jsx(t.em,{children:"span"})," — a precise range of characters from the source that supports the claim."]}),`
`,e.jsx(t.li,{children:"You can programmatically verify that the span exists in the document and that the claim matches it."}),`
`]}),`
`,e.jsx(t.p,{children:`This is fundamentally different from asking the model to "cite its sources" without giving it source documents. In the Citations API case, the citation is machine-verifiable: you can check that the span index points to real text in the document you provided. The model can't fabricate a span that doesn't exist.[2]`}),`
`,e.jsx(t.p,{children:"The citation is grounded. It might still be misinterpreted — the model might quote the right sentence but draw the wrong conclusion from it. But the source is real and checkable."}),`
`,e.jsx(t.p,{children:"Most people don't use the Citations API directly. What they use are products built on it: tools that fetch documents, pass them to Claude, and surface cited answers. If you're using such a tool, the citation chain is: document → span → claim. You can follow it backward."}),`
`,e.jsx(t.h2,{children:'The "find quotes first" pattern in your own prompts'}),`
`,e.jsxs(t.p,{children:["You don't need the Citations API to get grounded answers. Anthropic's ",e.jsx(i,{word:"hallucination",children:"hallucinations"})," guide documents a simple prompt pattern you can use today:[1]"]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Read the document below. Before answering my question, find the 2-3 most relevant quotes that bear on it — quote them exactly, with section references if available. Then answer the question, drawing only on those quotes.

[Document text here]

Question: [Your question]
`})}),`
`,e.jsx(t.p,{children:"This pattern works because it forces the model to commit to evidence before constructing an answer. If the quotes don't support the answer, you can see the gap. If the answer contradicts the quotes, you have a verifiable discrepancy. The model still might misinterpret a quote, but misinterpretation is a smaller error than fabrication — and it's checkable."}),`
`,e.jsx(t.p,{children:"The pattern is particularly useful for:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Summarizing contracts or policy documents"}),`
`,e.jsx(t.li,{children:"Answering questions from meeting transcripts"}),`
`,e.jsx(t.li,{children:"Extracting facts from research papers you've downloaded"}),`
`,e.jsx(t.li,{children:"Building on existing documentation without paraphrasing in ways that lose precision"}),`
`]}),`
`,e.jsx(t.h2,{children:"Hybrid systems and their failure modes"}),`
`,e.jsxs(t.p,{children:["Many popular AI tools today are ",e.jsx(t.em,{children:"retrieval-augmented"}),": they combine a language model with a web search or document store. Perplexity, ChatGPT's Browse mode, Bing Copilot, Claude's web-search tool — all of these fetch real URLs and pass the page content to the model along with your question."]}),`
`,e.jsxs(t.p,{children:["This is better than asking a model to work from ",e.jsx(i,{word:"training",children:"training"})," data alone. It makes the citation real: the URL exists, the page (usually) exists, the text was fetched."]}),`
`,e.jsxs(t.p,{children:["But retrieval-augmented systems have their own failure mode, and it's subtle: ",e.jsx(t.strong,{children:"the citation links exist, the pages exist, but the pages don't say what the answer claims"}),"."]}),`
`,e.jsx(t.p,{children:"This happens for several reasons:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Chunking errors."})," The retrieval system splits pages into chunks and passes the most relevant-seeming chunk. The relevant-seeming chunk might not contain the specific fact the model asserts — it might be in an adjacent chunk that wasn't retrieved."]}),`
`,e.jsxs(t.li,{children:[e.jsxs(t.strong,{children:["Model ",e.jsx(i,{word:"inference",children:"inference"}),"."]})," The model reads the retrieved text and makes an inference that it presents as a quote. The inference might be wrong even if the text is right."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Page changes."})," The model's citation was accurate at retrieval time, but the page has since been updated or deleted."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Conflation."})," The model blends claims from multiple retrieved sources into a single sentence, citing only one of them."]}),`
`]}),`
`,e.jsx(t.p,{children:"The retrieval system gave you a real URL. The model still hallucinated what the URL said."}),`
`,e.jsx(t.h2,{children:"The sixty-second drill"}),`
`,e.jsx(t.p,{children:"Any time you receive an AI answer that comes with citations — from Perplexity, from a Claude tool, from a cited report — run this drill on two of them:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"Click the citation link. Confirm the page loads."}),`
`,e.jsx(t.li,{children:"Search (Cmd/Ctrl+F) for the key phrase or fact from the AI's answer."}),`
`,e.jsx(t.li,{children:"Does the page contain the phrase? Does it support the claim?"}),`
`]}),`
`,e.jsx(t.p,{children:"If yes: the citation is real and grounded. You can use the fact with confidence."}),`
`,e.jsx(t.p,{children:"If the page doesn't contain the phrase: the model cited a real page but fabricated what it said. Treat the fact as unverified."}),`
`,e.jsx(t.p,{children:"If the page doesn't load: check if it's a paywall, a redirect, or a 404. A 404 is a fabricated citation."}),`
`,e.jsx(t.p,{children:"Two citations, sixty seconds. You'll find that most citations from well-designed retrieval systems are real and accurate. Occasionally you'll catch one that isn't. The habit calibrates your trust over time — and you'll notice which tools have higher citation accuracy without anyone telling you."}),`
`,e.jsx(o,{id:"m3l5-r1",prompt:"Think of an AI tool you use that shows citations or source links. Have you ever actually clicked one? If you have: did the page say what the AI claimed? If you haven't: pick one answer from the last week and run the sixty-second drill right now. What did you find?",minChars:40}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(a,{id:"m3l5-q1",question:"A Perplexity answer cites three real URLs. You click all three and the pages load. Does that mean the citations are accurate?",options:[{id:"a",label:"Yes — if the pages load, the citations are valid.",correct:!1,explanation:"Real pages are necessary but not sufficient. The pages need to actually contain the claims the model made. Click through and search for the specific fact."},{id:"b",label:"No — you also need to check that each page says what the answer claims it says.",correct:!0,explanation:"Correct. Retrieval-augmented systems can cite real URLs that don't support the specific claim. The sixty-second drill closes that gap."},{id:"c",label:"It depends on how expensive the model is.",correct:!1,explanation:"Model price and citation accuracy are not correlated in the way this implies. The failure mode affects all retrieval-augmented systems."},{id:"d",label:"Only if Anthropic's Citations API was used.",correct:!1,explanation:"The Citations API provides stronger grounding guarantees, but you can verify manually with any tool — that's what the drill is for."}]}),`
`,e.jsx(t.h2,{children:"Module wrap-up"}),`
`,e.jsx(t.p,{children:"You've covered the three faces of the same underlying problem:"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Hallucination"})," (Lesson 1): Models predict plausible ",e.jsx(i,{word:"token",children:"tokens"}),", not true ones. The fix is architectural — ground the model in source text, require evidence-first answers, verify the load-bearing facts."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Acceptable use"})," (Lesson 2): Some uses require extra safeguards — human review, AI disclosure, no autonomous high-stakes decisions. Know which category your work falls in. The AUP is at https://www.anthropic.com/legal/aup.[1]"]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:e.jsx(i,{word:"prompt injection",children:"Prompt injection"})})," (Lesson 3): External content can contain instructions the model follows. ",e.jsx(i,{word:"XML tags",children:"XML tags"})," and instruction-priority language reduce the risk. Agentic tools that browse and act need human checkpoints."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Verification"}),' (Lesson 4): The 2×2 grid and the "what would I have to check?" question give you a decision framework for every AI task. High-cost, hard-to-verify tasks need a human expert in the loop.']}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Grounding"})," (Lesson 5): A citation is not a source. Grounding means the model's claims are traceable to specific spans of text you can inspect. The sixty-second drill makes that check fast."]}),`
`,e.jsxs(t.p,{children:["The mental model you've built across these five lessons: ",e.jsx(t.strong,{children:"AI is fluent. Fluency is not accuracy. You are the accuracy layer."})," Know when to rely on that, when to outsource it to a tool, and when to bring in a human. That judgment — consistently applied — is what separates careful AI use from expensive mistakes."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Reduce hallucinations"}),', https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations (retrieved 2026-05-09). The "find the relevant quotes first, then answer" pattern is documented here; applies to both the Citations API and manual prompt design.']}),`
`,e.jsxs(t.p,{children:["[2] Anthropic — ",e.jsx(t.em,{children:"Citations API"}),", https://platform.claude.com/docs/en/build-with-claude/citations (retrieved 2026-05-09). Describes the span-based grounding mechanism and how to verify citations programmatically."]})]})}function d(n={}){const{wrapper:t}={...c(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(r,{...n})}):r(n)}function s(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{d as default,l as frontmatter};
