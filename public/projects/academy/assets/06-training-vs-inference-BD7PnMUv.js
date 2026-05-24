import{u as h,j as e}from"./index-CaX5rrIH.js";const l={slug:"training-vs-inference",moduleSlug:"what-is-an-ai",courseSlug:"foundations",title:"Training vs inference — two very different activities",tagline:"The model you talk to is a frozen snapshot. Here's why that matters.",estimatedMinutes:10,objectives:[{statement:'Distinguish "training" from "inference".'},{statement:'Explain why a model has a "knowledge cutoff" date.'},{statement:"Recognize why fine-tuning is different from prompting."}],sources:[{label:"MIT 6.S191 — Lecture 1: Intro to Deep Learning",url:"https://introtodeeplearning.com/",retrievedOn:"2026-05-09"},{label:"Anthropic — Models overview",url:"https://platform.claude.com/docs/en/about-claude/models/overview",retrievedOn:"2026-05-09"},{label:"Andrej Karpathy — Intro to Large Language Models (1h)",url:"https://www.youtube.com/watch?v=zjkBMFhNj_g",retrievedOn:"2026-05-09"},{label:"Anthropic — Tool use (function calling)",url:"https://docs.anthropic.com/en/docs/build-with-claude/tool-use",retrievedOn:"2026-05-09"}],prerequisites:["the-context-window"],publishedOn:"2026-05-09"};function a(t){const n={em:"em",h2:"h2",p:"p",strong:"strong",...h(),...t.components},{Quiz:r,Reflect:s,Term:o}=n;return r||i("Quiz"),s||i("Reflect"),o||i("Term"),e.jsxs(e.Fragment,{children:[e.jsx(n.p,{children:`When you ask Claude about yesterday's news and it doesn't know, the instinct
is to assume the model is slow, or offline, or not trying hard enough. The real
explanation is older and less obvious: the model you're talking to was frozen
months ago.`}),`
`,e.jsxs(n.p,{children:["Understanding ",e.jsx(n.em,{children:"when"})," that freeze happens — and ",e.jsx(n.em,{children:"why"}),` — changes how you use AI
tools for everything from research to live data pipelines.`]}),`
`,e.jsxs(n.h2,{children:["The ",e.jsx(o,{word:"training",children:"training"})," step"]}),`
`,e.jsxs(n.p,{children:[`Training is how the model acquires everything it knows. Over several months, a
large cluster of specialized processors works through an enormous corpus of text
— books, websites, code, scientific papers — adjusting billions of numerical
weights until the model can predict patterns in that text reliably.[1] Andrej
Karpathy, whose lecture `,e.jsxs(n.em,{children:["Intro to ",e.jsx(o,{word:"LLM",children:"Large Language Models"})]}),` is one of the clearest
public explanations of the process, describes the result as a "compressed world
model" — a vast statistical summary of everything the training data contained.[3]`]}),`
`,e.jsx(n.p,{children:`At the end of training, the weights are frozen. Anthropic ships a new version
of Claude by running a new training cycle, not by editing the old weights.[1]
The frozen model is what you interact with every time you open a chat window.`}),`
`,e.jsxs(n.p,{children:[`One implication follows immediately: anything that happened after the training
data was collected is invisible to the model. It cannot reason about it, infer
it, or guess at it reliably. This boundary is called the `,e.jsx(n.strong,{children:e.jsx(o,{word:"knowledge cutoff",children:"knowledge cutoff"})}),`,
and it is a property of training, not of `,e.jsx(o,{word:"inference",children:"inference"}),`. Anthropic publishes
knowledge cutoff dates for each model on the models overview page.[1]`]}),`
`,e.jsx(n.h2,{children:"The inference step"}),`
`,e.jsxs(n.p,{children:[`Inference is what happens when you send a message. Your text arrives, the
frozen model processes it — computing the most probable next `,e.jsx(o,{word:"token",children:"tokens"}),` given your
input and everything in the context window — and a response begins returning.
No weights change. No parameters are updated. The same model that was frozen
months ago reads your words and replies.[1]`]}),`
`,e.jsx(n.p,{children:`This process is fast. On modern hardware, the first tokens of a response can
arrive in under a second for short inputs. That speed is an inference artifact:
the model is doing computation, not retrieval and not learning. It has no
network calls to make and no new knowledge to acquire.[1]`}),`
`,e.jsx(n.h2,{children:"Training vs. inference: a kitchen analogy"}),`
`,e.jsx(n.p,{children:`Think of training as writing and printing a recipe book. The process takes a
professional kitchen months of testing — every recipe tried, corrected,
refined. When the book goes to print, it is finished. The knowledge is locked
to the page.`}),`
`,e.jsxs(n.p,{children:[`Inference is following one recipe from that book. You produce a fresh meal
every time you cook, and you can cook as many meals as you like. But the act
of cooking does not change the book. A new recipe does not appear on page 47
just because you made a particularly interesting salad tonight. The book is
what it is, and each meal is produced `,e.jsx(n.em,{children:"from"})," it."]}),`
`,e.jsx(n.p,{children:`The model you talk to is the printed book. Every conversation is a cooking
session. The book is the same whether you cook once or a million times.`}),`
`,e.jsx(n.h2,{children:"Why the knowledge cutoff matters"}),`
`,e.jsx(n.p,{children:`The cutoff is not a failure mode — it is a necessary consequence of the
frozen-book architecture. Training data collection ends on a specific date, and
anything after that date is outside the book. Anthropic publishes these dates
per model so users know exactly what the boundary is.[1]`}),`
`,e.jsx(n.p,{children:`This means two things are true at once: the model can answer questions about
historical events with the fluency of an expert, and it cannot tell you what
happened last week. Both properties come from the same source — a very
complete, very frozen record of what the world looked like up to a point.`}),`
`,e.jsx(n.p,{children:`The cutoff also has nothing to do with how fast inference is. Faster hardware
does not bring the knowledge cutoff forward. "Claude doesn't know about
yesterday" is not solved by making inference faster. It is solved by adding
fresh data to the inference call.`}),`
`,e.jsx(n.h2,{children:"What real-time use cases actually require"}),`
`,e.jsxs(n.p,{children:[`If your application needs current information — live prices, recent news,
today's weather — the answer is `,e.jsx(n.strong,{children:"tools"}),`. Anthropic's tool-use system lets a
model call external functions during an inference call: a web search API, a
database query, a live data feed.[4] The results are returned and placed into
the `,e.jsx(o,{word:"context window",children:"context window"})," before the model writes its reply."]}),`
`,e.jsx(n.p,{children:`From the model's point of view, the tool result is text that appeared in the
context — the same as anything else it reads. From the user's point of view,
the model "knows" current information. What actually happened: the inference
call reached outside itself, fetched fresh data, and the frozen model reasoned
over that data.[4]`}),`
`,e.jsx(n.p,{children:`This is the architecture behind Claude with web search enabled. The model's
training cutoff is unchanged. What changed is that the inference call now
includes a retrieval step before the model generates its answer. The recipe
book is the same; the cook looked something up before following the recipe.`}),`
`,e.jsx(n.h2,{children:"Try it"}),`
`,e.jsx(n.p,{children:`Before we check your understanding, write down an example from your own
experience with AI tools.`}),`
`,e.jsx(s,{id:"m1l6-r1",prompt:"Think of a question you asked Claude in the last week where freshness mattered. Was a tool wired in (web search, API call)? If not — would the answer have been better with one?",minChars:40}),`
`,e.jsx(n.p,{children:"When you're ready, one question to confirm the key idea landed."}),`
`,e.jsx(n.h2,{children:"Quick check"}),`
`,e.jsx(r,{id:"m1l6-q1",question:"You ask Claude what happened in the news yesterday. It doesn't know. Why?",options:[{id:"a",label:"Inference is slow at fetching news.",correct:!1,explanation:"Inference doesn't fetch — it computes from the frozen model. Speed has nothing to do with missing recent knowledge."},{id:"b",label:"The training cutoff is older than yesterday.",correct:!0,explanation:"Models are frozen at training time. News that arrived after the cutoff date is outside the recipe book, no matter how fast inference runs."},{id:"c",label:"Claude is throttling news queries.",correct:!1,explanation:"There is no such throttle. The model would answer if it had the information — it simply doesn't have it."}]}),`
`,e.jsx(n.p,{children:`If you chose (a), re-read the inference section. Training and inference run on
completely different timescales and for completely different reasons. Conflating
them is the single most common misunderstanding about why AI tools have a
knowledge cutoff.`}),`
`,e.jsx(n.h2,{children:"What's next"}),`
`,e.jsxs(n.p,{children:["The next lesson looks at ",e.jsx(o,{word:"fine-tuning",children:"fine-tuning"}),`: a middle step between full training and
prompting. It is smaller than training a model from scratch, but unlike a
prompt, its effects persist beyond the conversation.`]}),`
`,e.jsx(n.h2,{children:"Citations"}),`
`,e.jsxs(n.p,{children:["[1] Anthropic — ",e.jsx(n.em,{children:"Models overview"}),`, https://platform.claude.com/docs/en/about-claude/models/overview
(retrieved 2026-05-09). Framing of frozen weights, inference pipeline, and knowledge cutoff dates
per model.`]}),`
`,e.jsxs(n.p,{children:["[2] MIT 6.S191 — ",e.jsx(n.em,{children:"Intro to Deep Learning"}),`, https://introtodeeplearning.com/ (retrieved 2026-05-09).
Overview of the training process and compute requirements for large-scale models.`]}),`
`,e.jsxs(n.p,{children:["[3] Andrej Karpathy — ",e.jsx(n.em,{children:"Intro to Large Language Models"}),` (1h lecture),
https://www.youtube.com/watch?v=zjkBMFhNj_g (retrieved 2026-05-09). The "compressed world model"
framing appears around the 10-minute mark and describes what the training weights encode about the
world seen during pretraining.`]}),`
`,e.jsxs(n.p,{children:["[4] Anthropic — ",e.jsx(n.em,{children:"Tool use (function calling)"}),`,
https://docs.anthropic.com/en/docs/build-with-claude/tool-use (retrieved 2026-05-09). Tool use
lets an inference call retrieve live data — from a search API, database, or any external function —
before the model produces its answer.`]})]})}function c(t={}){const{wrapper:n}={...h(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(a,{...t})}):a(t)}function i(t,n){throw new Error("Expected component `"+t+"` to be defined: you likely forgot to import, pass, or provide it.")}export{c as default,l as frontmatter};
