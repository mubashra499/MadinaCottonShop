import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="card p-8 text-center">
            <h2 className="mb-2 text-xl font-bold text-neutral-900 dark:text-white">Something went wrong</h2>
            <p className="mb-4 text-sm text-neutral-500">
              {this.state.error?.message ?? 'An unexpected error occurred while loading this page.'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '/shop'; }}
                className="btn-primary"
              >
                Back to Shop
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                className="btn-outline"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
