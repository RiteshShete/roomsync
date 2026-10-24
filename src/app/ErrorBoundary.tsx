import { Component, type ErrorInfo, type ReactNode } from 'react';
import { copy } from '@/copy';
import { ErrorState } from '@/ui';

/** Last line of defence for render errors: a readable screen with a reload, never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only: no third-party error reporting exists, and nothing sensitive is sent anywhere.
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center">
        <ErrorState message={copy.errors.generic} onRetry={() => window.location.reload()} retryLabel={copy.states.reload} />
      </div>
    );
  }
}
