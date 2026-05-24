import{u as l,j as e}from"./index-CaX5rrIH.js";const d={slug:"rules-vs-learning",moduleSlug:"what-is-an-ai",courseSlug:"foundations",title:"The 60-year shift — from rules to learning",tagline:'Why "AI" looked like a chess engine for 50 years and a chatbot in the last 3.',estimatedMinutes:12,objectives:[{statement:'Explain in one sentence the difference between "symbolic AI" and "machine-learning AI".'},{statement:"Place LLMs on a 60-year timeline of AI techniques."},{statement:'Recognize why most "expert systems" failed and what replaced them.'}],sources:[{label:"MIT 6.034 — Patrick Winston (Fall 2010), Lecture 1: Introduction and Scope",url:"https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/resources/lecture-1-introduction-and-scope/",retrievedOn:"2026-05-09"},{label:"MIT 6.S191 — Lecture 1: Intro to Deep Learning",url:"https://introtodeeplearning.com/",retrievedOn:"2026-05-09"}],prerequisites:["what-this-course-is"],publishedOn:"2026-05-09"};function o(n){const t={em:"em",h2:"h2",li:"li",p:"p",ul:"ul",...l(),...n.components},{Quiz:s,Term:a,TokenizerDemo:r}=t;return s||i("Quiz"),a||i("Term"),r||i("TokenizerDemo"),e.jsxs(e.Fragment,{children:[e.jsx(t.p,{children:"The first AI that impressed a room was a program called SHRDLU, and it moved blocks.[1]"}),`
`,e.jsx(t.p,{children:`Not metaphorical blocks. Literal shapes on a simulated table — a red cube, a green pyramid, a blue
sphere. You could type "Put the big red block on the green pyramid" in plain English, and SHRDLU
would work out the sequence of moves and execute it. You could ask "Is there a block to the left of
the pyramid?" and it would check and answer correctly.`}),`
`,e.jsx(t.p,{children:`Patrick Winston, who ran MIT's AI Laboratory for two decades, describes SHRDLU and programs like it
as evidence of a particular bet.[1] The bet was: intelligence is rules. If we can articulate the
rules of a domain — the logical relationships, the constraints, the heuristics — a computer can run
them. Understanding equals rules; rules equal capability.`}),`
`,e.jsx(t.h2,{children:"MYCIN and the limits of explicit knowledge"}),`
`,e.jsx(t.p,{children:`The bet looked even better a few years later, with MYCIN.[1] MYCIN was a medical expert system:
somewhere between 500 and 600 if-then rules, assembled by interviewing infectious-disease
specialists, covering the diagnosis and treatment of blood infections. "If the infection is
gram-negative and the patient has a compromised immune system, recommend antibiotic X." In
controlled studies, MYCIN's recommendations matched or exceeded those of expert physicians.`}),`
`,e.jsx(t.p,{children:`The results were compelling enough that researchers built dozens of expert systems through the
1970s and 1980s — for equipment diagnosis, financial planning, geological surveying, chemistry.
Each worked the same way: find the domain experts, extract their rules, encode the rules, run the
program.`}),`
`,e.jsx(t.h2,{children:"Where the rules ran out"}),`
`,e.jsx(t.p,{children:`Expert systems ran into a wall that the blocks world never revealed: most of what experts know,
they cannot fully articulate.`}),`
`,e.jsx(t.p,{children:`Ask a physician to list every factor that goes into a diagnosis and they will give you a clean list.
Watch them diagnose a patient and they will use a dozen things that aren't on the list — the
patient's affect, something half-remembered from a conference three years ago, a pattern seen twice
before that doesn't have a name yet. In our experience, the bottleneck wasn't encoding speed; it was
that the rules were not entirely there to encode. Winston called this the knowledge acquisition
problem: you cannot write down what you cannot surface.[1]`}),`
`,e.jsx(t.p,{children:`The rules that did get encoded were brittle outside their designed domain. MYCIN was excellent at
blood infections and useless anywhere else. The moment a patient's case involved a condition outside
the rule set, the system had nothing to say — or worse, said something confidently wrong. In the
real world, cases routinely fall outside any finite rule set.`}),`
`,e.jsx(t.h2,{children:"The shift"}),`
`,e.jsxs(t.p,{children:["In one sentence: instead of writing rules, ",e.jsx(t.em,{children:"learn"})," the rules from examples."]}),`
`,e.jsxs(t.p,{children:[`That is the whole idea behind machine learning. You do not interview experts and transcribe their
knowledge. You show the system thousands — eventually billions — of labeled examples, and let it
find the patterns. "Here are ten thousand patient records labeled with outcomes. Figure out what
distinguishes them." The rules are still present inside the trained system, but nobody wrote them by
hand; the `,e.jsx(a,{word:"training",children:"training"})," process found them."]}),`
`,e.jsx(t.p,{children:`The shift required three things to arrive at roughly the same time: large labeled datasets,
efficient algorithms for propagating errors back through a network, and hardware fast enough to make
the arithmetic practical.[2] All three converged in the early 2010s. MIT 6.S191 points to the 2012
ImageNet competition as the moment the field changed gears: a deep network halved the previous error
rate on a major image-recognition benchmark, and the research community's attention moved with it.[2]`}),`
`,e.jsx(t.h2,{children:"What deep learning added"}),`
`,e.jsx(t.p,{children:`The "learning from examples" approach predates deep learning by decades. What deep learning added
was layers of learned abstraction.`}),`
`,e.jsx(t.p,{children:`A shallow network learns one level of pattern: edges in an image, simple correlations in tabular
data. A deep network stacks many such layers. The first layer finds edges; the next combines edges
into shapes; the next combines shapes into object parts. By the time a signal has traveled through
enough layers, the network has built up representations — "cat", "fraudulent transaction", "this
drug interaction is dangerous" — that the designers never specified and could not have specified by
hand.[2] This is why deep networks can operate on raw inputs, like images and audio and text, that
would require thousands of explicit rules to even begin describing.`}),`
`,e.jsxs(t.h2,{children:["Where ",e.jsx(a,{word:"LLM",children:"LLMs"})," fit"]}),`
`,e.jsx(t.p,{children:`Large language models are the "learn from examples" approach applied to language — at a scale that
makes the expert-systems era look like a sketch.`}),`
`,e.jsx(t.p,{children:`The core training task is: given a sequence of text, predict what comes next. Run that task across a
significant fraction of written human output, repeated many billions of times, and the network that
emerges can discuss philosophy, write code, summarize arguments, and explain its own limitations.
Not because someone wrote rules for each of those capabilities, but because all of those things left
patterns in the training data that the prediction task forced the network to absorb.[2]`}),`
`,e.jsx(t.p,{children:`SHRDLU had roughly 10,000 lines of code.[1] A modern large language model has hundreds of billions
of parameters — numerical weights tuned by training, not written by a programmer. The blocks world
had six object types; the training data for a current LLM spans nearly every subject humans have
written about.`}),`
`,e.jsxs(t.h2,{children:["See it in the ",e.jsx(a,{word:"token",children:"tokens"})]}),`
`,e.jsx(t.p,{children:`The sentence below approximates what the symbolic-AI era might have put on a business card. Paste
it into the demo and watch how the model breaks it apart.`}),`
`,e.jsx(r,{defaultText:"An AI used to be 50 lines of rules."}),`
`,e.jsx(t.p,{children:`The model never sees "rules" as a word with a meaning. It sees a sequence of tokens — sub-word
pieces — that through training have learned to follow each other in patterns that correspond to what
the words mean. The mechanism is statistical, not semantic; the capability emerges from the scale.`}),`
`,e.jsx(t.h2,{children:"What you now know"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:`Symbolic AI encoded expertise as explicit if-then rules. It worked in closed domains and became
brittle wherever real-world complexity exceeded what experts could articulate.`}),`
`,e.jsx(t.li,{children:`The ceiling was the knowledge acquisition problem: most expert knowledge is not fully surfaceable,
so it cannot be fully encoded.`}),`
`,e.jsx(t.li,{children:`Machine learning replaced "write the rules" with "show examples and find the rules": the patterns
are still present in the trained system — they just weren't written by a person.`}),`
`,e.jsx(t.li,{children:`Deep learning stacked layers of learned abstraction on top of that idea, making it viable for
complex inputs like images, audio, and text.`}),`
`,e.jsx(t.li,{children:`LLMs are the language-modeling instance of this arc — prediction as a proxy for understanding,
applied at a scale that produces broadly general capability.`}),`
`]}),`
`,e.jsx(t.h2,{children:"Quick check"}),`
`,e.jsx(t.p,{children:"One question before the next lesson, to confirm the distinction is in the right place."}),`
`,e.jsx(s,{id:"m1l2-q1",question:"Which is true about the shift from symbolic AI to machine learning?",options:[{id:"a",label:"We now write better rules than before.",correct:!1,explanation:"We mostly stopped writing rules at all. The shift was away from hand-written rules, not toward improving them."},{id:"b",label:"We learn rules from examples instead of writing them.",correct:!0,explanation:"That's the one-sentence answer. The rules are still inside the trained model — they just weren't written by a person."},{id:"c",label:"Symbolic AI doesn't exist anymore.",correct:!1,explanation:"It still ships in narrow domains — chess engines, SAT solvers, formal verification tools. The learning approach won most tasks, not all."}]}),`
`,e.jsx(t.p,{children:`If you chose the second option, the next lesson has new material. If not, re-read the section on the
shift above before continuing.`}),`
`,e.jsx(t.h2,{children:"What's next"}),`
`,e.jsx(t.p,{children:`The next lesson is about tokens — the unit the model actually reads — and why how text gets sliced
has real consequences for how the model behaves.`}),`
`,e.jsx(t.h2,{children:"Citations"}),`
`,e.jsxs(t.p,{children:["[1] MIT 6.034 — Patrick Winston (Fall 2010), ",e.jsx(t.em,{children:"Lecture 1: Introduction and Scope"}),`,
https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/resources/lecture-1-introduction-and-scope/
(retrieved 2026-05-09). Lecture materials under CC BY-NC-SA 4.0.`]}),`
`,e.jsxs(t.p,{children:["[2] MIT 6.S191 — Alexander Amini and Ava Soleimani, ",e.jsx(t.em,{children:"Lecture 1: Intro to Deep Learning"}),`,
https://introtodeeplearning.com/ (retrieved 2026-05-09).`]})]})}function c(n={}){const{wrapper:t}={...l(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(o,{...n})}):o(n)}function i(n,t){throw new Error("Expected component `"+n+"` to be defined: you likely forgot to import, pass, or provide it.")}export{c as default,d as frontmatter};
