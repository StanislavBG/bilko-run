import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ToolHero, CrossPromo } from '../components/tool-page/index.js';

type AnalysisMode = 'contract' | 'financial' | 'meeting' | 'general';

const MODES: Array<{ id: AnalysisMode; label: string; icon: string; example: string; prompt: string }> = [
  { id: 'contract', label: 'A contract or agreement', icon: '📄', example: 'Lease agreements, service contracts, NDAs, terms of service...', prompt: 'Analyze this contract/agreement. Write your response in plain, simple English that a non-expert can understand. Extract: 1) What each side has to do (obligations), 2) Important dates and deadlines, 3) How much money is involved, 4) Anything that looks unusual or risky — explain WHY it\'s risky in simple terms, 5) Anything important that seems to be missing. Use clear section headings. Avoid legal jargon — if you must use a legal term, explain it in parentheses.' },
  { id: 'financial', label: 'A bill, invoice, or financial document', icon: '💰', example: 'Bank statements, invoices, tax documents, receipts...', prompt: 'Analyze this financial document. Write your response in plain, simple English. Extract: 1) The key numbers — how much, for what, from whom, 2) Is anything getting more expensive or cheaper over time? 3) Anything that looks wrong or suspicious, 4) What the reader should do next, 5) A simple one-paragraph summary at the top. Use clear headings and bullet points.' },
  { id: 'meeting', label: 'Meeting notes or a conversation', icon: '📋', example: 'Email threads, meeting minutes, chat logs, interview notes...', prompt: 'Analyze these notes/transcript. Write your response in plain, simple English. Extract: 1) What was decided, 2) Who needs to do what (action items with names), 3) What\'s still unresolved or needs follow-up, 4) The most important takeaway in one sentence, 5) Suggested next steps. Format with clear headings and keep it scannable.' },
  { id: 'general', label: 'Something else', icon: '🔍', example: 'Letters, emails, reports, articles, any text you want understood...', prompt: 'Analyze this document. Write your response in plain, simple English that anyone can understand. Provide: 1) A 2-3 sentence summary of what this document is about, 2) The most important points (bullet list), 3) Anything concerning or that needs attention, 4) What the reader should do next, 5) Anything else worth noting. Use clear headings. No jargon.' },
];

type Status = 'idle' | 'loading-model' | 'ready' | 'pick-mode' | 'input' | 'analyzing' | 'done' | 'error' | 'unsupported';

export function LocalScorePage() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [docInput, setDocInput] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const engineRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.document.title = 'LocalScore — Understand Any Document Privately';
    return () => { window.document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  const loadModel = useCallback(async () => {
    if (!(navigator as any).gpu) {
      setStatus('unsupported');
      return;
    }
    setStatus('loading-model');
    setProgress('');
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      const engine = await CreateMLCEngine('gemma-2-2b-it-q4f16_1-MLC', {
        initProgressCallback: (info: any) => {
          const text = info.text || '';
          setProgress(text);
          const match = text.match(/(\d+)%/);
          if (match) setProgressPct(parseInt(match[1]));
        },
      });
      engineRef.current = engine;
      setStatus('pick-mode');
    } catch (e: any) {
      setStatus('error');
      setError(`Something went wrong setting up. Try refreshing the page, or use Chrome/Edge on a computer.`);
    }
  }, []);

  async function analyze() {
    if (!engineRef.current || !docInput.trim() || !mode) return;
    setStatus('analyzing');
    setResult('');
    setError('');
    const selectedMode = MODES.find(m => m.id === mode)!;
    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a helpful document analyst who explains things in plain, simple English. ${selectedMode.prompt}` },
          { role: 'user', content: `Please analyze this for me:\n\n${docInput.slice(0, 8000)}` },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });
      const text = response.choices?.[0]?.message?.content ?? 'Sorry, I couldn\'t analyze that. Try pasting a different document.';
      setResult(text);
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setError('Something went wrong during analysis. Try a shorter document or refresh the page.');
    }
  }

  // Render helpers for results
  function renderResult(text: string) {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-warm-900 mt-4 mb-1">{trimmed.slice(3)}</h3>;
      if (trimmed.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-warm-900 mt-5 mb-2">{trimmed.slice(2)}</h2>;
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) return <p key={i} className="font-bold text-warm-800 mt-3 mb-1">{trimmed.slice(2, -2)}</p>;
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) return <li key={i} className="text-warm-700 ml-4 list-disc">{trimmed.slice(2)}</li>;
      if (/^\d+[\.\)]/.test(trimmed)) return <li key={i} className="text-warm-700 ml-4 list-decimal">{trimmed.replace(/^\d+[\.\)]\s*/, '')}</li>;
      return <p key={i} className="text-warm-700 leading-relaxed">{trimmed}</p>;
    });
  }

  const selectedMode = mode ? MODES.find(m => m.id === mode) : null;

  return (
    <>
      <ToolHero
        title="Understand any document"
        tagline="Paste a contract, bill, or any text. AI explains it in plain English — and your data never leaves your computer."
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 md:p-6 shadow-2xl max-w-2xl mx-auto">

          {/* Step 1: Welcome */}
          {status === 'idle' && (
            <div className="text-center py-8">
              <p className="text-3xl mb-4">🔒</p>
              <h2 className="text-xl font-bold text-white mb-2">Private & Free</h2>
              <p className="text-warm-300 text-sm mb-1">
                This tool reads your documents using AI that runs on <em>your</em> computer.
              </p>
              <p className="text-warm-400 text-xs mb-6">
                Nothing gets uploaded. Nothing gets sent anywhere. It's just you and the AI.
              </p>
              <button onClick={loadModel}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black rounded-xl shadow-lg transition-all text-lg">
                Get Started
              </button>
              <p className="text-xs text-warm-500 mt-4">
                First time takes 1-2 minutes to set up. After that it's instant.
                <br />Works in Chrome and Edge on a computer.
              </p>
            </div>
          )}

          {/* Step 1b: Setting up */}
          {status === 'loading-model' && (
            <div className="text-center py-10">
              <div className="h-8 w-8 rounded-full border-3 border-green-500 border-t-transparent animate-spin mx-auto mb-5" />
              <p className="text-base text-white font-semibold mb-1">Setting up your private AI...</p>
              <p className="text-sm text-warm-400 mb-4">{progress ? progress.replace(/\[.*?\]/g, '').trim() : 'This only happens once.'}</p>
              {progressPct > 0 && (
                <div className="max-w-sm mx-auto">
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-xs text-warm-500">{progressPct}% — almost there</p>
                </div>
              )}
            </div>
          )}

          {/* Step 1c: Browser not supported */}
          {status === 'unsupported' && (
            <div className="text-center py-8">
              <p className="text-3xl mb-3">😔</p>
              <h2 className="text-lg font-bold text-white mb-2">Your browser can't run this yet</h2>
              <p className="text-warm-400 text-sm mb-4">
                This tool needs a newer browser. Try one of these on a computer:
              </p>
              <div className="flex gap-3 justify-center">
                <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors">Download Chrome</a>
                <a href="https://www.microsoft.com/edge" target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors">Download Edge</a>
              </div>
              <p className="text-xs text-warm-500 mt-4">Both are free. This doesn't work on phones yet.</p>
            </div>
          )}

          {/* Step 2: What kind of document? */}
          {status === 'pick-mode' && (
            <div className="py-4">
              <p className="text-center text-white font-semibold mb-1">Ready! What do you need help with?</p>
              <p className="text-center text-warm-400 text-xs mb-5">Pick the type that's closest. Don't worry about getting it perfect.</p>
              <div className="space-y-2">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setStatus('input'); }}
                    className="w-full flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-400/50 transition-all text-left group">
                    <span className="text-2xl mt-0.5">{m.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-green-300 transition-colors">{m.label}</p>
                      <p className="text-xs text-warm-500 mt-0.5">{m.example}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Paste your document */}
          {status === 'input' && selectedMode && (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStatus('pick-mode')} className="text-warm-500 hover:text-white text-xs">&larr; Back</button>
                <span className="text-lg">{selectedMode.icon}</span>
                <span className="text-sm font-bold text-white">{selectedMode.label}</span>
              </div>
              <textarea
                value={docInput}
                onChange={e => setDocInput(e.target.value)}
                placeholder={"Copy the text from your document and paste it here.\n\nYou can paste the whole thing — or just the parts you want explained."}
                rows={10}
                autoFocus
                className="w-full px-5 py-4 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 shadow-inner resize-none"
              />
              <button onClick={analyze}
                disabled={!docInput.trim()}
                className="w-full mt-3 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black text-base rounded-xl shadow-lg transition-all disabled:shadow-none">
                {docInput.trim() ? 'Analyze This' : 'Paste something first...'}
              </button>
              <div className="flex items-center justify-center gap-2 mt-2">
                <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                <p className="text-xs text-green-400">This stays on your computer. Nothing gets sent anywhere.</p>
              </div>
            </div>
          )}

          {/* Step 3b: Analyzing */}
          {status === 'analyzing' && (
            <div className="text-center py-10">
              <div className="h-8 w-8 rounded-full border-3 border-green-500 border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-base text-white font-semibold">Reading your document...</p>
              <p className="text-xs text-warm-500 mt-1">This usually takes 15-30 seconds.</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center py-6">
              <p className="text-3xl mb-3">😕</p>
              <p className="text-warm-300 text-sm mb-2">{error}</p>
              <button onClick={() => { setStatus(engineRef.current ? 'pick-mode' : 'idle'); setError(''); }}
                className="mt-3 px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors">
                Try again
              </button>
            </div>
          )}
        </div>
      </ToolHero>

      {/* Results */}
      {status === 'done' && result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          {/* Privacy confirmation */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center animate-slide-up">
            <div className="flex items-center justify-center gap-2 mb-1">
              <svg className="w-5 h-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              <p className="text-green-700 font-bold">Your document stayed on your computer</p>
            </div>
            <p className="text-xs text-green-600">Nothing was uploaded or sent to any server.</p>
          </div>

          {/* Analysis */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">
              {selectedMode?.icon} Here's what I found
            </h3>
            <div className="text-sm space-y-1">
              {renderResult(result)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <button onClick={() => { navigator.clipboard.writeText(result); }}
              className="px-5 py-3 border-2 border-warm-200 text-warm-700 hover:bg-warm-50 font-bold rounded-xl transition-colors">
              Copy to clipboard
            </button>
            <button onClick={() => {
              const blob = new Blob([result], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = window.document.createElement('a'); a.href = url; a.download = `analysis-${selectedMode?.id || 'document'}.txt`; a.click(); URL.revokeObjectURL(url);
            }}
              className="px-5 py-3 border-2 border-warm-200 text-warm-700 hover:bg-warm-50 font-bold rounded-xl transition-colors">
              Save as file
            </button>
            <button onClick={() => { setResult(''); setDocInput(''); setStatus('pick-mode'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-5 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors">
              Analyze another document
            </button>
          </div>

          <CrossPromo currentTool="local-score" />
        </div>
      )}

      {/* Below-fold content */}
      {(status === 'idle' || status === 'unsupported') && (
        <>
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">How it works</h2>
              <div className="space-y-6">
                {[
                  { step: '1', title: 'Click "Get Started"', desc: 'A small AI downloads to your browser. This takes 1-2 minutes the first time. After that, it\'s instant.' },
                  { step: '2', title: 'Pick what you need help with', desc: 'Contract? Bill? Meeting notes? Something else? Pick the closest match.' },
                  { step: '3', title: 'Paste your document', desc: 'Copy the text from your document and paste it in. You can paste the whole thing or just the important parts.' },
                  { step: '4', title: 'Get a plain-English explanation', desc: 'The AI reads it and explains what\'s important, what\'s risky, and what you should do next. In words you understand.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-black">{step}</span>
                    <div>
                      <h3 className="font-bold text-warm-900 text-sm">{title}</h3>
                      <p className="text-sm text-warm-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">Why it's safe</h2>
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: '🔒', title: 'Completely private', desc: 'The AI runs on your computer, not on the internet. Your document never leaves your browser.' },
                { icon: '💸', title: 'Completely free', desc: 'No account needed. No payment. No limits. Use it as much as you want.' },
                { icon: '📡', title: 'Works without internet', desc: 'After the first setup, you can use this with your wifi turned off.' },
                { icon: '🚫', title: 'Nothing stored', desc: 'When you close the tab, your document is gone. We never see it. Nobody does.' },
              ].map(({ icon, title, desc }) => (
                <div key={title}>
                  <span className="text-xl">{icon}</span>
                  <h3 className="font-bold text-warm-900 mt-1 text-sm">{title}</h3>
                  <p className="text-xs text-warm-500 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">Common questions</h2>
              <div className="space-y-5">
                {[
                  { q: 'I\'m not technical. Can I use this?', a: 'Yes! Just click the green button, wait a minute, pick your document type, and paste. That\'s it. The AI explains everything in plain English.' },
                  { q: 'Is it really free?', a: 'Yes. It costs us nothing to run because your computer does all the work. There\'s no catch.' },
                  { q: 'What about my phone?', a: 'Sorry — this only works on a computer right now. Phones don\'t have the right technology yet. Use Chrome or Edge on a laptop or desktop.' },
                  { q: 'Can it read PDFs?', a: 'Not directly. You need to copy the text from the PDF and paste it in. On most computers, you can open a PDF, press Ctrl+A (select all), then Ctrl+C (copy), then paste here.' },
                  { q: 'How good is it compared to ChatGPT?', a: 'It\'s not as smart as ChatGPT, but it\'s completely private. For understanding contracts, bills, and meeting notes, it does a good job. For very complex analysis, you might want a more powerful tool.' },
                  { q: 'What happens to my document after?', a: 'Nothing. It exists only in your browser while you\'re using it. Close the tab and it\'s gone. We never see it, store it, or have access to it.' },
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
              <p className="text-xs text-warm-400">
                Powered by <a href="https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/" target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:underline">Google Gemma</a>. Your data stays yours.
              </p>
              <Link to="/projects" className="text-sm font-semibold text-fire-500 hover:text-fire-600 mt-2 inline-block">
                Explore more tools &rarr;
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
