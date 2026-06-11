import React, { Component, type ErrorInfo, type ReactNode } from 'react';

import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Optional label used in the fallback heading (e.g. "RF panel"). */
  label?: string;
  /** Optional custom fallback renderer. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Class-based React error boundary.
 *
 * Catches render/lifecycle errors in its subtree and shows a dark-themed
 * fallback UI with "Try again" (resets boundary state) and "Reload"
 * (reloads the window) actions. Wrapping independent panels in their own
 * boundary keeps one crashing panel from taking down the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    const scope = this.props.label ? `[ErrorBoundary:${this.props.label}]` : '[ErrorBoundary]';
    console.error(`${scope} Caught render error:`, error, info.componentStack);
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null });
  };

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.handleReset);
      }

      const heading = this.props.label
        ? `The ${this.props.label} ran into a problem`
        : 'Something went wrong';

      return (
        <div className={styles.container} role="alert">
          <h2 className={styles.title}>{heading}</h2>
          <p className={styles.message}>
            This section stopped responding. You can try again or reload the app.
          </p>
          {error.message && <pre className={styles.detail}>{error.message}</pre>}
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={this.handleReset}>
              Try again
            </button>
            <button type="button" className={styles.secondaryButton} onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
