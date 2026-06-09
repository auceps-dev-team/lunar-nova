import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800/30">
          <svg className="w-16 h-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Une erreur est survenue</h2>
          <p className="text-sm text-red-600 dark:text-red-300 text-center mb-4 max-w-md">
            L'application a rencontré un problème inattendu. L'erreur a été enregistrée.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            Recharger l'application
          </button>
          {this.state.error && (
            <div className="mt-6 w-full max-w-2xl bg-white dark:bg-gray-900 p-4 rounded-lg overflow-auto text-xs text-gray-500 font-mono shadow-inner max-h-40">
              <p className="font-bold mb-1">{this.state.error.toString()}</p>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
