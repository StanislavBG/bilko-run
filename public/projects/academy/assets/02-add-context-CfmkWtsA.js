import{u as l,j as e}from"./index-QmZ7u8yN.js";const h={slug:"add-context",moduleSlug:"prompting",courseSlug:"foundations",title:"Add context — who, what, why, what-good-looks-like",tagline:"The four-part skeleton that fits inside any prompt.",estimatedMinutes:10,objectives:[{statement:"Apply the WWWW (who, what, why, what-good-looks-like) framework to any prompt in under 60 seconds."},{statement:"Predict where context belongs in a long prompt (top vs middle vs bottom)."}],sources:[{label:"Anthropic — Prompting best practices · Add context to improve performance",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#add-context-to-improve-performance",retrievedOn:"2026-05-09"},{label:"Anthropic — Prompting best practices · Long context prompting",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting",retrievedOn:"2026-05-09"}],prerequisites:["be-clear-and-direct"],publishedOn:"2026-05-09"};function a(o){const t={code:"code",em:"em",h2:"h2",p:"p",pre:"pre",strong:"strong",...l(),...o.components},{Quiz:i,Reflect:s,Term:r}=t;return i||n("Quiz"),s||n("Reflect"),r||n("Term"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"Lesson 1 gave you the rule: be clear and direct. This lesson gives you the scaffold that makes it repeatable — four questions that turn any vague request into a prompt a smart colleague could act on without asking a single follow-up."}),`
`,e.jsxs(t.p,{children:[`Anthropic calls this "adding context to improve performance."[1] We're calling it WWWW: `,e.jsx(t.strong,{children:"who, what, why, what-good-looks-like"}),". Four slots. Every slot you fill produces a measurably better answer."]}),`
`,e.jsx(t.h2,{children:"The WWWW framework"}),`
`,e.jsx(t.p,{children:"The four slots, with the question you should answer in each:"}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Who"})," — who is the audience for the output, and (sometimes) who are you? A resignation letter to a startup founder reads differently from one to a government HR department. When you omit the audience, the model picks a default, and its default is rarely yours."]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"What"}),' — what specifically do you want done? Lesson 1 covered this: a verb, a noun, a constraint. "Rewrite the email below to 50% of its length." Not "make it better."']}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"Why"}),` — what is this output going to be used for? This is the slot most people skip. "I'm writing to my landlord to ask for repairs" tells the model what voice and stakes to optimize for. "I'm writing a complaint to file with the city housing authority" unlocks a completely different register. Same underlying request; wildly different tonal requirements.`]}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"What-good-looks-like"}),' — in one sentence, what does a passing answer look like? This is the hardest slot to fill, and the most valuable. "A good answer will have three concrete next steps, no jargon, and fit in a calendar invite description." Now the model has a success criterion, not just a task.']}),`
`,e.jsx(t.h2,{children:'The "smart busy colleague" mental model'}),`
`,e.jsx(t.p,{children:`Anthropic's reference frames context through a memorable image: "Give Claude as much context as you would give a smart, busy colleague who is helping you for the first time."[1]`}),`
`,e.jsx(t.p,{children:"That phrase does real work. It gives you the ceiling and the floor at the same time."}),`
`,e.jsxs(t.p,{children:["The ",e.jsx(t.strong,{children:"floor"}),": don't assume they know what you're working on. They just joined the project. The document you've been staring at for three days is invisible to them. Put it in the message."]}),`
`,e.jsxs(t.p,{children:["The ",e.jsx(t.strong,{children:"ceiling"}),`: don't explain things they'd obviously know. They're smart. They know what a marketing email is. They don't need you to define "concise." The ceiling prevents prompt bloat — the tendency to pad context with things that don't narrow the space of good answers.`]}),`
`,e.jsx(t.p,{children:"Everything inside those two constraints is context worth including. Everything outside is noise."}),`
`,e.jsx(t.h2,{children:"What-good-looks-like is the most underused slot"}),`
`,e.jsx(t.p,{children:"Most people fill Who, What, and sometimes Why. Almost nobody fills What-good-looks-like."}),`
`,e.jsxs(t.p,{children:["This is a mistake. The verification slot does two things at once. First, it forces ",e.jsx(t.em,{children:"you"})," to have a clear picture of success before you send the prompt — which often reveals that you haven't actually decided what you want. Second, it gives the model a rubric, which consistently outperforms giving it a task description alone."]}),`
`,e.jsx(t.p,{children:"Consider these two prompts for the same underlying need:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Summarize this report for my team.
`})}),`
`,e.jsx(t.p,{children:"vs."}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Summarize the report below for a weekly team email. Audience: non-technical
product managers who haven't read the report. A good summary will cover the
three findings most relevant to product decisions, in bullet points, and fit
in the body of an email without scrolling.
`})}),`
`,e.jsx(t.p,{children:"The second prompt is longer, but every additional word narrows the space of good answers. That's the test: does this additional context reduce the number of answers the model might give? If yes, it belongs. If it doesn't narrow anything, cut it."}),`
`,e.jsx(t.h2,{children:"Context placement in long prompts"}),`
`,e.jsxs(t.p,{children:["When your prompt includes a document — a report, an email thread, a contract — Anthropic specifically recommends putting the document ",e.jsx(t.strong,{children:"at the top"})," and the instructions ",e.jsx(t.strong,{children:"at the bottom"}),".[2]"]}),`
`,e.jsx(t.p,{children:"This is counterintuitive. Instructions feel like they should come first. But for long context prompts, the model benefits from encountering the document before it encounters the task, because it can prime its attention on what matters. Putting instructions last also prevents the model from spending attention on instructions before it knows what the document contains."}),`
`,e.jsx(t.p,{children:"The pattern looks like this:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`<document>
[long text here]
</document>

Given the document above, [instructions].
`})}),`
`,e.jsxs(t.p,{children:["We'll cover the ",e.jsx(r,{word:"XML tags",children:"XML tag"})," syntax in Lesson 4. For now, the key placement rule is: ",e.jsx(t.strong,{children:"document on top, task on the bottom"}),"."]}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(s,{id:"m2l1-r1",prompt:"Pick a prompt you've sent in the last week that didn't produce a great result. Write it out. Then go through the four WWWW slots and write what was missing. What would the filled-in version look like?",minChars:60}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(i,{id:"m2l1-q1",question:"Which slot of the WWWW framework do most people skip?",options:[{id:"a",label:"Who (audience)",correct:!1,explanation:"People often include some audience context, even if implicitly. Not the most-skipped."},{id:"b",label:"What (the task)",correct:!1,explanation:"The task is the core of the prompt — people almost always state it, if vaguely."},{id:"c",label:"Why (purpose)",correct:!1,explanation:"Purpose is often missing, but there's one slot skipped even more consistently."},{id:"d",label:"What-good-looks-like (success criterion)",correct:!0,explanation:"The verification slot is the most consistently missing piece — and the one that produces the biggest jump in output quality when added."}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["You now know ",e.jsx(t.em,{children:"what"})," to include in a prompt. Lesson 3 shows you the fastest way to communicate it: examples. Two well-chosen examples routinely beat three paragraphs of instruction."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Add context to improve performance"}),', https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#add-context-to-improve-performance (retrieved 2026-05-09). The "smart, busy colleague" metaphor is verbatim from Anthropic.']}),`
`,e.jsxs(t.p,{children:["[2] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Long context prompting"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting (retrieved 2026-05-09)."]})]})}function d(o={}){const{wrapper:t}={...l(),...o.components};return t?e.jsx(t,{...o,children:e.jsx(a,{...o})}):a(o)}function n(o,t){throw new Error("Expected component `"+o+"` to be defined: you likely forgot to import, pass, or provide it.")}export{d as default,h as frontmatter};
