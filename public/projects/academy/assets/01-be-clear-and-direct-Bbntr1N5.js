import{u as l,j as e}from"./index-QmZ7u8yN.js";const c={slug:"be-clear-and-direct",moduleSlug:"prompting",courseSlug:"foundations",title:"Be clear and direct",tagline:"The single biggest improvement most people can make to their prompts is to write less casually.",estimatedMinutes:11,objectives:[{statement:"Identify the three most common forms of unclear prompt — assumed context, hedged ask, mixed instructions."},{statement:"Rewrite an unclear prompt into a direct one in under sixty seconds."},{statement:`Recognize when "less polite" is actually clearer (and when it isn't).`}],sources:[{label:"Anthropic — Prompting best practices · General principles · Be clear and direct",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#be-clear-and-direct",retrievedOn:"2026-05-09"},{label:"Anthropic — Prompting best practices · Output and formatting · Communication style and verbosity",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#communication-style-and-verbosity",retrievedOn:"2026-05-09"},{label:"Anthropic — AI Fluency Framework & Foundations · Description module",url:"https://anthropic.skilljar.com/ai-fluency-framework-foundations",retrievedOn:"2026-05-09"}],prerequisites:["why-claude-is-not-google"],publishedOn:"2026-05-09"};function a(n){const t={code:"code",em:"em",h2:"h2",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",...l(),...n.components},{AskClaude:s,Quiz:r,Term:o}=t;return s||i("AskClaude"),r||i("Quiz"),o||i("Term"),e.jsxs(e.Fragment,{children:[e.jsxs(t.p,{children:["If you read only one lesson in this whole module, this is it. The single biggest improvement most people can make to their prompts is to write less ",e.jsx(t.em,{children:"casually"}),"."]}),`
`,e.jsx(t.p,{children:`Anthropic's own prompting reference puts "Be clear and direct" at the top of the list, before any clever technique.[1] That is on purpose. Almost every "the model gave me a useless answer" complaint we see — at Bilko and elsewhere — is, on inspection, a prompt that wasn't clear about what was being asked.`}),`
`,e.jsx(t.p,{children:"This lesson covers three patterns that quietly kill prompts, and a 60-second rewrite drill you can apply to any of them."}),`
`,e.jsx(t.h2,{children:"Pattern 1 — Assumed context"}),`
`,e.jsx(t.p,{children:"The most common bug. You know what you're asking; the model doesn't. You wrote:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Make this shorter.
`})}),`
`,e.jsxs(t.p,{children:["The model has no idea what ",e.jsx(t.em,{children:"this"})," is, what shorter means (half? a tweet? a line?), what the audience is, or what you intend to do with the output."]}),`
`,e.jsx(t.p,{children:"The fix is one line of context. Compare:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Rewrite the email below to half its length, keeping the meeting time and the
ask. Audience is my boss; tone should stay professional but warm.

[email goes here]
`})}),`
`,e.jsxs(t.p,{children:["Same intent. Tenfold better answer. The pattern is: state the ",e.jsx(t.strong,{children:"task"}),", the ",e.jsx(t.strong,{children:"constraint"})," (half length), the ",e.jsx(t.strong,{children:"must-keeps"})," (meeting time, ask), and the ",e.jsx(t.strong,{children:"audience"}),`. Anthropic phrases this as "give Claude as much context as you would give a smart, busy colleague who's helping you for the first time."[2]`]}),`
`,e.jsxs(t.p,{children:[`The "smart busy colleague" frame is worth dwelling on. A smart colleague doesn't ask you to re-explain your entire project before answering a question, but they `,e.jsx(t.em,{children:"do"})," need to know the basics: what are we doing, for whom, and what does success look like? When you imagine writing a message to that person — someone capable but without ESP — you naturally include the context they'd need. That's the bar."]}),`
`,e.jsx(t.p,{children:"Notice what isn't in the good prompt above: your personal history with this email, whether you've tried rewriting it before, why you're writing to your boss, or any of the background your brain supplies automatically. You don't need any of that. Just the task, the constraint, the must-keeps, and the audience."}),`
`,e.jsx(t.h2,{children:"Pattern 2 — Hedged ask"}),`
`,e.jsx(t.p,{children:"The polite-British-email pattern. Sounds like:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`I was wondering if you could maybe help me draft something that's sort of like
a thank-you note, but only if you have ideas?
`})}),`
`,e.jsx(t.p,{children:`The model can't tell whether you're actually asking or making conversation. It often hedges back — "I'd be happy to help! What kind of thank-you note?" — wasting a round-trip.`}),`
`,e.jsxs(t.p,{children:["Make the ask. Lose the hedges. ",e.jsx(t.strong,{children:'"Draft a thank-you note from me to my landlord for fixing the leaking sink. One paragraph, friendly but not gushing."'})," That's a prompt the model can act on."]}),`
`,e.jsxs(t.p,{children:["This isn't a personality lesson; it's an information-density lesson. Every hedge is a ",e.jsx(o,{word:"token",children:"token"})," spent saying nothing."]}),`
`,e.jsxs(t.p,{children:["Here is a direct comparison. Left column is a typical hedged prompt, right column is the same request stripped clean. The output quality difference is substantial even though the ",e.jsx(t.em,{children:"intent"})," is identical."]}),`
`,e.jsx(t.p,{children:`| Hedged | Direct |
|---|---|
| "I was wondering if you could maybe look at this paragraph and possibly give some feedback?" | "Edit the paragraph below for clarity. Cut anything redundant. Keep the voice." |
| "Could you sort of summarize this if it's not too long?" | "Summarize in three bullet points." |
| "I'm not sure if this makes sense but could you help?" | "Rewrite this to make it clearer. Here's what I'm trying to say: [statement]." |`}),`
`,e.jsx(t.p,{children:"None of the direct versions are rude. They're just unambiguous. The model doesn't perceive hedging as politeness — it perceives it as ambiguity, and responds accordingly."}),`
`,e.jsx(t.h2,{children:"Pattern 3 — Mixed instructions"}),`
`,e.jsx(t.p,{children:"Two prompts in one. Sounds like:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Summarize this article and tell me if I should care, and write a tweet about
it, and find any errors.
`})}),`
`,e.jsx(t.p,{children:"The model picks two of those four to do well, and does the other two badly. Every multi-task prompt is a coin toss on which task gets full attention."}),`
`,e.jsxs(t.p,{children:["The fix is to ",e.jsx(t.strong,{children:"chain"})," the requests across separate turns (we'll dedicate Lesson 7 to this). Or, if you're staying in one turn, number them and ask the model to address each explicitly:"]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`Do the following, in order. Answer each numbered point.
1. One-sentence summary of the article.
2. Honest verdict: should a busy product manager spend time reading this? Yes/No + one line of why.
3. A tweet (under 240 chars) that I could post.
4. Any factual errors you spotted, with quotes.
`})}),`
`,e.jsx(t.p,{children:"That works because each ask is now self-contained. The model can't accidentally drop item 3 when it gets absorbed in item 4, because the numbered list makes each item a discrete commitment."}),`
`,e.jsx(t.p,{children:`The numbered format is especially useful for reviews and critiques: "1. What's strongest? 2. What's weakest? 3. What's one concrete suggestion?" rather than "What do you think of this?"`}),`
`,e.jsx(t.h2,{children:"The 60-second rewrite drill"}),`
`,e.jsx(t.p,{children:"Take a recent prompt of yours that the model handled poorly. Run it through these four questions, in order, and rewrite as you go."}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Task"})," — am I stating, in a verb, what I want done?"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Context"})," — does the model know what ",e.jsx(t.em,{children:"this"})," is and who it's for?"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Constraints"})," — length, tone, format, must-keeps?"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Verification"})," — what would a good answer look like, in one phrase?"]}),`
`]}),`
`,e.jsxs(t.p,{children:[`That's the entire move. You'll find Anthropic's "AI Fluency" course teaches the same thing under the name `,e.jsx(t.strong,{children:"Description"}),`, the second of its 4Ds.[3] We're calling it "be clear and direct" because that's what it actually is.`]}),`
`,e.jsxs(t.p,{children:["One concrete tip on the verification question: don't skip it. The first three questions help you write a better prompt; the fourth helps you ",e.jsx(t.em,{children:"know"}),` whether you got a better answer. "A good answer would be a five-bullet list where each bullet has a concrete action item" is a much sharper test than "a good answer would be helpful." If you can't state what good looks like before you send, you're going to struggle to evaluate what comes back.`]}),`
`,e.jsx(t.h2,{children:"When less polite is actually clearer"}),`
`,e.jsxs(t.p,{children:["A counterintuitive note: a friendlier tone in a prompt does not produce a friendlier answer. The model isn't reading your tone; it's reading your ",e.jsx(t.strong,{children:"instructions"}),'. "Please could you possibly draft" and "draft" produce nearly identical outputs — the second one is just shorter and drops zero meaning.']}),`
`,e.jsx(t.p,{children:"Anthropic's own guidance is explicit that the model does not perceive politeness as a meaningful signal.[1] So drop the social padding from prompts. Save it for humans."}),`
`,e.jsxs(t.p,{children:["There is one exception worth naming. When you're using Claude as a writing collaborator on emotionally loaded content — condolence notes, hard conversations, apology letters — your prompt's tone ",e.jsx(t.em,{children:"can"})," leak into the answer's tone. A kinder prompt can produce a kinder draft. This isn't because the model is picking up your emotional register; it's because a kinder prompt typically contains more specific language about ",e.jsx(t.em,{children:"what kind of kind"}),` you want. "Warm but not performatively sad" is more informative than "write a condolence note." We'll come back to this in Lesson 5 when we cover `,e.jsx(o,{word:"role",children:"roles"}),"."]}),`
`,e.jsx(t.p,{children:"Outside of emotionally loaded writing tasks, the general rule holds: cut the hedges, make the ask."}),`
`,e.jsx(t.h2,{children:"Verbosity in the other direction"}),`
`,e.jsx(t.p,{children:"There is an opposite failure worth mentioning. Some people, after reading advice like this, swing to the other extreme and write prompts that are so detailed they're hard to parse. A paragraph of context, three paragraphs of constraints, a four-point rubric, and a one-line actual request buried at the end."}),`
`,e.jsxs(t.p,{children:["Anthropic's guidance on communication style and verbosity[2] is symmetric: the model should neither pad its responses nor truncate them, and the same principle applies to your prompts. Clear means ",e.jsx(t.em,{children:"appropriately complete"})," — not minimal, not exhaustive. If you find yourself writing more than two paragraphs of context for a single-turn question, consider whether you're providing context or working through your own thinking in the prompt box."]}),`
`,e.jsx(t.p,{children:"The drill in the previous section is anti-bloat by design. Four questions. Rewrite. Done."}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(s,{id:"m2l1-try1",placeholder:"Paste a recent unclear prompt of yours, or write a new one from scratch.",system:"You are an editor reviewing a user's prompt to Claude. Tell the user, in three short bullet points, what task / context / constraints / verification the prompt is missing. Do not rewrite it — just diagnose."}),`
`,e.jsx(t.p,{children:"Submit and see what your prompt is missing. Then rewrite it and submit again."}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(r,{id:"m2l1-q1",question:"Which of these prompts is clearest by Anthropic's standard?",options:[{id:"a",label:'"Could you possibly help me with my email please."',correct:!1,explanation:"Polite, but no task, no context, no constraints. The model can't act on it."},{id:"b",label:'"Make this better."',correct:!1,explanation:"What is 'this'? What does 'better' mean? Pure assumed-context failure."},{id:"c",label:'"Rewrite the email below to be 50% shorter while keeping the meeting time and the ask. Audience: my boss. Tone: professional but warm.\\n\\n[email]"',correct:!0,explanation:"Task ('rewrite'), constraints (50% shorter, must-keeps), audience (boss), tone (warm-professional). The model can act on this."},{id:"d",label:'"Summarize, score, rewrite, and post the article."',correct:!1,explanation:"Four tasks at once. Even when each is reasonable, the mix usually produces sloppy output. Chain across turns instead (Lesson 7)."}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["You now have the ",e.jsx(t.em,{children:"skeleton"})," of a clear prompt. Lesson 2 fills it in: how to add context — who, what, why, what-good-looks-like — without writing a novel."]}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · General principles · Be clear and direct"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#be-clear-and-direct (retrieved 2026-05-09)."]}),`
`,e.jsxs(t.p,{children:["[2] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Output and formatting · Communication style and verbosity"}),', https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#communication-style-and-verbosity (retrieved 2026-05-09). The "smart, busy colleague" framing appears in the Add context section of the same doc.']}),`
`,e.jsxs(t.p,{children:["[3] Anthropic — ",e.jsx(t.em,{children:"AI Fluency: Framework & Foundations"}),", Description module, https://anthropic.skilljar.com/ai-fluency-framework-foundations (retrieved 2026-05-09)."]})]})}function d(n={}){const{wrapper:t}={...l(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(a,{...n})}):a(n)}function i(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{d as default,c as frontmatter};
