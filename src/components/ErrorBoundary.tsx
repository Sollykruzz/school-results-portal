import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  // Wipes only the saved offline copy of school data (not the database) and reloads
  public handleClearCacheAndReload = () => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('school_portal_firebase_cache') || k === 'school_portal_website_cache')
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[250px] w-full p-6 flex flex-col items-center justify-center bg-rose-50/70 border border-rose-200 rounded-2xl text-center my-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {this.props.fallbackTitle || 'Unable to display view'}
          </h3>
          <p className="text-xs text-slate-600 max-w-md mb-4">
            {this.props.fallbackMessage ||
              'A temporary issue occurred while rendering this section. Please try refreshing or reopening.'}
          </p>
          {this.state.error && (
            <p className="text-[11px] font-mono whitespace-pre-wrap text-rose-800 bg-rose-100/70 border border-rose-200 rounded-lg px-3 py-2 mb-4 max-w-md break-words text-left select-all">
              {String(this.state.error.message || this.state.error)}
              {this.state.error.stack ? '\n' + this.state.error.stack.split('\n').slice(1, 4).join('\n') : ''}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleClearCacheAndReload}
            className="mb-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors cursor-pointer"
          >
            <span>Clear saved data and reload</span>
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


