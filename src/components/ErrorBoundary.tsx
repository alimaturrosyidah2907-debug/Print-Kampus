import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PRINT KAMPUS ErrorBoundary:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyDetail = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed.error) {
        friendlyDetail = `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} di ${parsed.path})` : ''}`;
      }
    } catch {
      // plain error string
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-3xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-7 shadow-xl space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Terjadi Kendala Akses Data
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
            {friendlyDetail}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Muat Ulang Tampilan</span>
          </button>
        </div>
      </div>
    );
  }
}
