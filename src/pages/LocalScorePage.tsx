import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ToolHero, CrossPromo } from '../components/tool-page/index.js';

type AnalysisMode = 'contract' | 'financial' | 'meeting' | 'general';

const MODES: Array<{ id: AnalysisMode; label: string; icon: string; prompt: string }> = [
  { id: 'contract', label: 'Contract Review', icon: '📄', prompt: 'Analyze this contract/agreement. Extract: 1) Key terms and obligations for each party, 2) Important deadlines and dates, 3) Financial terms (payment amounts, penalties), 4) Unusual or risky clauses to watch out for, 5) Missing clauses that should be included. Format as a structured analysis with sections.' },
  { id: 'financial', label: 'Financial Summary', icon: '💰', prompt: 'Analyze this financial document. Extract: 1) Key financial figures and metrics, 2) Trends (improving, declining, stable), 3) Risks or red flags, 4) Action items or decisions needed, 5) Comparison to industry standards if possible. Format as a structured summary.' },
  { id: 'meeting', label: 'Meeting Notes', icon: '📋', prompt: 'Analyze these meeting notes/transcript. Extract: 1) Key decisions made, 2) Action items with owners and deadlines, 3) Open questions or unresolved issues, 4) Key takeaways and insights, 5) Follow-up items. Format as a structured summary with clear sections.' },
  { id: 'general', label: 'General Analysis', icon: '🔍', prompt: 'Analyze this document thoroughly. Provide: 1) A concise summary (2-3 sentences), 2) Key points and findings, 3) Risks or concerns identified, 4) Recommended actions, 5) Any notable details that stand out. Format as a structured analysis.' },
];

type Status = 'idle' | 'loading-model' | 'ready' | 'analyzing' | 'done' | 'error' | 'unsupported';

export function LocalScorePage() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [mode, setMode] = useState<AnalysisMode>('general');
  const [docInput, setDocInput] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const engineRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.document.title = 'LocalScore — Privacy-First Document Analyzer';
    return () => { window.document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  const loadModel = useCallback(async () => {
    // Check WebGPU support
    if (!(navigator as any).gpu) {
      setStatus('unsupported');
      setError('Your browser doesn\'t support WebGPU. Try Chrome 113+ or Edge 113+.');
      return;
    }

    setStatus('loading-model');
    setProgress('Initializing...');

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const engine = await CreateMLCEngine('gemma-2-2b-it-q4f16_1-MLC', {
        initProgressCallback: (info: any) => {
          const text = info.text || '';
          setProgress(text);
          // Parse progress percentage from text like "Loading model... 45%"
          const match = text.match(/(\d+)%/);
          if (match) setProgressPct(parseInt(match[1]));
        },
      });

      engineRef.current = engine;
      setStatus('ready');
      setProgress('');
    } catch (e: any) {
      setStatus('error');
      setError(`Failed to load model: ${e.message}. You may need a device with a GPU and Chrome 113+.`);
    }
  }, []);

  async function analyze() {
    if (!engineRef.current || !docInput.trim()) return;

    setStatus('analyzing');
    setResult('');
    setError('');

    const selectedMode = MODES.find(m => m.id === mode)!;

    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a document analysis expert. ${selectedMode.prompt}` },
          { role: 'user', content: `Analyze this document:\n\n${docInput.slice(0, 8000)}` },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });

      const text = response.choices?.[0]?.message?.content ?? 'No analysis generated.';
      setResult(text);
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setError(`Analysis failed: ${e.message}`);
    }
  }

  return (
    <>
      <ToolHero
        title="Analyze documents privately"
        tagline="AI runs in YOUR browser. Your data never leaves your device. Zero API costs. Powered by Gemma."
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
          {/* Status: Not loaded */}
          {status === 'idle' && (
            <div className="text-center py-6">
              <p className="text-warm-300 text-sm mb-4">
                LocalScore downloads a small AI model (~1.6GB) to your browser.
                <br />After that, everything runs locally — your documents never leave your device.
              </p>
              <button onClick={loadModel}
                className="px-8 py-4 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 text-white font-black rounded-xl shadow-lg transition-all text-base">
                Load AI Model (one-time setup)
              </button>
              <p className="text-xs text-warm-500 mt-3">Requires Chrome 113+, Edge 113+, or any WebGPU-enabled browser. ~1.6GB download, cached for future visits.</p>
            </div>
          )}

          {/* Status: Loading model */}
          {status === 'loading-model' && (
            <div className="text-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-fire-500 border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-sm text-warm-300 mb-2">{progress || 'Downloading model...'}</p>
              {progressPct > 0 && (
                <div className="max-w-xs mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-fire-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              <p className="text-xs text-warm-500 mt-3">First time takes 1-3 minutes. Model is cached for future visits.</p>
            </div>
          )}

          {/* Status: Unsupported */}
          {status === 'unsupported' && (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm mb-2">WebGPU not supported</p>
              <p className="text-warm-500 text-xs">{error}</p>
              <p className="text-warm-500 text-xs mt-2">Try <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="text-fire-400 underline">Chrome</a> or <a href="https://www.microsoft.com/edge" target="_blank" rel="noopener noreferrer" className="text-fire-400 underline">Edge</a>.</p>
            </div>
          )}

          {/* Status: Ready / Done — show input */}
          {(status === 'ready' || status === 'done') && (
            <>
              {/* Mode selector */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      mode === m.id ? 'bg-white text-warm-900 shadow-sm' : 'bg-white/10 text-warm-400 hover:text-white'
                    }`}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              <textarea
                value={docInput}
                onChange={e => setDocInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); analyze(); } }}
                placeholder="Paste your document here... contracts, financial statements, meeting notes, or any text you want analyzed privately."
                rows={8}
                className="w-full px-5 py-4 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none"
              />

              <button onClick={analyze}
                disabled={!docInput.trim()}
                className="w-full mt-3 py-3.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
                🔒 Analyze Privately
              </button>

              <div className="flex items-center justify-center gap-2 mt-2">
                <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                <p className="text-xs text-green-400">Your data stays in your browser. Nothing sent to any server.</p>
              </div>
            </>
          )}

          {/* Status: Analyzing */}
          {status === 'analyzing' && (
            <div className="text-center py-4">
              <div className="h-5 w-5 rounded-full border-2 border-green-500 border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-sm text-warm-300">Analyzing locally on your device...</p>
              <p className="text-xs text-warm-500 mt-1">No data is being sent anywhere.</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => { setStatus('idle'); setError(''); }}
                className="mt-3 text-xs text-warm-400 hover:text-white underline">Try again</button>
            </div>
          )}
        </div>
      </ToolHero>

      {/* Results */}
      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          {/* Privacy badge */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center animate-slide-up">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg className="w-5 h-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              <p className="text-green-700 font-black">Analyzed 100% locally</p>
            </div>
            <p className="text-xs text-green-600">Your document was processed by AI running in your browser. Zero data was sent to any server.</p>
          </div>

          {/* Analysis result */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">
              {MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label} Analysis
            </h3>
            <div className="prose-warm text-sm text-warm-700 leading-relaxed whitespace-pre-line">
              {result}
            </div>
          </div>

          {/* Copy + actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => { navigator.clipboard.writeText(result); }}
              className="px-5 py-2.5 border border-warm-200 text-warm-700 hover:bg-warm-50 text-sm font-semibold rounded-lg transition-colors">
              Copy Analysis
            </button>
            <button onClick={() => { setResult(''); setDocInput(''); setStatus('ready'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-5 py-2.5 bg-fire-500 hover:bg-fire-600 text-white text-sm font-bold rounded-lg transition-colors">
              Analyze Another Document
            </button>
          </div>

          <CrossPromo currentTool="local-score" />
        </div>
      )}

      {/* Below-fold content */}
      {!result && status !== 'analyzing' && status !== 'loading-model' && (
        <>
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">Why local matters</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { icon: '🔒', title: 'True Privacy', desc: 'Your document is processed by AI running in your browser\'s GPU. Nothing is uploaded. Nothing is sent to any server. Ever.' },
                  { icon: '💸', title: 'Zero Cost', desc: 'No API fees. No credits. No subscription. The AI model runs on your device — we pay nothing to process your document.' },
                  { icon: '⚡', title: 'No Rate Limits', desc: 'Analyze as many documents as you want. No daily caps, no throttling, no "please wait." Your device, your rules.' },
                  { icon: '📡', title: 'Works Offline', desc: 'After the initial model download, LocalScore works without an internet connection. Airplane mode? No problem.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title}>
                    <span className="text-xl">{icon}</span>
                    <h3 className="font-bold text-warm-900 mt-1">{title}</h3>
                    <p className="text-sm text-warm-500 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-warm-400 mt-4 text-center">
                Cloud AI tools anonymize your data before processing (and still send it to a server). LocalScore doesn't need anonymization — your data never touches a server in the first place.
              </p>
            </div>
          </section>

          <section className="max-w-2xl mx-auto px-6 py-12">
            <div className="bg-warm-900 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white mb-3">Don't trust us. Verify it.</h3>
              <div className="space-y-3 text-sm text-warm-400">
                <p>Open your browser's DevTools (F12) → Network tab → run an analysis. You'll see <strong className="text-white">zero network requests</strong> during processing. The AI model runs on your GPU, not our servers.</p>
                <p>This is the strongest possible privacy architecture: there is no server to breach, no logs to subpoena, no API call to intercept. Your document exists only in your browser's memory.</p>
                <p className="text-warm-500 text-xs">Technical: Gemma 2B runs via WebLLM + WebGPU. Model weights cached in IndexedDB. Inference on your device's GPU. Apache 2.0 licensed.</p>
              </div>
            </div>
          </section>

          <section className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">What you can analyze</h2>
            <div className="space-y-4">
              {MODES.map(m => (
                <div key={m.id} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{m.icon}</span>
                  <div>
                    <h3 className="font-bold text-warm-900 text-sm">{m.label}</h3>
                    <p className="text-sm text-warm-500 mt-0.5">{m.prompt.split('.').slice(0, 2).join('.')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">FAQ</h2>
              <div className="space-y-5">
                {[
                  { q: 'Is my data really private?', a: 'Yes. The AI model (Gemma 2B) downloads to your browser and runs on your device\'s GPU. Your document is processed locally. We never see it, store it, or transmit it. Check your browser\'s network tab — zero requests during analysis.' },
                  { q: 'What browsers work?', a: 'Chrome 113+, Edge 113+, or any browser with WebGPU support. Safari WebGPU support is experimental. Firefox doesn\'t support WebGPU yet.' },
                  { q: 'How big is the model download?', a: 'About 1.6GB. It downloads once and is cached in your browser for future visits. After that, everything works offline.' },
                  { q: 'How good is the analysis?', a: 'Gemma 2B is a capable model for document analysis, but it\'s smaller than cloud models like GPT-4 or Claude. For sensitive documents where privacy matters more than perfection, it\'s the right trade-off.' },
                  { q: 'Why is this free?', a: 'Because we don\'t pay any API costs — your device does the work. LocalScore is a showcase for what browser-based AI can do. Our other tools use server-side AI and cost $1/credit.' },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <p className="text-sm font-bold text-warm-900">{q}</p>
                    <p className="text-sm text-warm-600 mt-0.5">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-warm-100/30 border-t border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-sm text-warm-500 mb-4">
                Powered by <a href="https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/" target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:underline">Google Gemma</a> via <a href="https://webllm.mlc.ai/" target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:underline">WebLLM</a>. Apache 2.0 licensed. Your data stays yours.
              </p>
              <Link to="/projects" className="text-sm font-semibold text-fire-500 hover:text-fire-600">
                Explore all bilko.run tools &rarr;
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
