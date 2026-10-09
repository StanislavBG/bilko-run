# Bilko Academy — market research & design brief

Reference doc that grounds the Academy PRD set (51–62). Read this before picking up any PRD in this
series — it is the "why" behind every content and UX choice.

---

## Why this exists

**"The academy on Bilko is pretty sad place."** That quote was Bilko's own verdict on what currently
lives at `bilko.run/academy`: five lessons, one fully written, four stubs behind a "Cooking" banner,
no citations, no exercises, no consistent visual language. The in-repo Academy was the right call at
the time — ship the concept, see if anyone clicks. They do. But the gap between what's promised
("five levels of AI fluency, free to all, opinionated as hell") and what's delivered (one live lesson
and four outlines) is large enough to make the whole section feel like a placeholder rather than a
resource.

The new Bilko Academy at `/projects/academy/` is the answer — not a replacement for the in-repo
experience, but a parallel track aimed at a different audience. The in-repo Academy trains builders:
people who are wiring models into products and want an opinionated shortcut. The new sibling trains
*everyone else*: the marketer who doesn't know what a token is, the manager trying to evaluate AI
vendors, the designer wondering whether their job still exists. Three modules (~25 lessons), deeply
cited, interactive without being gamified, and built in the open as MDX in its own repo. This document
is the canonical research brief every later PRD draws from.

---

## Existing in-repo Academy audit

Pre-flight confirms: `~/Projects/Bilko-Academy/` **does not exist**. Architecture decision is
unconstrained by an existing repo.

The in-repo Academy lives at `src/pages/AcademyPage.tsx` (38 lines) and
`src/data/academy/lessons.tsx` (302 lines). Lesson names and taglines, verbatim:

| Level | Name | Tagline | Status |
|---|---|---|---|
| 01 | **Beginner** | "What an LLM actually is. No mystique, no metaphors that don't hold up." | live (22 min) |
| 02 | **Conversant** | "Prompting, context, and when to give up. The shape of a request that works." | cooking (25 min) |
| 03 | **Builder** | "Wiring models into real apps. Typed outputs, retries, cost ceilings." | cooking (28 min) |
| 04 | **Operator** | "Background agents, schedulers, observability. Tools that run while you sleep." | cooking (27 min) |
| 05 | **Architect** | "Rules-first systems that scale to many flows. Governance as code." | cooking (30 min) |

The page header reads: *"Five levels of AI fluency, free to all, opinionated as hell. Start at zero,
end as someone who can wire a model into a real product."*

These five lessons are deliberately builder-track. They use phrases like "wiring models into real
apps," "idempotency keys," and "DAG-validated flow specs" — vocabulary that assumes the reader is
comfortable with code and infra. The new sibling serves a pre-code audience. We cross-link both ways
(PRD 61), never merge them.

---

## Top 10 published AI-fundamentals destinations surveyed (2026)

Sourced from live web fetches (2026-05-09) and longstanding knowledge of course catalogs. We're
calling out **10 features** per destination — not the full catalog, but the ones that define its
pedagogical character.

### 1. [Anthropic Academy](https://anthropic.skilljar.com/) — Skilljar platform

17 courses at time of survey, free registration. Audiences span end-users, educators, developers, and
nonprofits. Courses are video-first with assessments; certificates issued on completion.

1. **Wide course spectrum**: from "Claude 101" (everyday use) to "Building with the Claude API" (developers) and "Model Context Protocol: Advanced Topics" (engineers)
2. **Educator track**: "AI Fluency for Educators," "Teaching AI Fluency," "AI Fluency for Students" — explicit academic audience segmentation
3. **Nonprofit vertical**: "AI Fluency for Nonprofits" — mission-driven framing, not product marketing
4. **Certificate gating**: completion certificate requires passing a final assessment — credential-forward design
5. **Free access**: no paywall on core courses; email registration required
6. **Video-first**: lessons are primarily screencast/slide recordings, not prose
7. **Partner-developed content**: AI Fluency co-developed with University College Cork and Ringling College — academic legitimacy signaling
8. **Platform lock-in**: Skilljar player, no embed, no offline, no MDX
9. **Agent skills courses**: "Introduction to Agent Skills," "Introduction to Subagents" — forward-looking Claude Code content
10. **AI Capabilities and Limitations**: a standalone intro course for complete beginners, distinct from the Fluency series

### 2. [AI Fluency: Framework & Foundations](https://anthropic.skilljar.com/ai-fluency-framework-foundations) — Anthropic flagship non-technical course

The marquee entry-level course. 7 modules, co-produced with University College Cork and Ringling
College. The 4D framework (Delegation, Description, Discernment, Diligence) is its organizing spine.

1. **4D framework**: four Ds as a cognitive scaffold — memorable, teachable, assessable
2. **"Delegation" module**: introduces when and how to hand work to an AI — task decomposition framing
3. **"Description" module**: covers effective prompting techniques in non-technical language
4. **"Discernment" module**: teaches the Description-Discernment loop — prompt → evaluate → reprompt
5. **"Diligence" module**: ethics, responsibility, verification before acting on AI output
6. **Certificate of completion** via assessment — credential for LinkedIn profiles
7. **Layered audience design**: works for AI newcomers and experienced practitioners (per course copy)
8. **"Why do we need AI Fluency?" intro lesson** — explicitly frames the problem before teaching the skill
9. **Generative AI fundamentals module**: includes capabilities & limitations in a non-frightening framing
10. **Additional activities section** after certificate — extends learning beyond the graded path

### 3. [Anthropic Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — developer reference

The authoritative reference for Claude-specific prompt engineering. As of 2026-05-09, includes both
general principles and Claude Opus 4.7-specific guidance.

1. **General principles section**: Be clear and direct → Add context → Use examples effectively → XML tags → System prompts → Chain of thought
2. **Model-specific tuning**: Opus 4.7 section covers verbosity, effort levels, tool triggering, tone, subagent spawning
3. **"Brilliant but new employee" metaphor**: the canonical mental model for prompt specificity
4. **Concrete examples**: every principle has a "less effective → more effective" pair
5. **Effort levels**: `max / xhigh / high / medium / low` — teaching resource for cost/quality tradeoffs
6. **Live page, evolving**: updated for each major model release — not a static textbook
7. **Code-adjacent audience**: assumes API access; not written for non-technical readers
8. **Cross-referenced**: links to models overview, migration guides, specific feature docs
9. **Tip/Note callout components**: structured callouts distinguish "important" from "nice to know"
10. **No exercises**: reference doc, not a course — no interactivity or checkpoints

### 4. [MIT 6.S191 Intro to Deep Learning](https://introtodeeplearning.com/) — Amini & Amini, annual

Annual MIT course, 2026 edition ran March–May. 9 lectures, materials MIT-licensed ("copyrighted under
the MIT license, attribution required: © Alexander Amini and Ava Amini"). Guest lecturers from
industry.

1. **Annual refresh**: 2026 edition, always current — guest lecturers from Liquid AI, Microsoft, Comet ML
2. **Lecture 1 "Intro to Deep Learning"**: the canonical starting point for neural nets
3. **MIT license with attribution**: freely reusable with credit; embeddable with quote
4. **Guest lecture track**: "AI for Science" (Chris Bishop/Microsoft), "Secrets to Massively Parallel Training" (Mathias Lechner/Liquid AI)
5. **"The Three Laws of AI" lecture (Lecture 9)**: safety/ethics framing by Douglas Blank, Comet ML
6. **Slide PDFs available**: each lecture's slides are downloadable — high-quality visual references
7. **Not non-technical**: heavy notation, assumes calculus; module-level description is borrowable, not the math
8. **YouTube playlist**: all lectures publicly available, embeddable
9. **Lab notebooks**: practical Jupyter exercises, TensorFlow-based
10. **Deep Learning textbook companion**: Goodfellow et al. — links provided but not required

### 5. [MIT 6.034 Artificial Intelligence (Fall 2010)](https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/) — Patrick Winston

Patrick Winston's definitive AI survey. 23 recorded lectures from 2010, still taught from. License:
**CC BY-NC-SA 4.0** — freely usable with attribution, non-commercially, share-alike.

1. **"Introduction and Scope" (Lecture 1)**: Winston's framing of the 60-year arc from rules to learning — the best single lecture for Module 1 L2
2. **Lecture 12A+B "Neural Nets / Deep Neural Nets"**: pre-transformer but conceptually clean; good historical anchor
3. **"Identification Trees, Disorder" (Lecture 11)**: decision trees explained by a master; non-technical accessible
4. **"Reasoning: Goal Trees and Rule-Based Expert Systems" (Lectures 2–3)**: where rules-based AI came from
5. **Winston's delivery style**: Socratic, builds intuition before formalism — rare in CS lectures
6. **CC BY-NC-SA 4.0 license**: direct quote allowed for non-commercial education with attribution
7. **23 lectures**: comprehensive survey of classical and early-ML AI — historical grounding
8. **No code**: almost entirely conceptual — accessible without programming background
9. **Free on YouTube**: all lectures linked from OCW page
10. **Archive quality**: video is 2010 standard-def but content is timeless; Winston died in 2019 — this is the definitive version

### 6. [3Blue1Brown — Neural Networks](https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi) — Grant Sanderson

The visual explanation standard for how neural networks actually work. 7-chapter series; chapters 5–7
cover transformers and LLMs. No license stated for video content, but Grant Sanderson's stated policy
is: personal and educational use is fine; don't profit from it. Linking, embedding, quoting brief
segments is accepted practice.

1. **Chapter 1 "But what is a neural network?"**: 19-min visual intro; the clearest explanation of neurons, weights, biases
2. **Chapter 2 "Gradient descent, how neural networks learn"**: visual descent animation that has become the genre standard
3. **Chapter 3+4 "Backpropagation"**: conceptual + calculus version; non-technical learners stop at Ch 3
4. **Chapter 5 "But what is a GPT?"**: visual intro to transformers — directly relevant to Module 1
5. **Chapter 6 "Attention in transformers, visually explained"**: the attention mechanism without matrix math
6. **Chapter 7 "How might LLMs store facts?"**: mechanistic interpretability framing, accessible
7. **Animation-as-proof**: Sanderson's core method — complex structures rendered as evolving geometry
8. **No paywall, no login**: YouTube embeds freely; closed captions available
9. **Companion Manim animations**: open-source; some are replicable for custom diagrams
10. **High production value**: sets the visual bar for what math/CS education can look like

### 7. [Andrej Karpathy — Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)

One-hour standalone lecture from the former Tesla AI director and OpenAI co-founder. Published 2023,
still the best single-video orientation for what LLMs are. No formal license; embedding and classroom
use are universally accepted.

1. **"Two-file neural network"**: the opening frame — a model is just weights + inference code
2. **Tokenization explained practically**: Byte Pair Encoding in plain language, with why it matters
3. **Transformer architecture sketch**: enough to understand what's happening without graduate math
4. **RLHF framing**: "the assistant" is trained separately from the base model — important distinction
5. **Tool use preview**: brief coverage of how models call external functions
6. **"LLM OS" analogy**: positions LLMs as operating systems with processes, memory, IO
7. **Hallucination mechanics**: explains *why* models confabulate in terms of next-token prediction
8. **Security framing**: prompt injection introduced as a real threat — good Module 3 seed
9. **No prerequisites**: deliberately beginner-accessible; Karpathy is explicit about the intended audience
10. **60 minutes, self-contained**: single-sitting format works for non-technical learners

### 8. [fast.ai Practical Deep Learning](https://course.fast.ai/) — Jeremy Howard

Nine-lesson, top-down, code-first course. Starts with a working image classifier and works backward
to theory. Free and open (Apache 2.0 for code; CC BY 4.0 for materials).

1. **Top-down methodology**: full working application first, theory second — "practical experience before academic foundations"
2. **"Getting started" → working classifier in Lesson 1**: radical contrast with textbook-order curricula
3. **Lesson 9 "Bonus: Data ethics"**: ethics isn't an afterthought — it's in the syllabus
4. **Jupyter Notebooks**: code-first; interactive and immediately runnable
5. **Jeremy Howard narration style**: opinionated, fast-paced, jargon-challenged — "if I use a term you don't know, ask"
6. **Apache 2.0 code license**: notebooks freely reusable with attribution
7. **Forums-based support**: fast.ai community is the support layer, not paid TA hours
8. **No certificates**: deliberately credential-free — counter-Coursera positioning
9. **Re-runnable annually**: updated regularly; 2024 edition covers diffusion models and LLMs
10. **fastai library**: wrapper on PyTorch that hides boilerplate; teaches concepts not library APIs

### 9. [DeepLearning.AI Short Courses](https://www.deeplearning.ai/short-courses/) — Andrew Ng / partners

1–3 hour courses on specific techniques, co-developed with Anthropic, OpenAI, Google, Hugging Face.
Free to audit; certification track available.

1. **Bite-sized format**: 1–3 hours each — very low commitment threshold for beginners
2. **Partner co-production**: Anthropic, OpenAI, Hugging Face as instructors adds credibility
3. **Topic-specific**: LangChain, RAG, prompt engineering, agents — not survey courses
4. **Jupyter-based**: same code-first delivery as fast.ai but shorter
5. **Free to start**: access without payment; upsell is the DeepLearning.AI specialization track
6. **Anthropic-specific course**: "Prompt Engineering with Claude" is a direct competitor/complement
7. **Andrew Ng brand**: carries enormous AI education trust — his Coursera ML course defined the genre
8. **Rapid update cadence**: new courses added monthly, keeping up with model releases
9. **Video + notebook combo**: structured as lecture → notebook → quiz per lesson
10. **Foundational Specializations**: for learners who want depth, the full ML Specialization stacks onto short courses

### 10. [OCW 18.06 Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) — Gilbert Strang

The math primer. 34 lectures, CC BY-NC-SA 4.0. Not an AI course — it's the math that makes AI
understandable. Linked as a reference, not embedded directly. Used when Module 1 learners ask "what
is a vector?"

1. **Lecture 1 "The Geometry of Linear Equations"**: best visual intro to what matrices actually do
2. **34 lectures, freely downloadable**: OCW provides video, notes, and problem sets
3. **CC BY-NC-SA 4.0**: quotable, linkable, embeddable for non-commercial education with attribution
4. **Strang's teaching style**: the "so that's the key idea" pattern — insight-first, proof-second
5. **No prerequisites**: only high school algebra; accessible to non-technical learners
6. **Matrix multiplication explained geometrically**: transforms, not numbers — the right mental model for embeddings
7. **Not assigned directly**: linked in "want to go deeper" panels, never required reading
8. **Eigenvalues and eigenvectors**: 15 minutes in, Strang makes them feel inevitable
9. **Text companion**: "Introduction to Linear Algebra" (Strang) widely available
10. **Timeless**: 2010 recording, still the best single linear algebra resource on the internet

---

## Synthesized feature catalog

Every recurring feature, grouped. This is the canonical list the Bilko-Academy PRDs draw from.
**Bold** = in scope for v1. *Italic* = explicitly deferred.

### Curriculum & content
- **Course → Module → Lesson → Section hierarchy** (3 modules, ~25 lessons, sections within each lesson)
- **Prerequisite graph** (each lesson lists what the learner needs to have read first)
- **Per-lesson citation panel** (footnotes panel at bottom; every assertion links out)
- **Estimated read time per lesson** (shown in the lesson list and in the lesson header)
- *Advanced track (builder-overlap with in-repo Academy)*
- *Search across lessons*

### Reading experience
- **Single-column prose layout** (max 65ch, 1.7 leading, system font)
- **Progress rail** (thin vertical bar on desktop; shows position in lesson)
- **Light / dark / sepia themes** (system default; user override via settings toggle)
- **Section anchors** (each H2 has a `#slug` link icon on hover — linkable to specific sections)
- **Estimated minutes** in header strip
- *Bookmarks (local storage)*
- *Full offline reading*

### Interactivity
- **`<Quiz>` component** — 1–3 questions per lesson; no score, no retry pressure; just "check understanding"
- **`<Reflect>` prompt** — open-ended text area, never submitted; invitation to think, not to answer
- **`<AskClaude>` BYOK widget** — bring-your-own API key, runs a lesson exercise against Claude directly
- **`<TokenizerDemo>` interactive** — type text, watch tokens light up (Anthropic tokenizer API or local)
- *`<DragMatch>` — match concept to definition*
- *Embedded code sandbox (JSFiddle / StackBlitz)*

### Daily / retention (deliberately minimal)
- **No streaks** — lesson completion is tracked locally; no loss state, no FOMO
- **No push notifications** — no email drip, no re-engagement
- **"Continue reading" on return** — local storage saves scroll position per lesson
- *Opt-in weekly digest ("here's what's new")*

### Stats / progress
- **Local-only progress by default** (localStorage; no server write unless signed in)
- **Lesson completion checkmarks** in the lesson list (green dot; persisted locally)
- **Module completion banner** shown on the module index page
- *Cloud sync when signed in via Bilko/Clerk*
- *Progress visible on Bilko profile page*

### Visual & feel
- **Apple-grade typography**: Inter / SF Pro Text / system-ui, max 65ch
- **Generous leading**: 1.7 body, 1.3 headings
- **Sepia mode**: `--paper-sepia: #f6f0e3` / `--ink-sepia: #3a2f1f`
- **Dark mode via `@media (prefers-color-scheme: dark)`**
- **Reduced-motion**: all transitions degrade to instant when `prefers-reduced-motion: reduce`
- **No animations on scroll** — no parallax, no intersection triggers; reading is calm
- *Custom illustration layer per module*

### Accessibility
- **WCAG AA contrast** (minimum 4.5:1 for body; checked at build time via axe-core)
- **Keyboard navigation**: Tab between interactive components; Escape to close overlays
- **Screen-reader-first markup**: landmark regions, skip-nav, aria-labels on all interactive elements
- **`prefers-reduced-motion` respected** everywhere
- *Voice control (Dragon NaturallySpeaking) tested*

### Platform integration
- **Hosted at `bilko.run/projects/academy/`** as static-path sibling (own repo, own Vite build)
- **Bilko brand chrome** via `@bilkobibitkov/host-kit` (header, footer — same as Sudoku)
- **Free** — no credit cost, no login wall to read
- **Page view telemetry** via `bilko.run/api/analytics/event` (same-origin, Clerk-optional)
- **Cross-link to in-repo Academy** (`bilko.run/academy`) on module index page

---

## Bilko Academy design philosophy

Distilled into 5 rules. Every PRD acceptance criterion ties back to one of these.

### 1. The page is the hero

Typography first, chrome recedes. The reading column is 65ch max — the width at which prose reading
speed peaks. Everything else (navigation, progress, citations) either lives in a persistent sidebar on
desktop or collapses behind a `<details>` toggle on mobile. No hero images competing with the text.
No illustration that decorates rather than explains. If an element doesn't serve comprehension, it
doesn't ship.

### 2. Cite or shut up

Every factual assertion in every lesson links to its source, inline, the way academic writing does.
Not at the end of the page. Not in a "learn more" section. In the sentence. This is unusual in AI
content — most tutorials state things confidently and cite nothing. We're explicitly counter to that.
This rule applies to diagrams too: every diagram has a caption with its source URL.

### 3. Interactive without anxiety

Exercises invite participation; they never gate content. A `<Quiz>` shows the answer immediately when
you check; no "wrong answer" state, no retry counter, no score. A `<Reflect>` prompt is a text box
that disappears when you navigate away — nothing submitted, nothing graded. The `<AskClaude>` widget
runs against your own API key; if it fails, nothing in the lesson breaks. The goal is to give
curious learners a place to try things, not to build a gamification loop.

### 4. Honest about uncertainty

When something is contested, evolving, or depends on the model, we say so. "As of May 2026, Claude's
context window is 200K tokens — this changes with model releases." "Researchers disagree on whether
this constitutes understanding." This is the inverse of content-marketing confidence. Pulled from
Anthropic's "Capabilities and Limitations" framing in AI Fluency Module 2.

### 5. No dark patterns

No email wall. No certificate-gating. No streak loss notifications. No "limited time" offers. No
cookie consent banners we don't legally need (bilko.run uses only first-party analytics, no
third-party ad cookies). The in-repo Academy lives up to "free to all, opinionated as hell"; the
sibling extends that promise to 25 lessons.

---

## Visual specs

These are the precise tokens. Every UI PRD in the Academy set must consume them, not invent siblings.
They inherit from `@bilkobibitkov/host-kit/styles/game-tokens.css` so the Academy stays visually
consistent with bilko.run.

```css
/* Reading column */
--reading-max-width:   65ch;
--reading-line-height: 1.7;
--reading-font-body:   'Inter', 'SF Pro Text', system-ui, sans-serif;
--reading-font-mono:   'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
--reading-font-size:   clamp(17px, 1.05rem + 0.2vw, 20px);

/* Colors — inherit from host-kit game tokens */
--reading-text:        var(--ink);
--reading-muted:       color-mix(in oklch, var(--ink) 60%, transparent);
--reading-rule:        color-mix(in oklch, var(--ink) 12%, transparent);
--reading-link:        var(--entered);      /* SF blue, same as Sudoku user-entered */

/* Sepia mode */
--paper-sepia:         #f6f0e3;
--ink-sepia:           #3a2f1f;

/* Heading scale */
--reading-h1:          clamp(28px, 2rem + 0.5vw, 36px);
--reading-h2:          clamp(22px, 1.5rem + 0.3vw, 28px);
--reading-h3:          clamp(18px, 1.15rem + 0.2vw, 22px);

/* Spacing */
--reading-gap:         clamp(20px, 5vw, 48px);   /* column padding L/R */
--reading-para-gap:    1.5em;                     /* between paragraphs */

/* Progress rail (desktop) */
--rail-width:          3px;
--rail-color:          var(--reading-rule);
--rail-fill:           var(--entered);

/* Callout / blockquote */
--callout-bg:          color-mix(in oklch, var(--entered) 8%, var(--paper));
--callout-border:      var(--entered);
--callout-radius:      6px;

/* Code block */
--code-bg:             color-mix(in oklch, var(--ink) 5%, var(--paper));
--code-radius:         6px;
--code-padding:        0.9em 1.1em;

/* Motion (reading page is calmer than game pages) */
--duration-transition: 180ms;
--easing-default:      cubic-bezier(0.4, 0, 0.2, 1);
```

Every transition respects `@media (prefers-reduced-motion: reduce)` — degrade to `transition: none`.

---

## Layout (mobile-first ASCII sketch)

Single column. Progress rail appears on desktop as a fixed left-side vertical bar.

```
Mobile (< 768px)
┌───────────────────────────────┐
│  bilko · academy        ☰    │  ← host-kit chrome (slim)
├───────────────────────────────┤
│  Module 1 · Lesson 3 of 7    │  ← breadcrumb strip
│  ~12 min read                 │
│  ██████░░░░░░░░░░░░  40%     │  ← progress bar (horizontal on mobile)
├───────────────────────────────┤
│                               │
│  # Why models lie fluently    │  ← lesson body, max 65ch
│                               │
│  A model has no concept of…   │
│                               │
│  [ callout ]                  │
│                               │
│  [interactive: <Quiz>]        │
│                               │
├───────────────────────────────┤
│  ← L2 Tokens       L4 Prob → │  ← prev / next navigation
├───────────────────────────────┤
│  [▸] Citations (3)            │  ← collapsible citations panel
├───────────────────────────────┤
│  bilko footer                 │
└───────────────────────────────┘

Desktop (≥ 1024px) — progress rail appears left of column
┌────┬───────────────────────────────────┬──────────┐
│    │  breadcrumb + reading time        │  TOC →  │
│ │  │                                   │          │
│ │  │  # Lesson heading                 │  § H2-1  │
│ │  │                                   │  § H2-2  │
│ ▓  │  Prose content (65ch max)         │  § H2-3  │
│ ▓  │                                   │          │
│ │  │  [<Quiz>]                         │          │
│    │                                   │          │
│    │  ← prev         next →            │          │
│    ├───────────────────────────────────┤          │
│    │  Citations                        │          │
└────┴───────────────────────────────────┴──────────┘
     ↑                                   ↑
  progress rail (fixed)              floating TOC
  3px, fills on scroll               (sticky, collapses < 1280px)
```

---

## What we copy vs reject

| Source | What we steal | What we explicitly reject |
|---|---|---|
| **Anthropic Academy** | 4D framework as a mental scaffold; "capabilities & limitations" honest framing; educator track idea | Skilljar platform lock-in; certificate-gate; email-required registration; video-only format |
| **AI Fluency course** | Module naming and sequence (what → how → responsible); "Discernment" loop concept | Assessment as gatekeeping; quiz-before-content progression; Ringling College aesthetics |
| **MIT 6.S191** | Lecture 1 as Module 1 L6 source; guest lecturer credibility framing; MIT license allows quoting | Math notation; assumes calculus; lab notebooks are PyTorch, not accessible |
| **Karpathy "Intro to LLMs"** | Tokenization mechanics; "LLM OS" analogy; hallucination as next-token prediction | 60-minute video format (we convert to prose + interactive); no citation practice |
| **fast.ai** | Top-down methodology (use it before explaining it); ethics as a first-class lesson | Code-first (our learners aren't coders); Jupyter notebooks; no-certificate positioning misleads |
| **Duolingo** | Lesson chunking (one concept per lesson); progress indicators; return-to-progress UX | Streaks; hearts/lives; push notifications; streak-repair IAP; leaderboard competition |

---

## Differentiation: what is uniquely Bilko about this

1. **Free + ad-free + no email wall.** Reading starts on arrival. No "enter your email to continue."
   No "3 free lessons then subscribe." The in-repo Academy set this standard; the sibling keeps it.

2. **Every claim cited.** This is the rule every other AI tutorial breaks. We don't. A sentence like
   "Claude's context window is 200K tokens" has a linked footnote. Anthropic's documentation is the
   source; when it changes, the lesson flags `// TODO: verify` at the top.

3. **Tools-as-textbook.** After Module 2 (prompting), a callout says: *"Just learned about prompt
   clarity? Try your new prompt on [HeadlineGrader](https://bilko.run/projects/headline-grader/) — it
   scores along the same axes."* PageRoast becomes a live exercise for Module 3's hallucination unit.
   The 12 paid tools on bilko.run become the lab bench. This is unique to Bilko.

4. **Built in public, authored in MDX.** Every lesson is a `.mdx` file in
   `~/Projects/Bilko-Academy/content/`. The commit history is the edit history. The blog post for
   each module launch documents what we got wrong in draft 1. Learners can file GitHub issues against
   lesson content. // TODO: source — determine if public GitHub repo or Bilko-internal

5. **Two academies, two audiences, explicitly cross-linked.** `bilko.run/academy` (builder-track) and
   `bilko.run/projects/academy/` (non-technical track) are siblings, not competitors. The builder
   track says "start here if you're coding"; the new sibling says "start here if you're not." Each
   links to the other at the top of its module index.

---

## ADR-001 — Where the Academy lives

```
Status: Decided 2026-05-09

Context:
  The existing in-repo Academy lives at src/pages/AcademyPage.tsx and is built into the
  bilko.run React SPA. It serves 5 builder-track levels (~30 min each), audience: developers
  wiring models into products. Level 1 is live; Levels 2–5 are stubs. It uses the phrase
  "opinionated as hell" and assumes familiarity with retries, idempotency, and DAGs.

  The new Academy (PRDs 51–62) is a 3-module, ~25-lesson, MDX-authored course for
  non-technical learners: marketers, managers, educators, anyone who uses AI but doesn't
  build with it. Its update cadence (lesson content, source citations) is independent of
  the host repo's deploy cycle. Its audience, voice, and tooling have no overlap with the
  in-repo builder-track.

Decision:
  Build a standalone sibling repo at ~/Projects/Bilko-Academy/ and host it as a static-path
  app at bilko.run/projects/academy/.

  The existing src/pages/AcademyPage.tsx stays exactly as-is — it is builder-track chrome,
  part of the host portfolio at bilko.run/academy. We cross-link both ways (PRD 61). We do
  not touch the in-repo lessons in this PRD set.

Consequences (positive):
  - Independent deploy cycle: a lesson fix in the Academy doesn't require a full host repo
    rebuild and re-deploy via Render.
  - Consistent with the host contract: default for new apps is static-path. Sudoku is a
    precedent; the Academy follows the same pattern.
  - Builder-track and non-technical track stay decoupled. The in-repo Academy can evolve
    (finish Levels 2–5) without waiting for the new Academy, and vice versa.
  - Content-heavy app (MDX, citations, interactive components) benefits from its own Vite
    config, bundle, and build optimization without polluting the host SPA bundle.
  - The sibling can use its own MDX pipeline (PRD 52) without adding Remark/Rehype to the
    host repo.

Consequences (negative):
  - Two separate repos to maintain. Cross-repo changes (e.g., updating host-kit tokens)
    require PRs in both repos.
  - Static-path routing means no shared auth state on page load — sign-in for cloud progress
    sync requires an explicit handshake via Clerk's Publishable Key.
  - The bilko-host MCP is required to register and deploy the sibling (per host contract);
    can't just git-push and have it appear.

Alternatives considered:
  1. Integrate into host repo as a new react-route at /products/academy: rejected because
     MDX pipeline, large content volume, and independent update cadence would bloat the
     host bundle and couple two unrelated products.
  2. External URL (separate domain, e.g., academy.bilko.run): rejected because it breaks
     the unified bilko.run brand and loses shared Clerk auth and analytics integration.
  3. Extend the in-repo Academy (add non-technical track to existing lesson structure):
     rejected because the in-repo Academy's UX (level ladder, builder voice) is wrong for
     non-technical learners; forcing both tracks into one structure produces a product for
     neither audience.
```

---

## v1 curriculum map

Three modules; each module is one PRD (55, 56, 57). Lesson-level source citations are the author's
contract with the content. PRDs 55/56/57 fill the lesson bodies; this map gives them the skeleton.

### Module 1 — What is an AI? (PRD 55, ~7 lessons)

| Lesson | Title | Primary source |
|---|---|---|
| L1 | What this course is, and what it isn't | Bilko voice + Anthropic AI Fluency intro framing |
| L2 | The 60-year shift: from rules to learning | [MIT 6.034 Lecture 1 — "Introduction and Scope"](https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/video_galleries/lecture-videos/) by Patrick Winston (CC BY-NC-SA 4.0) |
| L3 | Tokens, the alphabet of an LLM | [Anthropic tokenizer docs](https://docs.anthropic.com/en/docs/build-with-claude/token-counting) + 3Blue1Brown Ch. 5 "But what is a GPT?" |
| L4 | Probability, sampling, and why answers vary | [Karpathy "Intro to LLMs"](https://www.youtube.com/watch?v=zjkBMFhNj_g) (tokenization + sampling sections) + in-repo Level 1 temperature diagram |
| L5 | The context window as a hard ceiling | [Anthropic long-context best practices](https://docs.anthropic.com/en/docs/build-with-claude/context-windows) + in-repo Level 1 DiagramContextWindow |
| L6 | Training vs inference — the two modes, no math | [MIT 6.S191 Lecture 1 "Intro to Deep Learning"](https://introtodeeplearning.com/) (Alexander Amini, MIT license) |
| L7 | Why Claude is not Google — and not a database | [Anthropic "What is Claude"](https://www.anthropic.com/claude) + [AI Capabilities and Limitations course](https://anthropic.skilljar.com/) framing |

### Module 2 — Prompting, the Anthropic way (PRD 56, ~8 lessons)

Lessons mirror the H2 structure of the [Claude prompting best practices page](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices),
rewritten for non-technical learners with concrete examples from bilko.run tools.

| Lesson | Title | Primary source |
|---|---|---|
| L1 | Be clear and direct | [Prompting best practices — "Be clear and direct"](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#be-clear-and-direct) — includes the "brilliant but new employee" metaphor |
| L2 | Add context: who, what, why, what-good-looks-like | [Prompting best practices — "Add context to improve performance"](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#add-context) |
| L3 | Show, don't tell — examples as the fastest shortcut | [Prompting best practices — "Use examples effectively"](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#use-examples) |
| L4 | Structure with XML tags | [Anthropic XML tag guidance](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) |
| L5 | Give Claude a role | [Prompting best practices — system prompts / role prompting](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) |
| L6 | Long context: where to put what matters | [Anthropic long-context placement guidance](https://docs.anthropic.com/en/docs/build-with-claude/long-context-tips) |
| L7 | Chain prompts — one job per turn | [Anthropic prompt chaining](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-prompts) |
| L8 | Verifying: how to tell if a response is trustworthy | [AI Fluency "Discernment" module](https://anthropic.skilljar.com/ai-fluency-framework-foundations) + Karpathy hallucination framing |

### Module 3 — Safety, hallucinations & verification (PRD 57, ~5 lessons)

| Lesson | Title | Primary source |
|---|---|---|
| L1 | What "hallucination" actually means | [Karpathy "Intro to LLMs"](https://www.youtube.com/watch?v=zjkBMFhNj_g) — hallucination as next-token prediction failure |
| L2 | Reading the Acceptable Use Policy as a non-lawyer | [Anthropic AUP](https://www.anthropic.com/legal/aup) — Universal Standards + High-Risk categories |
| L3 | Prompt injection in plain English | [Karpathy security framing](https://www.youtube.com/watch?v=zjkBMFhNj_g) (security section) + Anthropic [security best practices](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/prompt-injection) |
| L4 | When to trust, when to verify | [AI Fluency "Diligence" module](https://anthropic.skilljar.com/ai-fluency-framework-foundations) + Discernment-Diligence loop |
| L5 | Citations, grounding, and "show me the source" | [Anthropic citations feature](https://docs.anthropic.com/en/docs/build-with-claude/citations) + Module 1 L7 cross-reference |

---

## References

### Academy authoring docs
- [voice.md — voice and tone rules for Academy lessons](../../Bilko-Academy/voice.md)
- [AUTHORING.md — end-to-end lesson authoring walkthrough](../../Bilko-Academy/AUTHORING.md)

### Anthropic
- [Anthropic Academy (Skilljar)](https://anthropic.skilljar.com/)
- [AI Fluency: Framework & Foundations](https://anthropic.skilljar.com/ai-fluency-framework-foundations)
- [AI Capabilities and Limitations course](https://anthropic.skilljar.com/ai-capabilities-and-limitations) // TODO: verify exact Skilljar URL slug
- [Claude Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Anthropic Acceptable Use Policy](https://www.anthropic.com/legal/aup)
- [Anthropic long-context tips](https://docs.anthropic.com/en/docs/build-with-claude/long-context-tips)
- [Anthropic token counting](https://docs.anthropic.com/en/docs/build-with-claude/token-counting)
- [Anthropic prompt chaining](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-prompts)
- [Anthropic XML tags guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags)
- [Anthropic citations feature](https://docs.anthropic.com/en/docs/build-with-claude/citations)
- [Anthropic security / prompt injection](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/prompt-injection)

### MIT / Academic
- [MIT 6.S191 Intro to Deep Learning (2026)](https://introtodeeplearning.com/) — MIT license, attribution required
- [MIT 6.034 Artificial Intelligence Fall 2010 — Patrick Winston](https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/) — CC BY-NC-SA 4.0
- [MIT 6.034 Lecture Videos](https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/video_galleries/lecture-videos/)
- [OCW 18.06 Linear Algebra — Gilbert Strang](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) — CC BY-NC-SA 4.0

### Pedagogy & video
- [3Blue1Brown Neural Networks playlist](https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi) — personal/educational use accepted
- [Andrej Karpathy — Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [fast.ai Practical Deep Learning](https://course.fast.ai/) — Apache 2.0 (code), CC BY 4.0 (materials)
- [DeepLearning.AI Short Courses](https://www.deeplearning.ai/short-courses/)

### Accessibility & standards
- [WCAG 2.1 AA Guidelines](https://www.w3.org/TR/WCAG21/)
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [axe-core accessibility testing](https://github.com/dequelabs/axe-core)
