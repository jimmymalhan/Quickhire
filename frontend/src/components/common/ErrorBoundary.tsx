import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"
          role="alert"
        >
          <div className="card max-w-md text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
