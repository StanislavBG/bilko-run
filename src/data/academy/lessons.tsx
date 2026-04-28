import type { ReactNode } from 'react';
import {
  DiagramTokenizer,
  DiagramNextToken,
  DiagramContextWindow,
  DiagramHallucination,
  DiagramTemperature,
  DiagramStepRing,
} from '../../components/academy/Diagrams.js';

export interface Lesson {
  n: number;
  slug: string;
  name: string;
  tagline: string;
  readMinutes: number;
  status: 'live' | 'cooking';
  /** Top-level concept tags shown in the meta strip. */
  tags: readonly string[];
  /** Curriculum (used both in the lesson and in the AcademyPage row). */
  curriculum: readonly string[];
  /** Render the lesson body. Stubs return null and we render a placeholder. */
  render: () => ReactNode;
}

/* ════════════════════════════════════════════════════════════════
 * LEVEL 1 — Beginner: What an LLM actually is.
 * ═══════════════════════════════════════════════════════════════ */
function Level1Body() {
  return (
    <>
      <p className="pf-lede">
        A large language model isn't an oracle, a brain, a search engine, or a database.
        It is a very fast, very large, very expensive autocomplete trained on most of the
        internet. Once you stop expecting it to be magic, you start using it well.
      </p>

      <DiagramStepRing
        steps={['Tokenize', 'Predict', 'Sample', 'Repeat']}
        active={0}
      />

      <h2><span className="pf-num">01</span>Words become numbers</h2>
      <p>
        The first thing every model does is throw your words away. Text is split into
        <em> tokens</em> — chunks usually shorter than a word, longer than a letter — and
        each token is replaced with a number. <code>"AI"</code> might be one token.
        <code>" things"</code> (with the leading space) is usually another. A common
        word like <code>"the"</code> is one token; a rare word like <code>"Bibitkov"</code>{' '}
        becomes three or four.
      </p>
      <p>
        The model has never seen the string <code>"Hey"</code>. It has only seen the
        token id that <em>Hey</em> maps to — and it has seen that id appear in tens of
        billions of contexts during training.
      </p>

      <DiagramTokenizer />

      <div className="pf-callout">
        <span className="pf-callout-label">Why this matters in practice</span>
        Token boundaries are why prompts stuffed with weird punctuation, emoji, or
        non-English alphabets behave unevenly — they push your text into rarer token
        sequences the model has less data on. When PageRoast started getting flaky on
        Cyrillic copy, the fix was a tokenization sanity check, not a smarter prompt.
      </div>

      <h2><span className="pf-num">02</span>The next token is a coin flip</h2>
      <p>
        With tokens in hand, the model produces a probability distribution over{' '}
        <em>every token it knows</em> — usually 50,000 to 200,000 candidates. For each
        candidate it answers one question: "given everything I just read, how likely is
        this the next thing?"
      </p>
      <p>
        Then it rolls weighted dice and picks one. Appends it. Re-runs the whole
        machine. Picks the next one. Stops when it predicts an end-of-message token.
        That's it. That's the whole thing.
      </p>

      <DiagramNextToken />

      <p>
        This is why the same prompt produces different answers. The dice are real. The
        only way to get an identical answer twice is to ask for <code>temperature=0</code>{' '}
        (always pick the most likely token) and a fixed seed — and even then, hardware
        differences across GPU runs can shift the floating-point math just enough to
        change a tied vote.
      </p>

      <h2><span className="pf-num">03</span>The context window is everything it knows right now</h2>
      <p>
        A model has no memory between turns. What looks like memory is just the
        conversation history being re-sent every time. The maximum amount of text the
        model can read in a single turn is its <em>context window</em> — usually 8K,
        32K, 200K, or up to 2M tokens depending on the model.
      </p>
      <p>
        When the conversation grows past the limit, the oldest turns are dropped,
        summarized, or quietly truncated. The model doesn't notice anything is missing.
        From its point of view, what it can see is what exists.
      </p>

      <DiagramContextWindow />

      <div className="pf-callout">
        <span className="pf-callout-label">In bilko.run tools</span>
        OutdoorHours pre-generates 121 monthly summaries offline because you cannot
        re-run a 30-year history through a 200K context window every time someone
        clicks April 2017. The window is a tighter constraint than people realize. If
        the model needs information that doesn't fit, you have to fetch it for them or
        compress it before they ask.
      </div>

      <h2><span className="pf-num">04</span>This is why models lie</h2>
      <p>
        A model has no concept of "I don't know." It has a probability distribution
        over tokens, and it samples one. If the prompt looks like the kind of place
        someone would assert a fact, the model will assert a fact — fluently,
        confidently, and sometimes wrong.
      </p>
      <p>
        The shape of the lie is always the same: a string that sounds maximally like
        the answer to your question, drawn from the patterns of every other answer the
        model has ever seen. There is no internal warning light. No tiny bell. The
        sentence comes out as smooth as the truth.
      </p>

      <DiagramHallucination />

      <p>
        The fix isn't "tell the model not to lie" — it cannot tell. The fix is to
        attach a database, a tool, or a verification step that <em>can</em>. Almost
        every robust LLM application is fundamentally a model wired to something less
        creative.
      </p>

      <h2><span className="pf-num">05</span>One knob: temperature</h2>
      <p>
        Of the dozen or so settings most APIs expose, exactly one matters for most use
        cases: <code>temperature</code>. It controls how aggressively the model reaches
        past the most-likely token.
      </p>
      <ul>
        <li><strong>0.0</strong> — Always pick the top candidate. Deterministic-ish. Boring. Good for extraction, parsing, scoring.</li>
        <li><strong>0.7</strong> — A reasonable mix of confidence and variety. The default for most chat applications.</li>
        <li><strong>1.0+</strong> — Creative, surprising, increasingly unhinged. Good for brainstorming. Bad for invoices.</li>
      </ul>

      <DiagramTemperature />

      <h2><span className="pf-num">06</span>Try it yourself</h2>
      <div className="pf-exercise">
        <span className="pf-exercise-label">Project · 15 minutes</span>
        <h3>Watch a model think out loud.</h3>
        <p>
          You don't need an account, code, or a credit card. Just any LLM chat —
          Claude, ChatGPT, Gemini.
        </p>
        <ol>
          <li>Pick one prompt. Anything specific, like: <em>"Write a one-sentence bio for someone who builds small AI tools alone."</em></li>
          <li>Send it five times in a fresh conversation each time.</li>
          <li>Note the variance. Are the ideas the same? The structure? The vocabulary? Are any answers wrong?</li>
          <li>Now switch to a "deterministic" version — many UIs offer a "factual" or "precise" mode, which is just <code>temperature=0</code>. Send the same prompt twice. Are they identical?</li>
          <li>Last: change one word in your prompt and watch the answer reshape itself. The model isn't reasoning about your idea. It's reading a slightly different sentence.</li>
        </ol>
      </div>

      <h2><span className="pf-num">07</span>What you now know</h2>
      <ul>
        <li>A model is autocomplete trained on tokens, not words.</li>
        <li>Each next token is a sample, not a calculation. Same prompt, different answer.</li>
        <li>The context window is a hard ceiling on what the model can see at once.</li>
        <li>The model cannot tell the truth from a fluent lie. You have to.</li>
        <li><code>temperature</code> is the only knob you usually need.</li>
      </ul>
      <p>
        That's the whole conceptual base. Everything else — system prompts, retrieval,
        agents, tool use, fine-tuning, RAG — is a workaround for one of the five facts
        above. We'll get to all of them.
      </p>

      <p style={{ marginTop: 32 }}>
        <strong>Next:</strong> Level 02 — Conversant. How to actually talk to one of
        these things without sounding like you're casting a spell.
      </p>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
 * Stubs for Levels 2-5 (curriculum outlines, no diagrams yet)
 * ═══════════════════════════════════════════════════════════════ */
function StubBody({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <p className="pf-lede">{lesson.tagline}</p>
      <div className="pf-stub-banner">
        <strong>Cooking</strong>Lesson outline below — full content + custom diagrams shipping next.
      </div>
      <h2>What this lesson covers</h2>
      <ul>
        {lesson.curriculum.map(c => <li key={c}>{c}</li>)}
      </ul>
    </>
  );
}

/* ── Lesson list ───────────────────────────────────────────────── */
export const LESSONS: readonly Lesson[] = [
  {
    n: 1,
    slug: '1',
    name: 'Beginner',
    tagline: 'What an LLM actually is. No mystique, no metaphors that don\'t hold up.',
    readMinutes: 22,
    status: 'live',
    tags: ['tokens', 'sampling', 'context', 'temperature'],
    curriculum: [
      'How text becomes tokens, and why it matters when something breaks',
      'Why the same prompt gives different answers',
      'The context window as a hard ceiling',
      'Why models lie fluently and what to attach to fix it',
      'Temperature: the one setting most people get wrong',
    ],
    render: Level1Body,
  },
  {
    n: 2,
    slug: '2',
    name: 'Conversant',
    tagline: 'Prompting, context, and when to give up. The shape of a request that works.',
    readMinutes: 25,
    status: 'cooking',
    tags: ['system prompts', 'few-shot', 'role', 'failure modes'],
    curriculum: [
      'System vs. user vs. assistant roles — and why they\'re all just text',
      'The four prompt patterns that survived contact with PageRoast',
      'Few-shot examples: when they help, when they leak, when to skip',
      'Detecting "the model gave up" vs. "the model is confidently wrong"',
      'The retry budget: knowing when to stop pushing the same prompt',
    ],
    render: () => null,
  },
  {
    n: 3,
    slug: '3',
    name: 'Builder',
    tagline: 'Wiring models into real apps. Typed outputs, retries, cost ceilings.',
    readMinutes: 28,
    status: 'cooking',
    tags: ['typed JSON', 'retries', 'cost', 'streaming'],
    curriculum: [
      'Why typed JSON output is the only contract worth defending',
      'Validating model output with Zod — and what to do when validation fails',
      'Retry policies that actually save the run vs. that burn your budget',
      'Streaming UX: when partial responses help users and when they confuse them',
      'Cost budgeting: per-tool ceilings, alerts, and the kill switch',
    ],
    render: () => null,
  },
  {
    n: 4,
    slug: '4',
    name: 'Operator',
    tagline: 'Background agents, schedulers, observability. Tools that run while you sleep.',
    readMinutes: 27,
    status: 'cooking',
    tags: ['n8n', 'cron', 'tracing', 'idempotency'],
    curriculum: [
      'Why "background agent" is just a cron job with extra steps',
      'Idempotency keys: the difference between "I ran" and "I ran twice"',
      'OpenTelemetry GenAI spans for AI work — what to record, what to drop',
      'Read-only vs. write-capable engines: keeping dashboards from triggering runs',
      'When to fire alerts, and when silence is the right behavior',
    ],
    render: () => null,
  },
  {
    n: 5,
    slug: '5',
    name: 'Architect',
    tagline: 'Rules-first systems that scale to many flows. Governance as code.',
    readMinutes: 30,
    status: 'cooking',
    tags: ['rules', 'DAGs', 'audit', 'governance'],
    curriculum: [
      'Why rules belong in code, not in a Notion page',
      'DAG-validated flow specs: catching contradictions before runtime',
      'Audit logs that survive a model upgrade',
      'Determinism grades: declaring what is reproducible and what isn\'t',
      'Multi-flow architecture: when to share state, when to fork pipelines',
    ],
    render: () => null,
  },
];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find(l => l.slug === slug);
}

export const StubLessonBody = StubBody;
