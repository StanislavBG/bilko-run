import{u as r,j as e}from"./index-QmZ7u8yN.js";const c={slug:"when-to-trust-when-to-verify",moduleSlug:"safety-and-verification",courseSlug:"foundations",title:"When to trust, when to verify",tagline:"A 4-quadrant model and a one-question test.",estimatedMinutes:10,objectives:[{statement:"Place any AI task on a 2-axis grid (cost-of-wrong × verifiability) and pick a strategy."},{statement:'Apply the "what would I have to check?" question (from L1) as a daily habit.'}],sources:[{label:"Anthropic — AI Fluency: Framework & Foundations (Diligence module)",url:"https://anthropic.skilljar.com/ai-fluency-framework-foundations",retrievedOn:"2026-05-09"},{label:"Anthropic — Reduce hallucinations",url:"https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations",retrievedOn:"2026-05-09"}],prerequisites:["prompt-injection-in-plain-english"],publishedOn:"2026-05-09"};function o(n){const t={a:"a",blockquote:"blockquote",code:"code",em:"em",h2:"h2",p:"p",pre:"pre",strong:"strong",...r(),...n.components},{DragMatch:i,Term:a}=t;return i||s("DragMatch"),a||s("Term"),e.jsxs(e.Fragment,{children:[e.jsxs(t.p,{children:["Three lessons in, you know that models ",e.jsx(a,{word:"hallucination",children:"hallucinate"}),", that the AUP defines where extra care is required, and that prompt injection is an open problem. You need a way to turn that knowledge into a daily decision habit that takes less than ten seconds per AI task."]}),`
`,e.jsx(t.p,{children:"This lesson gives you that habit: a 2×2 grid and one question."}),`
`,e.jsx(t.h2,{children:"The 2×2: cost-of-wrong × verifiability"}),`
`,e.jsx(t.p,{children:"Every AI task has two properties that determine what level of verification it needs."}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Cost-of-wrong"})," is how badly things go if the output is wrong. A brainstorming list for a team meeting has a low cost-of-wrong. A summary of a contract clause that affects a negotiation has a high cost-of-wrong. A CEO's name in a published article has a moderate cost-of-wrong (embarrassing, but correctable). A drug dosage in patient-facing health content has an extreme cost-of-wrong."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Verifiability"}),' is how easy it is to check the output. "Is this summary approximately correct?" is hard to verify without re-reading the source. "Is this URL valid?" is easy — click it. "Is this the current price?" is easy — look it up. "Is this legal interpretation accurate?" is hard without a lawyer.']}),`
`,e.jsx(t.p,{children:"Put these two axes together:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`                 VERIFIABLE
                 (easy to check)
                      │
       Q1             │           Q2
  Low cost,      ─────┼─────   Low cost,
  easy to check       │           hard to check
                      │
  ──────────────── AI task ─────────────────
                      │
       Q3             │           Q4
  High cost,    ─────┼─────   High cost,
  easy to check       │           hard to check
                      │
                 NOT VERIFIABLE
                 (hard to check)
`})}),`
`,e.jsx(t.h2,{children:"Four quadrants — what to do in each"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Q1 — Low cost, easy to check."})," Trust and move. A brainstormed list of meeting agenda items, a first draft of a casual email, a set of synonyms to consider. Even if the output is wrong, the cost is low, and you'd notice easily. Use the model freely here."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Q2 — Low cost, hard to check."})," Trust with a light touch. A background summary of a topic you don't know well, a first explanation of an unfamiliar concept. The stakes are low, so a rough error doesn't hurt much. But know that you can't easily verify it — don't cite this output to others without flagging it as unverified."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Q3 — High cost, easy to check."})," Verify before acting. A CEO's name, a publication date, a quoted statistic, a hyperlink, a price. These are high stakes — getting them wrong damages credibility or causes downstream errors — but they're fast to verify. The model is useful here as a first pass; you do a quick fact-check before publishing or sending."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Q4 — High cost, hard to check."})," Restructure the task or add a human expert. Contract analysis, medical interpretation, legal strategy, complex financial modeling. The model can assist — summarize, draft, suggest — but the output must pass through a qualified human before it's acted on. This is the high-risk category from Lesson 2's AUP discussion.[1]"]}),`
`,e.jsx(t.h2,{children:"The one-question test"}),`
`,e.jsxs(t.p,{children:["The grid is useful for ",e.jsx(a,{word:"training",children:"training"})," the habit. Once it's trained, you can compress it to one question:"]}),`
`,e.jsxs(t.blockquote,{children:[`
`,e.jsx(t.p,{children:"What would I have to check to be confident in this?"}),`
`]}),`
`,e.jsx(t.p,{children:`Answer honestly. If the answer is "nothing" or "just click the link," you're in Q1 or Q3 territory — move fast. If the answer is "I'd need a lawyer to read this" and you don't have one, you're in Q4 territory — don't act on the output alone.`}),`
`,e.jsx(t.p,{children:"The question works because it forces you to name the verification steps before you skip them. Most mistakes happen when people trust output they haven't verified not because they thought it was verified, but because they didn't stop to ask whether it needed to be.[1]"}),`
`,e.jsx(t.h2,{children:"Concrete examples"}),`
`,e.jsx(t.p,{children:`| Task | Cost-of-wrong | Verifiable? | Strategy |
|---|---|---|---|
| Draft a first-pass email to a colleague | Low | Easy (you'll re-read it) | Q1 — trust and send |
| Summarize a contract clause | High | Hard (need legal read) | Q4 — human review required |
| Generate three headline options for a blog post | Low | Hard (taste is subjective) | Q2 — light editorial pass |
| Find the name of the current CEO of a company | Moderate | Easy (quick search) | Q3 — verify before publishing |
| Write a patient FAQ about a medication | High | Hard (clinical judgment) | Q4 — medical review required |
| Brainstorm questions for a user interview | Low | Easy (you pick the ones you like) | Q1 — trust and adapt |`}),`
`,e.jsx(t.h2,{children:"What about PageRoast?"}),`
`,e.jsxs(t.p,{children:["If you've used ",e.jsx(t.a,{href:"https://bilko.run/projects/pageroast/",children:"PageRoast"}),`, you've already seen the verification step externalized. PageRoast takes a landing page URL, runs Claude's analysis, and then explicitly marks which claims are high-confidence (grounded in the page content the model can see) and which are lower-confidence (inferences the model made). That's Q3 behavior automated — the tool does the "find the load-bearing facts and flag them" step for you.`]}),`
`,e.jsx(t.p,{children:"The grid doesn't change for AI-powered tools. The question is still: what's the cost of this analysis being wrong, and how easy is it to verify?"}),`
`,e.jsx(t.h2,{children:"Drag to the right quadrant"}),`
`,e.jsx(i,{id:"m3l4-dm1",pairs:[{left:"Draft a tweet for review",right:"Q1 — trust and move"},{left:"Summarize a legal contract",right:"Q4 — add human expert"},{left:"Find a company's founding year",right:"Q3 — verify before publishing"},{left:"Generate product name ideas",right:"Q2 — light editorial pass"}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["The final lesson in this module covers citations and ",e.jsx(a,{word:"grounding",children:"grounding"})," — when retrieval-augmented systems actually make things more reliable, when they create a false sense of security, and the sixty-second drill for checking whether a citation says what the AI claims it says."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"AI Fluency: Framework & Foundations"}),` (Diligence module), https://anthropic.skilljar.com/ai-fluency-framework-foundations (retrieved 2026-05-09). The "what would I have to check?" framing and the Diligence loop concept are drawn from this course's verification unit.`]})]})}function d(n={}){const{wrapper:t}={...r(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(o,{...n})}):o(n)}function s(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{d as default,c as frontmatter};
