import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero } from '../components/tool-page/index.js';

const API = import.meta.env.VITE_API_URL || '/api';

interface StepSummary { stepId: string; totalRuns: number; passes: number; failures: number; passRate: number; minPassRate: number; belowThreshold: boolean; }
interface AssertionResult { type: string; passed: boolean; message?: string; }
interface StepResult { stepId: string; iteration: number; output: string; passed: boolean; assertions: AssertionResult[]; error?: string; durationMs: number; }
interface ScenarioReport { name: string; iterations: number; durationMs: number; steps: StepSummary[]; allPassed: boolean; results: StepResult[]; }
interface Preset { id: string; name: string; description: string; yaml: string; }

export function StepproofPage() {
  const { loading, error, isSignedIn, signInRef } = useToolApi<ScenarioReport>('stepproof');
  const [tab, setTab] = useState<'preset' | 'custom'>('preset');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customYaml, setCustomYaml] = useState('');
  const [iterations, setIterations] = useState(2);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [report, setReport] = useState<ScenarioReport | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Stepproof — Regression Tests for AI Pipelines';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    fetch(`${API}/demos/stepproof/presets`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) { setPresets(d); if (d.length > 0) setSelectedPreset(d[0].id); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (report && resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [report]);

  async function runScenario() {
    if (!isSignedIn) { signInRef.current?.click(); return; }
    setRunning(true);
    setReport(null);
    setRunError(null);
    try {
      const body: any = { iterations };
      if (tab === 'preset') body.presetId = selectedPreset;
      else body.yaml = customYaml;
      if (openaiKey) body.apiKeys = { ...body.apiKeys, openai: openaiKey };
      if (anthropicKey) body.apiKeys = { ...body.apiKeys, anthropic: anthropicKey };

      const res = await fetch(`${API}/demos/stepproof/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data);
    } catch (e: any) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const activePreset = presets.find(p => p.id === selectedPreset);

  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      <ToolHero
        title="Test your AI pipeline"
        tagline="Write a scenario. Run it N times. See if your LLM can follow instructions."
      >
        {/* Tab toggle */}
        <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
          <button onClick={() => setTab('preset')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'preset' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'}`}>
            Presets
          </button>
          <button onClick={() => setTab('custom')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'custom' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'}`}>
            Custom YAML
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
          {tab === 'preset' ? (
            <>
              <div className="space-y-2 mb-4">
                {presets.map(p => (
                  <button key={p.id} onClick={() => setSelectedPreset(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedPreset === p.id ? 'bg-white text-warm-900 shadow-sm' : 'bg-white/5 text-warm-400 hover:bg-white/10 hover:text-white'}`}>
                    <span className="font-bold text-sm">{p.name}</span>
                    <p className="text-xs mt-0.5 opacity-80">{p.description}</p>
                  </button>
                ))}
              </div>
              {activePreset && (
                <details className="mb-3">
                  <summary className="text-xs text-warm-500 cursor-pointer hover:text-warm-300">View YAML</summary>
                  <pre className="mt-2 text-xs text-warm-400 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48">{activePreset.yaml}</pre>
                </details>
              )}
            </>
          ) : (
            <>
              <textarea value={customYaml} onChange={e => setCustomYaml(e.target.value)} placeholder={"name: My Scenario\niterations: 2\nsteps:\n  - id: step1\n    provider: gemini\n    model: gemini-2.0-flash\n    prompt: |\n      Your prompt here...\n    assertions:\n      - type: contains\n        value: expected"}
                rows={12} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner font-mono text-xs resize-none mb-3" />
              <details className="mb-3">
                <summary className="text-xs text-warm-500 cursor-pointer hover:text-warm-300">API Keys (optional — for OpenAI/Anthropic steps)</summary>
                <div className="mt-2 space-y-2">
                  <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-... (OpenAI key)" type="password"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-warm-300 text-xs placeholder:text-warm-600 focus:outline-none" />
                  <input value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-... (Anthropic key)" type="password"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-warm-300 text-xs placeholder:text-warm-600 focus:outline-none" />
                  <p className="text-[10px] text-warm-600">Keys are sent for this request only. Never stored. Presets use Gemini — no key needed.</p>
                </div>
              </details>
            </>
          )}

          {/* Iterations slider */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-bold text-warm-400">Iterations:</label>
            <input type="range" min={1} max={5} value={iterations} onChange={e => setIterations(parseInt(e.target.value))}
              className="flex-1 accent-fire-500" />
            <span className="text-sm font-bold text-white w-6 text-center">{iterations}</span>
          </div>

          <button onClick={runScenario}
            disabled={running || (tab === 'preset' ? !selectedPreset : customYaml.trim().length < 20)}
            className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
            {running ? 'Running scenario...' : 'Run Test'}
          </button>
          <p className="mt-2 text-xs text-warm-500 text-center">
            Each iteration calls the LLM and checks assertions. Patience, grasshopper.
          </p>
        </div>
      </ToolHero>

      {runError && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{runError}</div>
        </div>
      )}

      {/* Below-fold engagement content — only when idle */}
      {!report && !running && (
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-8 space-y-10">
          {/* How it works */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-1">How It Works</h3>
            <p className="text-sm text-warm-500 mb-5">Three steps. No PhD required.</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black">1</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Write a scenario</p>
                  <p className="text-sm text-warm-600">YAML file. Name, steps, assertions. If you can write a GitHub Action, you can write a Stepproof scenario.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">2</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Run N iterations</p>
                  <p className="text-sm text-warm-600">Same prompt, N times. Because AI outputs aren't deterministic and your test suite shouldn't pretend they are.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">3</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Check assertions</p>
                  <p className="text-sm text-warm-600">contains, regex, json_schema, llm_judge. From "does it mention X" to "is this output actually good."</p>
                </div>
              </div>
            </div>
          </div>

          {/* Assertion types */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-5">Assertion Types</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                <p className="text-sm font-bold text-warm-900 font-mono">contains / not_contains</p>
                <p className="text-sm text-warm-600 mt-1">Substring check. Case-insensitive.</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                <p className="text-sm font-bold text-warm-900 font-mono">regex</p>
                <p className="text-sm text-warm-600 mt-1">Full regex. For when substring isn't enough.</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                <p className="text-sm font-bold text-warm-900 font-mono">json_schema</p>
                <p className="text-sm text-warm-600 mt-1">Validates output against JSON Schema. For structured output testing.</p>
              </div>
              <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                <p className="text-sm font-bold text-warm-900 font-mono">llm_judge</p>
                <p className="text-sm text-warm-600 mt-1">Ask another LLM to evaluate the output. "Is this response helpful?" &rarr; yes/no.</p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-5">Frequently Asked Questions</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-warm-900">Do I need my own API keys?</p>
                <p className="text-sm text-warm-600">Presets use Gemini (free, no key needed). Custom YAML with OpenAI/Anthropic steps needs your own keys. Keys are never stored.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Why only 5 iterations?</p>
                <p className="text-sm text-warm-600">Web-based testing is for quick validation. For heavy CI runs, use the Stepproof CLI: npx stepproof run.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">What's a good pass rate?</p>
                <p className="text-sm text-warm-600">0.8 (80%) is the default threshold. For critical pipelines, use 0.9+. For creative tasks, 0.6 might be fine.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Can I chain steps?</p>
                <p className="text-sm text-warm-600">{"Yes. Use {{step_id.output}} in later prompts. Multi-step pipelines are the whole point."}</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <p className="text-lg font-bold text-warm-800 mb-3">Your prompts break in production. Catch it here first.</p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-6 py-3 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm">
              Back to top
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {report && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          {/* Pass/Fail Banner */}
          <div className={`rounded-2xl p-6 text-center animate-slide-up ${report.allPassed ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
            <p className={`text-3xl font-black ${report.allPassed ? 'text-green-700' : 'text-red-700'}`}>
              {report.allPassed ? 'ALL PASSED' : 'FAILED'}
            </p>
            <p className={`text-sm mt-1 ${report.allPassed ? 'text-green-600' : 'text-red-600'}`}>
              {report.name} &middot; {report.iterations} iteration{report.iterations !== 1 ? 's' : ''} &middot; {(report.durationMs / 1000).toFixed(1)}s
            </p>
            <p className="text-xs text-warm-400 mt-2">
              {report.allPassed ? 'Your AI can follow instructions. For now.' : 'Time to tweak those prompts.'}
            </p>
          </div>

          {/* Step Summaries */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Step Results</h3>
            <div className="space-y-3">
              {report.steps.map(step => {
                const pct = Math.round(step.passRate * 100);
                const passed = !step.belowThreshold;
                const isExpanded = expandedStep === step.stepId;
                const stepResults = report.results.filter(r => r.stepId === step.stepId);
                return (
                  <div key={step.stepId}>
                    <button onClick={() => setExpandedStep(isExpanded ? null : step.stepId)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-warm-100 hover:border-warm-200 transition-colors text-left">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {passed ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-warm-800">{step.stepId}</span>
                          <span className="text-xs text-warm-400">{step.passes}/{step.totalRuns} passed</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-warm-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${passed ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-warm-600">{pct}%</span>
                          <span className="text-[10px] text-warm-400">min: {Math.round(step.minPassRate * 100)}%</span>
                        </div>
                      </div>
                      <svg className={`w-4 h-4 text-warm-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 ml-11 space-y-2">
                        {stepResults.map((r, idx) => (
                          <div key={idx} className={`text-xs p-3 rounded-lg border ${r.passed ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-warm-600">Iteration {r.iteration}</span>
                              <span className={`font-bold ${r.passed ? 'text-green-600' : 'text-red-600'}`}>{r.passed ? 'PASS' : 'FAIL'}</span>
                              <span className="text-warm-400">{r.durationMs}ms</span>
                            </div>
                            {r.error && <p className="text-red-600 mb-1">Error: {r.error}</p>}
                            {r.assertions.map((a, ai) => (
                              <div key={ai} className="flex items-center gap-1.5">
                                <span className={a.passed ? 'text-green-500' : 'text-red-500'}>{a.passed ? '✓' : '✗'}</span>
                                <span className="font-mono text-warm-500">{a.type}</span>
                                {a.message && <span className="text-warm-400 truncate">— {a.message}</span>}
                              </div>
                            ))}
                            <details className="mt-1">
                              <summary className="text-warm-400 cursor-pointer hover:text-warm-600">Output</summary>
                              <pre className="mt-1 text-warm-600 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32">{r.output}</pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
