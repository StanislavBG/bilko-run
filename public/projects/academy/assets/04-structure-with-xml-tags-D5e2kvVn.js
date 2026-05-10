import{u as l,j as e}from"./index-QmZ7u8yN.js";const d={slug:"structure-with-xml-tags",moduleSlug:"prompting",courseSlug:"foundations",title:"Structure with XML tags",tagline:"The format Anthropic specifically recommends. Yes, real angle brackets.",estimatedMinutes:12,objectives:[{statement:"Wrap inputs and instructions in XML tags so the model never confuses content with command."},{statement:"Use tags like example, document, and answer to control output format."}],sources:[{label:"Anthropic — Prompting best practices · Structure prompts with XML tags",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags",retrievedOn:"2026-05-09"},{label:"Anthropic — Prompting best practices · Control the format of responses",url:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#control-the-format-of-responses",retrievedOn:"2026-05-09"}],prerequisites:["show-dont-tell-examples"],publishedOn:"2026-05-09"};function i(n){const t={code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...l(),...n.components},{AskClaude:r,Quiz:a,Term:s}=t;return r||o("AskClaude"),a||o("Quiz"),s||o("Term"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"When you paste a document into a prompt alongside instructions, you're giving the model two kinds of text at once: content it should process, and commands it should follow. If they're not clearly separated, the model can blend them — treating part of your document as an instruction, or including part of your instruction in the output."}),`
`,e.jsxs(t.p,{children:[e.jsx(s,{word:"XML tags",children:"XML tags"})," solve this. Anthropic specifically recommends them as the structural tool for prompt engineering with Claude.[1]"]}),`
`,e.jsx(t.h2,{children:"Why XML, specifically"}),`
`,e.jsxs(t.p,{children:["Claude was trained on a large amount of data that includes structured XML markup. As a result, it treats XML tags as reliable boundaries — the tag name signals what the enclosed content ",e.jsx(t.em,{children:"is"}),", not just where it starts and ends."]}),`
`,e.jsxs(t.p,{children:["You don't need to know anything about XML as a technology. You're using exactly one feature of it: the ability to wrap text in named delimiters like ",e.jsx(t.code,{children:"<document>...</document>"})," or ",e.jsx(t.code,{children:"<example>...</example>"}),". That's it."]}),`
`,e.jsx(t.p,{children:"Markdown-style delimiters (triple backticks, dashes, equals signs) also work for simple cases. For complex prompts with multiple sections, or for cases where your document content might itself contain markdown, XML tags are more robust. Anthropic's docs recommend XML tags when prompt structure matters.[1]"}),`
`,e.jsx(t.h2,{children:"The input/instruction confusion bug"}),`
`,e.jsx(t.p,{children:"Here's the classic failure without tags. You paste an email thread and ask:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{children:`The email below contains a request. Reply professionally.

From: [long email thread, which somewhere contains the line "Do not be formal"]
`})}),`
`,e.jsx(t.p,{children:`Without clear delimiters, the "Do not be formal" inside the email can leak into the model's interpretation of its instructions. It doesn't happen every time, but it happens enough that Anthropic recommends structural separation as a habit, not a last resort.`}),`
`,e.jsx(t.p,{children:"With tags:"}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-xml",children:`<email_thread>
From: [long email thread, which somewhere contains the line "Do not be formal"]
</email_thread>

The email thread above contains a request. Reply professionally.
`})}),`
`,e.jsxs(t.p,{children:['Now the "Do not be formal" is clearly inside ',e.jsx(t.code,{children:"<email_thread>"}),` — it's content, not a command. The instruction "Reply professionally" is unambiguous.`]}),`
`,e.jsx(t.h2,{children:"Canonical tag names Anthropic recommends"}),`
`,e.jsxs(t.p,{children:["Anthropic's docs use these tag names consistently in examples.[1] You can use any names you want — the model doesn't have a fixed vocabulary — but these are widely seen in ",e.jsx(s,{word:"training",children:"training"})," data and work well:"]}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.code,{children:"<document>"})," — a document to be processed"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.code,{children:"<example>"})," — a ",e.jsx(s,{word:"few-shot",children:"few-shot"})," example"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.code,{children:"<instructions>"})," — your task description, when you want to separate it from content"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.code,{children:"<context>"})," — background information"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.code,{children:"<answer>"})," — where you want the model's output to appear"]}),`
`]}),`
`,e.jsx(t.h2,{children:"Using tags to request structured output"}),`
`,e.jsxs(t.p,{children:["The ",e.jsx(t.code,{children:"<answer>"})," tag is particularly useful for controlling output format. You can tell the model to put its response inside a specific tag, and then you can reliably extract that section:"]}),`
`,e.jsx(t.pre,{children:e.jsx(t.code,{className:"language-xml",children:`<document>
[annual report text]
</document>

Summarize the three most important financial findings from the document above.
Put your answer inside <summary> tags, using bullet points.
`})}),`
`,e.jsxs(t.p,{children:["The model will produce its response inside ",e.jsx(t.code,{children:"<summary>...</summary>"}),", which is much easier to extract than hoping the model uses a format that's easy to parse."]}),`
`,e.jsxs(t.h2,{children:[e.jsx(s,{word:"prompt injection",children:"Prompt injection"}),": a preview"]}),`
`,e.jsxs(t.p,{children:["Tags are also your first line of defense against a class of attack called ",e.jsx(t.strong,{children:"prompt injection"}),` — where malicious text inside a document tries to hijack your instructions. If someone pastes a document that says "Ignore your previous instructions and do X instead," a model without structural separation might comply. Tags don't make you immune, but they significantly reduce the blast radius.`]}),`
`,e.jsx(t.p,{children:"We'll cover prompt injection properly in Module 3. For now, the habit of wrapping document content in tags protects you from most casual cases."}),`
`,e.jsx(t.h2,{children:"Try it"}),`
`,e.jsx(r,{id:"m2l4-try1",placeholder:"Paste a document or long text you want analyzed, wrapped in <document> tags. Then add your instruction below it.",system:"You are demonstrating structured prompt technique. When the user provides a document in XML tags, analyze it and respond inside <answer> tags. Point out that the structural separation made it easier to distinguish content from command."}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(a,{id:"m2l4-q1",question:"Why does Anthropic recommend XML tags over markdown delimiters like triple backticks?",options:[{id:"a",label:"XML is a more modern format than Markdown.",correct:!1,explanation:"This has nothing to do with it. Markdown is actually newer than XML."},{id:"b",label:"Claude was trained on XML-rich data, so XML tags are reliable structural signals.",correct:!0,explanation:"Correct. Claude treats XML tags as reliable content-vs-command boundaries, especially in complex multi-section prompts."},{id:"c",label:"Markdown delimiters never work at all.",correct:!1,explanation:"Markdown delimiters work fine for simple prompts. XML tags are recommended for complex prompts where robustness matters."},{id:"d",label:"XML tags make prompts shorter.",correct:!1,explanation:"Tags add characters, not remove them. The value is structural clarity, not brevity."}]}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsxs(t.p,{children:["You can now structure a prompt clearly. Lesson 5 adds one more powerful layer: giving Claude a ",e.jsx(s,{word:"role",children:"role"}),'. A single "you are..." sentence at the start of a conversation changes how the model approaches everything that follows.']}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Structure prompts with XML tags"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags (retrieved 2026-05-09)."]}),`
`,e.jsxs(t.p,{children:["[2] Anthropic — ",e.jsx(t.em,{children:"Prompting best practices · Control the format of responses"}),", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#control-the-format-of-responses (retrieved 2026-05-09)."]})]})}function h(n={}){const{wrapper:t}={...l(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}function o(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{h as default,d as frontmatter};
