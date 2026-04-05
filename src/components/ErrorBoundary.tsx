import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; }

export class ToolErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[ToolErrorBoundary]', err); }
  reset = () => { this.setState({ hasError: false }); };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">💥</div>
        <h2 className="text-2xl font-extrabold text-warm-900 mb-2">This tool hit a snag</h2>
        <p className="text-warm-600 mb-6">
          Something broke while rendering this page. The rest of the site is fine.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={this.reset}
            className="px-5 py-2.5 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-lg transition-colors"
          >
            Try again
          </button>
          <a
            href="/projects"
            className="px-5 py-2.5 bg-warm-100 hover:bg-warm-200 text-warm-900 font-bold rounded-lg transition-colors"
          >
            Back to projects
          </a>
        </div>
      </div>
    );
  }
}
