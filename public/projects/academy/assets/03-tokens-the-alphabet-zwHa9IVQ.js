import{u as d,j as e}from"./index-icay1YtR.js";const m={slug:"tokens-the-alphabet",moduleSlug:"what-is-an-ai",courseSlug:"foundations",title:"Tokens — the alphabet a model actually reads",tagline:"The model never sees your words. Here's what it sees instead.",estimatedMinutes:10,objectives:[{statement:"Explain what a token is, in non-technical terms."},{statement:"Predict approximately how many tokens a piece of text will use."},{statement:"Explain why prompts in non-English languages can behave unevenly."}],sources:[{label:"Anthropic — Tokens reference",url:"https://platform.claude.com/docs/en/about-claude/glossary#tokens",retrievedOn:"2026-05-09"},{label:"3Blue1Brown — But what is a GPT? Visual intro to transformers",url:"https://www.3blue1brown.com/lessons/gpt",retrievedOn:"2026-05-09"},{label:"Andrej Karpathy — Intro to LLMs",url:"https://www.youtube.com/watch?v=zjkBMFhNj_g",retrievedOn:"2026-05-09"}],prerequisites:["rules-vs-learning"],publishedOn:"2026-05-09"};function c(s){const t={em:"em",h2:"h2",p:"p",strong:"strong",...d(),...s.components},{AskClaude:a,Cite:o,Quiz:i,Reflect:l,Term:n,TokenizerDemo:h}=t;return a||r("AskClaude"),o||r("Cite"),i||r("Quiz"),l||r("Reflect"),n||r("Term"),h||r("TokenizerDemo"),e.jsxs(e.Fragment,{children:[e.jsxs(t.p,{children:['The model never sees "Hello". By the time your message reaches ',e.jsx(n,{word:"inference",children:"inference"}),`, it has been converted into
a sequence of integers — each one representing a short chunk of text called a `,e.jsx(t.strong,{children:e.jsx(n,{word:"token",children:"token"})}),`. This
lesson is about that conversion: what it is, why it produces the results it does, and what it means
for how you write prompts.`]}),`
`,e.jsxs("figure",{className:"opener",children:[e.jsxs("svg",{width:"560",height:"120",viewBox:"0 0 560 120",style:{maxWidth:"100%",height:"auto"},role:"img","aria-label":"Diagram: the word 'tokenization' splits into three tokens",children:[e.jsx("defs",{children:e.jsx("style",{children:`
      .ot-letter { font-family: var(--serif); font-size: 56px; font-weight: 500; fill: var(--ink); }
      .ot-tok    { font-family: var(--mono); font-size: 14px; fill: var(--ink-3); }
      .ot-line   { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 2 3; }
      .ot-box    { fill: var(--paper-3); stroke: var(--rule-soft); }
    `})}),e.jsx("text",{x:"40",y:"58",className:"ot-letter",children:"tokeniz"}),e.jsx("text",{x:"240",y:"58",className:"ot-letter",children:"ation"}),e.jsx("line",{x1:"234",y1:"20",x2:"234",y2:"80",className:"ot-line"}),e.jsx("rect",{x:"40",y:"78",width:"190",height:"22",rx:"3",className:"ot-box"}),e.jsx("text",{x:"50",y:"93",className:"ot-tok",children:'"token" · 3580'}),e.jsx("rect",{x:"240",y:"78",width:"76",height:"22",rx:"3",className:"ot-box"}),e.jsx("text",{x:"250",y:"93",className:"ot-tok",children:'"iz"'}),e.jsx("rect",{x:"318",y:"78",width:"100",height:"22",rx:"3",className:"ot-box"}),e.jsx("text",{x:"328",y:"93",className:"ot-tok",children:'"ation"'}),e.jsx("text",{x:"430",y:"58",className:"ot-letter",style:{fill:"var(--accent)"},children:"≈ 3"}),e.jsx("text",{x:"430",y:"93",className:"ot-tok",children:"tokens, 1 word"})]}),e.jsx("figcaption",{className:"opener-caption",children:"Fig 06.1 — one word, three tokens"})]}),`
`,e.jsx(t.h2,{children:"Words become numbers"}),`
`,e.jsx(t.p,{children:`Picture a produce drawer where every vegetable has been shredded before storage. The drawer no
longer holds a carrot and a leek — it holds the slices those were cut into, each labeled with a
number. When you reach into the drawer, you work with slices, not vegetables. You can still infer
what the originals were, but the unit of storage is the slice.`}),`
`,e.jsxs(t.p,{children:[`A language model's input works the same way. Your text arrives as characters. A separate
program — the tokenizer — cuts it into sub-word chunks, maps each chunk to an integer from a fixed
vocabulary, and hands the resulting number sequence to the model. The model then maps each integer
into a high-dimensional numerical vector that encodes relationships between tokens.`,e.jsx(o,{n:"2",src:"3Blue1Brown — But what is a GPT?",quote:"Each token becomes a high-dimensional vector; the model never works with letters or words once embedding is done."}),` The words
exist briefly on the way in; everything the model actually computes is numbers.`]}),`
`,e.jsxs(t.p,{children:[e.jsx(n,{word:"tokenization",children:"Tokenization"}),` runs before inference starts, it is fully deterministic, and the same text always
produces the same token sequence for a given tokenizer. The model has no say in how the slicing
happens.`]}),`
`,e.jsx(t.h2,{children:'Why "the" is one token but "Bibitkov" is four'}),`
`,e.jsxs(t.p,{children:["The tokenizer's vocabulary is not a dictionary. It was built from the ",e.jsx(n,{word:"training",children:"training"}),` corpus using an
algorithm called Byte Pair Encoding, or BPE.`,e.jsx(o,{n:"3",src:"Karpathy — Intro to LLMs",quote:"BPE starts at the character level and iteratively merges the most-frequent adjacent pair until the vocab reaches its target size — usually around 100k tokens."})]}),`
`,e.jsx(t.p,{children:`BPE starts with individual characters and then repeatedly finds the pair of symbols that appear most
often next to each other in the training data, fuses them into a single token, and repeats. Common
substrings accumulate across rounds: first "in", then "ing", then "running" — until high-frequency
sequences exist as single tokens. Rare strings never reach the merge threshold, so they remain as
smaller pieces. Frequency determines granularity.`}),`
`,e.jsx(t.p,{children:`The practical consequence: any string that appeared often in training data is likely to be one
token. "The" is one token. "Hello" is one token. "Bibitkov" is approximately four tokens — split
as something like "B", "ib", "it", "kov" — because that exact string has essentially never appeared
in training data as a unit, so BPE never had a reason to fuse it.[3] The tokenizer does not know
it's a surname. It sees a character sequence it never learned to treat as whole.`}),`
`,e.jsx(t.p,{children:`This is not a bug. It is exactly what the algorithm is designed to do: match granularity to
frequency.`}),`
`,e.jsxs("div",{className:"stat-row",children:[e.jsxs("div",{className:"stat",children:[e.jsx("div",{className:"stat-num",children:"~100k"}),e.jsxs("div",{className:"stat-label",children:["Vocab size, modern ",e.jsx(n,{word:"LLM",children:"LLMs"})]})]}),e.jsxs("div",{className:"stat",children:[e.jsx("div",{className:"stat-num",children:"≈ 0.75"}),e.jsx("div",{className:"stat-label",children:"Words per token (English)"})]}),e.jsxs("div",{className:"stat",children:[e.jsx("div",{className:"stat-num",children:"4 chars"}),e.jsx("div",{className:"stat-label",children:"Avg token length"})]})]}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(t.p,{children:"The demo below runs the tokenizer live. Type any phrase and watch the colored boundaries appear."}),`
`,e.jsx(h,{defaultText:"Hey, I build AI things."}),`
`,e.jsx(t.p,{children:`Notice that "Hey" is one token and the comma is its own token. Each colored span is one unit the
model processes. Short, common English words almost always map to a single token. Unusual strings,
punctuation, and numbers almost always map to more.`}),`
`,e.jsx(t.h2,{children:"Why this matters in practice"}),`
`,e.jsx(t.p,{children:"Tokenization is not a technical footnote — it has direct consequences for how you use the model."}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Non-English text is more expensive token-for-token."}),` Because most models' training corpora are
English-heavy, non-English characters and accented letters were merged less aggressively by BPE. A
sentence like "¿Cómo estás?" — three words — maps to roughly six to eight tokens because the
inverted question mark and accented vowels each become their own token or small cluster. In plain
English, equivalent content would be three or four tokens.`,e.jsx(o,{n:"1",src:"Anthropic — Glossary · Tokens",quote:"A token corresponds to approximately 3–4 characters of English text; non-English scripts and emoji typically produce more tokens per visible character."}),` Non-English prompts therefore consume
proportionally more of a model's `,e.jsx(n,{word:"context window",children:"context window"})," and cost more per word."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Emoji are expensive."}),` Each emoji is typically two to four tokens. Emoji are encoded in multi-byte
Unicode sequences, and those sequences appeared infrequently enough in training data that BPE had
little incentive to fuse them.`,e.jsx(o,{n:"3",src:"Karpathy — Intro to LLMs",quote:"Multi-byte UTF-8 sequences are tokenized byte-by-byte unless they appeared often enough in training for BPE to merge them into a single ID."})]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Code is denser than prose."}),` Programming languages repeat many short character sequences —
brackets, indentation, keywords — that appear often enough in training data to be fused. In our
experience, a block of Python code tends to produce roughly one token per 1.2 to 1.5 characters,
which is denser tokenization than English prose.`]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Context windows are measured in tokens, not words."}),` When Anthropic quotes a context-window
size — as of May 2026, Claude supports up to 200K tokens, though this changes with model releases
and you should check the current spec`,e.jsx(o,{n:"1",src:"Anthropic — Glossary · Tokens",quote:"Context window limits are quoted in tokens, not words or characters; current model specs are published on the Anthropic docs site."}),` — that ceiling is a token count, not a word or character
count. The tokenizer is the gatekeeper.`]}),`
`,e.jsx(t.h2,{children:"The 1-token-≈-0.75-words rule of thumb"}),`
`,e.jsxs(t.p,{children:[`For plain English prose, one token represents roughly 0.75 words on average — or equivalently, one
word is roughly 1.3 tokens.`,e.jsx(o,{n:"1",src:"Anthropic — Glossary · Tokens",quote:"As a rule of thumb, one English word ≈ 1.3 tokens; 100 words ≈ 130 tokens. Use this for estimating context-window budgets."}),` Anthropic's glossary states that one token corresponds to
approximately 3–4 characters of English text. Since an English word averages four to five
characters, both figures point to the same ratio: a 250-word page of prose is roughly 330 tokens.
The rule is reliable for estimates, not precision.`]}),`
`,e.jsx(t.p,{children:`The ratio loosens the further you move from plain English. Non-English text, source code, numbers,
and unusual proper nouns all produce higher token counts per word. Emoji are well outside the rule
entirely.`}),`
`,e.jsx(t.p,{children:"Before you reach for the demo, make a prediction."}),`
`,e.jsx(l,{id:"m1l3-r1",prompt:"A 2,000-word essay (around 12,000 characters). Without using the demo: roughly how many tokens? (Then check.)"}),`
`,e.jsx(t.p,{children:`The math: 2,000 words × 1.3 tokens per word ≈ 2,600 tokens. If your estimate was anywhere in
the 2,000–3,000 range, the intuition is calibrated. Paste a passage into the demo above to verify.`}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(t.p,{children:"One question to confirm the core mechanism landed."}),`
`,e.jsx(i,{id:"m1l3-q1",question:'"Hello world" is 2 tokens. Why does "Bibitkov" use approximately four?',options:[{id:"a",label:"The model doesn't know what Bibitkov means.",correct:!1,explanation:'"Hello" and "world" are also just patterns to the model — meaning is not the variable. Frequency in the training data is.'},{id:"b",label:"Bibitkov rarely appeared in training data, so BPE never fused it into a single token.",correct:!0,explanation:"Byte Pair Encoding in one sentence: common strings get fused; rare strings stay as pieces. Frequency determines granularity."},{id:"c",label:"Proper nouns always take more tokens than common words.",correct:!1,explanation:'Common proper nouns like "London" or "Python" are typically single tokens because they appear frequently in training data. Rarity is the predictor, not grammatical category.'}]}),`
`,e.jsx(t.p,{children:`If you chose the second option, the mechanism is clear. If not, re-read the BPE section above before
continuing.`}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:[`The next lesson goes inside the token sequence: how the model decides which token comes next, and
what "`,e.jsx(n,{word:"temperature",children:"temperature"}),'" controls in that decision.']}),`
`,e.jsx(a,{id:"m1l3-ask",lessonContext:"Lesson 06 — Tokens: the alphabet a model actually reads. Covered: BPE, vocabulary ~100k, tokens vs words vs characters, why non-English and emoji are expensive, the ~0.75 words/token rule, why letter-counting fails."}),`
`,e.jsxs("div",{className:"lesson-foot",children:[e.jsxs("a",{className:"lf-card prev",href:"#/what-is-an-ai/rules-vs-learning",children:[e.jsx("div",{className:"lf-card-dir",children:"← Previous"}),e.jsx("div",{className:"lf-card-title",children:"05 · The 60-year shift — from rules to learning"})]}),e.jsxs("a",{className:"lf-card next",href:"#/what-is-an-ai/probability-and-sampling",children:[e.jsx("div",{className:"lf-card-dir",children:"Up next →"}),e.jsx("div",{className:"lf-card-title",children:"07 · Probability, sampling, and why answers vary"})]})]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Glossary · Tokens"}),`, https://platform.claude.com/docs/en/about-claude/glossary#tokens
(retrieved 2026-05-09).`]}),`
`,e.jsxs(t.p,{children:["[2] 3Blue1Brown — ",e.jsxs(t.em,{children:["But what is a GPT? Visual intro to ",e.jsx(n,{word:"transformer",children:"transformers"})]}),`,
https://www.3blue1brown.com/lessons/gpt (retrieved 2026-05-09). The vector-`,e.jsx(n,{word:"embedding",children:"embedding"}),` framing in the
opening section draws on Section 1 of that lesson.`]}),`
`,e.jsxs(t.p,{children:["[3] Andrej Karpathy — ",e.jsx(t.em,{children:"Intro to LLMs"}),` (lecture),
https://www.youtube.com/watch?v=zjkBMFhNj_g (retrieved 2026-05-09). The BPE walkthrough and the
"rare strings stay as pieces" intuition come from the tokenization segment.`]})]})}function p(s={}){const{wrapper:t}={...d(),...s.components};return t?e.jsx(t,{...s,children:e.jsx(c,{...s})}):c(s)}function r(s,t){throw new Error("Expected component `"+s+"` to be defined: you likely forgot to import, pass, or provide it.")}export{p as default,m as frontmatter};
