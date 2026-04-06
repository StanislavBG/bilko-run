import { useEffect, useState } from 'react';
import { track } from '../hooks/usePageView.js';

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {label && <p className="text-xs font-bold text-warm-400 mb-2 uppercase tracking-wider">{label}</p>}
      <pre className="bg-warm-900 text-warm-100 rounded-xl p-4 text-sm font-mono overflow-x-auto leading-relaxed">{text}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 px-2.5 py-1 text-xs font-bold rounded-lg bg-warm-800 text-warm-400 hover:text-white hover:bg-warm-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export function StepproofPage() {
  useEffect(() => {
    document.title = 'Stepproof — Regression Tests for AI Pipelines';
    track('view_tool', { tool: 'stepproof' });
    return () => { document.title = 'Bilko — AI Advisory for Small Business'; };
  }, []);

  return (
    <div className="min-h-screen bg-warm-50">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,26,0.12),transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.1]">
            Regression tests for AI pipelines
          </h1>
          <p className="mt-4 text-lg text-warm-400 max-w-xl mx-auto">
            You upgraded your model. Traces look fine. Three days later a customer reports it stopped working.
            Stepproof catches that before you deploy.
          </p>
          <div className="mt-8">
            <CopyBlock text="npx stepproof init && npx stepproof run scenarios/" />
          </div>
          <p className="mt-4 text-xs text-warm-500 flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            Free &middot; Open source &middot; Works with any LLM provider
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xl font-extrabold text-warm-900 mb-10 text-center">How it works</h2>
        <div className="space-y-12">

          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-fire-500 text-white font-black text-sm flex items-center justify-center flex-shrink-0">1</span>
              <h3 className="font-bold text-warm-900 text-lg">Write a scenario in YAML</h3>
            </div>
            <CopyBlock text={`# classify.yaml
name: "Intent classification"
iterations: 10

steps:
  - id: classify
    provider: anthropic
    model: claude-sonnet-4-6
    prompt: "Classify the intent: {{input}}"
    variables:
      input: "I need to cancel my subscription"
    min_pass_rate: 0.90
    assertions:
      - type: contains
        value: "cancel"

  - id: respond
    provider: openai
    model: gpt-4o
    prompt: "Given intent '{{classify.output}}', write a reply"
    min_pass_rate: 0.80
    assertions:
      - type: llm_judge
        prompt: "Is this helpful? Answer yes/no."
        pass_on: "yes"`} />
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-fire-500 text-white font-black text-sm flex items-center justify-center flex-shrink-0">2</span>
              <h3 className="font-bold text-warm-900 text-lg">Run it</h3>
            </div>
            <CopyBlock text="npx stepproof run classify.yaml" />
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-fire-500 text-white font-black text-sm flex items-center justify-center flex-shrink-0">3</span>
              <h3 className="font-bold text-warm-900 text-lg">Get a pass/fail verdict</h3>
            </div>
            <div className="bg-warm-900 rounded-xl p-4 font-mono text-sm leading-relaxed">
              <p className="text-warm-400">stepproof v0.2.21 — running "Intent classification" (10 iterations)</p>
              <p className="mt-3 text-warm-300">  step: classify</p>
              <p className="text-green-400">    ✓ 9/10 passed (90.0%) — threshold: 90% ✓</p>
              <p className="mt-2 text-warm-300">  step: respond</p>
              <p className="text-green-400">    ✓ 8/10 passed (80.0%) — threshold: 80% ✓</p>
              <p className="mt-3 text-green-400 font-bold">All steps passed. Exit 0.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CI Integration */}
      <section className="bg-warm-100/50 border-y border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-4 text-center">Drop it into CI</h2>
          <p className="text-warm-500 text-center mb-8 max-w-lg mx-auto">
            Exit code 1 on regression. PR blocked. No dashboard needed.
          </p>
          <CopyBlock label="GitHub Actions" text={`# .github/workflows/ai-regression.yml
name: AI regression tests
on: [push, pull_request]

jobs:
  stepproof:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx stepproof run scenarios/
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}`} />
        </div>
      </section>

      {/* Assertions */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xl font-extrabold text-warm-900 mb-8 text-center">5 assertion types</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { type: 'contains', desc: 'Output includes a string' },
            { type: 'not_contains', desc: 'Output does NOT include a string' },
            { type: 'regex', desc: 'Output matches a pattern' },
            { type: 'json_schema', desc: 'Output is valid JSON matching a schema' },
            { type: 'llm_judge', desc: 'A second LLM evaluates the output (yes/no)' },
          ].map(a => (
            <div key={a.type} className="rounded-xl border border-warm-200/60 bg-white p-5">
              <code className="text-sm font-bold text-fire-600 font-mono">{a.type}</code>
              <p className="text-sm text-warm-600 mt-1">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* vs LangSmith */}
      <section className="bg-warm-100/50 border-y border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-8 text-center">Different job than LangSmith</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-200">
                  <th className="text-left py-3 pr-4 font-bold text-warm-900"></th>
                  <th className="text-left py-3 px-4 font-bold text-fire-600">stepproof</th>
                  <th className="text-left py-3 pl-4 font-bold text-warm-500">LangSmith / Braintrust</th>
                </tr>
              </thead>
              <tbody className="text-warm-600">
                {[
                  ['When it runs', 'Before deploy (CI)', 'After deploy (production)'],
                  ['What it answers', '"Is my pipeline still correct?"', '"What did my pipeline do?"'],
                  ['Output', 'Pass/fail with exit code', 'Traces and dashboards'],
                  ['Use case', 'Regression testing', 'Observability'],
                ].map(([label, sp, other]) => (
                  <tr key={label} className="border-b border-warm-100">
                    <td className="py-3 pr-4 font-medium text-warm-800">{label}</td>
                    <td className="py-3 px-4">{sp}</td>
                    <td className="py-3 pl-4 text-warm-400">{other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-warm-500 mt-6 text-center">They tell you what happened. Stepproof tells you whether to deploy. Use both.</p>
        </div>
      </section>

      {/* Get started */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center">
        <h2 className="text-2xl font-extrabold text-warm-900 mb-4">Get started in 30 seconds</h2>
        <p className="text-warm-500 mb-8">No install required. npx runs it directly.</p>
        <div className="max-w-lg mx-auto space-y-4">
          <CopyBlock label="Scaffold a scenario" text="npx stepproof init" />
          <CopyBlock label="Run it" text="npx stepproof run scenarios/" />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href="https://github.com/BilkoBibitkov/stepproof"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-warm-900 hover:bg-warm-800 text-white font-bold text-sm rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>
        <p className="mt-6 text-xs text-warm-400">
          MIT License &middot; Works with Anthropic, OpenAI, and any provider
        </p>
      </section>
    </div>
  );
}
