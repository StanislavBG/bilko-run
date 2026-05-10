import{u as h,j as e}from"./index-QmZ7u8yN.js";const l={slug:"chain-prompts",moduleSlug:"prompting",courseSlug:"foundations",title:"Chain prompts — one job per turn",tagline:"When a prompt does too much, split it. Three small turns beat one giant one.",estimatedMinutes:10,objectives:[{statement:"Identify a multi-task prompt that should be chained."},{statement:"Pass output from one turn into the next without losing structure."}],sources:[{label:"Anthropic — Prompting best practices · Leverage thinking and interleaved thinking capabilities",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#leverage-thinking--interleaved-thinking-capabilities",retrievedOn:"2026-05-09"},{label:"Anthropic — Chain complex prompts for stronger performance",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#chain-complex-prompts",retrievedOn:"2026-05-09"}],prerequisites:["long-context-where-to-put-what"],publishedOn:"2026-05-09"};function a(n){const t={code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...h(),...n.components},{AskClaude:o,Quiz:s,Term:r}=t;return o||i("AskClaude"),s||i("Quiz"),r||i("Term"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"Lesson 1 introduced mixed instructions as a failure mode: four tasks in one prompt, two done well, two done badly. The fix there was to number the tasks. That works for simple cases. For genuinely complex work — where the output of step 1 is the input of step 2 — a better fix is to split the work across separate turns."}),`
`,e.jsx(t.p,{children:"This is prompt chaining, and it's one of the highest-leverage techniques for complex tasks. Anthropic recommends it explicitly for work that requires multiple distinct stages of reasoning.[1]"}),`
`,e.jsx(t.h2,{children:"When to chain"}),`
`,e.jsxs(t.p,{children:["Not every multi-step task benefits from chaining. The test is dependency: does step 2 need the ",e.jsx(t.em,{children:"output"})," of step 1, not just the ",e.jsx(t.em,{children:"input"}),"?"]}),`
`,e.jsx(t.p,{children:e.jsx(t.strong,{children:"Chain when:"})}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The output of one step needs to be evaluated or transformed before the next step can proceed."}),`
`,e.jsx(t.li,{children:"You want a chance to review and correct intermediate results before they propagate."}),`
`,e.jsxs(t.li,{children:["Different steps benefit from different ",e.jsx(r,{word:"role",children:"roles"}),' or framings (e.g., one turn as "extractor," the next as "analyst").']}),`
`]}),`
`,e.jsx(t.p,{children:e.jsx(t.strong,{children:"Don't chain when:"})}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The tasks are independent and can be listed with numbers (Lesson 1 approach)."}),`
`,e.jsx(t.li,{children:"The tasks are simple enough that one prompt handles them reliably."}),`
`,e.jsx(t.li,{children:"The intermediate output isn't something you can usefully review."}),`
`]}),`
`,e.jsx(t.h2,{children:"The two-turn pattern: extract → analyze"}),`
`,e.jsx(t.p,{children:"The most common chain is extract, then analyze. You ask the model to pull specific information from a document, then in a second turn you ask it to reason about what it pulled."}),`
`,e.jsx(t.p,{children:"Turn 1:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`<document>
[annual report]
</document>

Extract every mention of customer churn from the document above.
Quote the relevant sentences verbatim. Put them inside <churn_mentions> tags.
`})}),`
`,e.jsx(t.p,{children:"Turn 2 (after reviewing the extraction):"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`<churn_mentions>
[what the model returned]
</churn_mentions>

Based only on the churn mentions above, what is the most likely cause of
the Q3 spike? Give your answer in two sentences.
`})}),`
`,e.jsx(t.p,{children:"Why is this better than one prompt? Because you get to check the extraction before the model reasons from it. If the extraction is wrong or incomplete, you fix it before bad data pollutes the analysis."}),`
`,e.jsx(t.h2,{children:"The three-turn pattern: outline → draft → critique"}),`
`,e.jsx(t.p,{children:'For writing tasks, a three-turn chain consistently produces better output than a one-shot "write me a full draft" prompt.'}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Turn 1 — outline"}),`: "Give me a three-point outline for [piece]."
`,e.jsx(t.strong,{children:"Turn 2 — draft"}),`: "Write the full piece based on this outline: [outline from turn 1]."
`,e.jsx(t.strong,{children:"Turn 3 — critique"}),`: "Now critique this draft as a tough editor: what's weakest, and what's one concrete fix?"`]}),`
`,e.jsx(t.p,{children:"You don't have to act on the critique — but having it available helps you decide whether to iterate or move on. And each turn is focused on one job, which means the model can do that job well rather than juggling three jobs simultaneously."}),`
`,e.jsx(t.h2,{children:'The "think step by step" question'}),`
`,e.jsx(t.p,{children:`You may have seen advice to add "let's think step by step" to prompts. This was effective with earlier models. Claude in 2026 performs extended reasoning internally for complex tasks — Anthropic's guidance is that the model handles this automatically for problems that warrant it, without needing the explicit instruction.[1]`}),`
`,e.jsxs(t.p,{children:["What you ",e.jsx(t.em,{children:"do"})," still need to do is break the ",e.jsx(t.em,{children:"task"})," into steps when the task is genuinely multi-stage. The model's internal reasoning doesn't replace the need to chain prompts when the work requires intermediate human review or output-to-input dependencies."]}),`
`,e.jsx(t.h2,{children:"Passing output between turns cleanly"}),`
`,e.jsxs(t.p,{children:["The cleanest handoff is to copy the model's output from turn 1 directly into turn 2, wrapped in the same ",e.jsx(r,{word:"XML tags",children:"XML tag"})," structure you used to request it. This keeps the structural separation clear and prevents the model from confusing its own prior output with new content."]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-xml",children:`<extraction>
[paste the model's output from turn 1 here]
</extraction>

Based on the extraction above, [new question].
`})}),`
`,e.jsx(t.p,{children:"This pattern also makes it easy to edit the intermediate output before passing it forward — which is often the point."}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(o,{id:"m2l7-try1",placeholder:"Describe a complex task you've been trying to do in one prompt. I'll suggest how to split it into a two- or three-turn chain.",system:"You are a prompt-engineering tutor. When the user describes a complex task, suggest a clear two- or three-turn prompt chain: what to ask in turn 1, what to do with the output, and what to ask in turn 2 (and 3 if needed). Be specific about the handoff — what XML tags to use, what to check before continuing."}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(s,{id:"m2l7-q1",question:"You want to summarize a report, then write a tweet based on the summary, then check the tweet for factual accuracy. What's the best approach?",options:[{id:"a",label:'One prompt: "Summarize, write a tweet, check for accuracy."',correct:!1,explanation:"Three tasks at once. The model will handle some well and some poorly, and the accuracy check won't be very useful since it's checking its own just-generated output without pause."},{id:"b",label:"Three separate turns: summarize → tweet → accuracy check.",correct:!0,explanation:"Each turn does one job. You review the summary before writing the tweet; you review the tweet before checking accuracy. Errors don't cascade."},{id:"c",label:`Add "let's think step by step" to a single prompt.`,correct:!1,explanation:"That instruction helped with earlier models. Claude in 2026 reasons internally for complex problems. What you still need is human review between stages — which requires chaining."},{id:"d",label:"Number the tasks 1, 2, 3 in one prompt.",correct:!1,explanation:"Numbering works when tasks are independent. Here, the tweet depends on the summary, and the accuracy check depends on the tweet — there are dependencies that need human review points."}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["The final lesson of Module 2 asks the question you should always ask after prompting: how do you ",e.jsx(t.em,{children:"know"})," if your prompt is better than the last one? Verifying prose outputs turns out to have a lot in common with running software tests — and the same discipline pays off."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Leverage thinking and interleaved thinking capabilities"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#leverage-thinking--interleaved-thinking-capabilities (retrieved 2026-05-09). Anthropic notes that newer Claude models handle step-by-step reasoning internally for problems that warrant it."]}),`
`,e.jsxs(t.p,{children:["[2] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Chain complex prompts"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#chain-complex-prompts (retrieved 2026-05-09)."]})]})}function u(n={}){const{wrapper:t}={...h(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(a,{...n})}):a(n)}function i(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{u as default,l as frontmatter};
