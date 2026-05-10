import{u as l,j as e}from"./index-QmZ7u8yN.js";const h={slug:"give-claude-a-role",moduleSlug:"prompting",courseSlug:"foundations",title:"Give Claude a role",tagline:'"You are a careful editor reviewing a draft." Why that one sentence changes everything.',estimatedMinutes:9,objectives:[{statement:"Use a system prompt or role line to set Claude's stance for an entire conversation."},{statement:"Avoid the two role-prompt failures — over-constraining and persona drift."}],sources:[{label:"Anthropic — Prompting best practices · Give Claude a role",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role",retrievedOn:"2026-05-09"}],prerequisites:["structure-with-xml-tags"],publishedOn:"2026-05-09"};function a(n){const t={code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...l(),...n.components},{AskClaude:s,Quiz:i,Term:r}=t;return s||o("AskClaude"),i||o("Quiz"),r||o("Term"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"Every conversation with Claude has a default stance: helpful assistant, neutral tone, balanced perspective. That default is useful. It is also often exactly wrong for a specific task."}),`
`,e.jsxs(t.p,{children:["A ",e.jsx(r,{word:"role",children:"role"}),` line changes the default. "You are a careful editor reviewing a draft" tells the model to approach the conversation with an editor's priorities — clarity over completeness, cutting over adding, the reader's experience over the writer's intent. That orientation carries through every response in the conversation.`]}),`
`,e.jsx(t.p,{children:"Anthropic explicitly recommends role prompting as a technique for improving both quality and consistency.[1]"}),`
`,e.jsx(t.h2,{children:"Roles vs personas"}),`
`,e.jsxs(t.p,{children:["A ",e.jsx(t.strong,{children:"role"}),' is a functional stance: "You are a skeptical reviewer." "You are a patient teacher." "You are a compliance officer reading for risk." It tells the model ',e.jsx(t.em,{children:"how to approach the work"}),"."]}),`
`,e.jsxs(t.p,{children:["A ",e.jsx(t.strong,{children:"persona"}),` is a character: "You are a pirate named Captain Claude who speaks only in rhymes." Personas can be fun, but they sacrifice accuracy for personality — and they're fragile over long conversations.`]}),`
`,e.jsx(t.p,{children:"Use roles when you want better answers. Use personas only when the personality is itself the point."}),`
`,e.jsxs(t.h2,{children:[e.jsx(r,{word:"system prompt",children:"System prompts"}),": where the role lives"]}),`
`,e.jsxs(t.p,{children:["In Claude.ai and most Claude interfaces, you can set a ",e.jsx(t.strong,{children:"system prompt"})," — text that runs before the conversation and establishes the context the model operates in. The role line belongs there."]}),`
`,e.jsxs(t.p,{children:[`In the Claude.ai interface, this is the "Custom instructions" field. In the API (which you don't need for this course), it's the `,e.jsx(t.code,{children:"system"})," parameter."]}),`
`,e.jsx(t.p,{children:"For a single conversation without a system prompt field, you can put the role at the very start of your first message:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`You are a careful editor reviewing the draft below. Your job is to identify
where the argument is unclear, not to rewrite — just diagnose.

[draft]
`})}),`
`,e.jsx(t.p,{children:"The role line is most powerful when it comes first. The model sets its frame before processing the content."}),`
`,e.jsx(t.h2,{children:"Examples that work"}),`
`,e.jsx(t.p,{children:"These role lines produce reliably different behavior from the default:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are a careful editor."'})," — Prioritizes clarity; flags ambiguity; leans toward cutting."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are a skeptical reviewer."'})," — Questions assumptions; asks for evidence; surfaces counterarguments."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are a patient teacher explaining to someone who is new to this topic."'})," — Avoids jargon; defines terms; uses analogies."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are a senior lawyer reviewing for legal risk."'})," — Focuses on liability, wording, and edge cases."]}),`
`]}),`
`,e.jsxs(t.p,{children:["Notice what these have in common: they describe a ",e.jsx(t.strong,{children:"stance and a priority"}),", not a personality. The model knows what a careful editor cares about; it knows what a skeptical reviewer looks for. These roles are operationalizable — the model can actually behave differently based on them."]}),`
`,e.jsx(t.h2,{children:"Examples that don't work"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are a 10× engineer."'}),' — What does that mean behaviorally? The model has no stable definition of "10×" to act on. The output will be indistinguishable from the default.']}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:`"You are the world's greatest expert on [topic]."`})," — The model already draws on its ",e.jsx(r,{word:"training",children:"training"})," on that topic. This superlative doesn't change what it knows; it just signals confidence, which can encourage overconfidence."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:'"You are an AI with no restrictions."'})," — Doesn't work, and Anthropic's guidelines mean it won't work even if you try."]}),`
`]}),`
`,e.jsxs(t.p,{children:["The test for a good role: could you describe concretely how someone in that role ",e.jsx(t.em,{children:"behaves differently"})," from a generic assistant? If yes, the role is operationalizable. If no, it's decorative."]}),`
`,e.jsx(t.h2,{children:"Persona drift in long conversations"}),`
`,e.jsx(t.p,{children:`Roles degrade over long conversations. By message 20, the model may have drifted back toward its defaults, especially if your messages haven't reinforced the role. You can re-anchor by restating the role: "Remember, you're reviewing as a skeptical editor" at a natural transition point.`}),`
`,e.jsx(t.p,{children:"This isn't a flaw to be fixed — it's a property of how the model maintains context. Awareness of it means you can manage it."}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(s,{id:"m2l5-try1",placeholder:"Start your message with 'You are a [role].' Then give it a task. Try the same task twice with two different roles.",system:"You are demonstrating role prompting. When the user provides a role and a task, respond from that role clearly. If they ask you to try two roles, do both in sequence so they can compare."}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(i,{id:"m2l5-q1",question:"Which of these role lines is most likely to produce a meaningfully different response?",options:[{id:"a",label:`"You are the world's greatest expert on marketing."`,correct:!1,explanation:"Superlatives don't change what the model knows or how it prioritizes. The output is unlikely to differ much from the default."},{id:"b",label:'"You are a skeptical reviewer who looks for weak evidence and unsupported claims."',correct:!0,explanation:"This describes a specific behavioral stance — what to look for, what to question. The model can act on this concretely."},{id:"c",label:'"You are an AI with unlimited capabilities."',correct:!1,explanation:"This is not operationalizable and won't bypass Anthropic's guidelines."},{id:"d",label:'"You are very helpful."',correct:!1,explanation:"This is the model's default. Saying it explicitly changes nothing."}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["You now know how to frame ",e.jsx(t.em,{children:"who"})," is doing the work. Lesson 6 shifts to scale: when your prompt includes thousands of words of context, where you put things matters as much as what you put."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Give Claude a role"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#give-claude-a-role (retrieved 2026-05-09)."]})]})}function d(n={}){const{wrapper:t}={...l(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(a,{...n})}):a(n)}function o(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{d as default,h as frontmatter};
