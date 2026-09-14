import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Boundary Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-900 text-white p-6 select-none font-sans">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center text-rose-500 mb-6 animate-pulse">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-rose-400 uppercase tracking-wider text-center">Something went wrong</h2>
          <p className="text-[11px] text-slate-400 mt-2 font-mono text-center max-w-xs leading-relaxed">
            {this.state.error?.message || 'An unexpected runtime crash was protected by KonnectS Boundary'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-8 flex items-center gap-2 px-5 py-3 bg-brand bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-lg border-none cursor-pointer"
          >
            <RefreshCw size={12} className="animate-spin-slow" />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
