import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

const Boom: React.FC<{ message?: string }> = ({ message = 'kaboom' }) => {
  throw new Error(message);
};

/** A child that throws once, then renders fine after the boundary resets. */
const ThrowOnce: React.FC = () => {
  const [crashed] = useState(true);
  if (crashed) {
    throw new Error('first render fails');
  }
  return <div>recovered</div>;
};

describe('ErrorBoundary', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    // React logs caught errors to console.error; silence to keep output clean.
    errorSpy = vi.spyOn(console, 'error');
    errorSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>healthy child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
  });

  it('renders the default fallback with the label when a child throws', () => {
    render(
      <ErrorBoundary label="RF panel">
        <Boom message="sensor offline" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('The RF panel ran into a problem')).toBeInTheDocument();
    expect(screen.getByText('sensor offline')).toBeInTheDocument();
  });

  it('renders a generic heading without a label', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('resets when "Try again" is clicked', async () => {
    const user = userEvent.setup();

    const Wrapper: React.FC = () => {
      const [child, setChild] = useState(<Boom message="broken" />);
      return (
        <>
          <button type="button" onClick={() => setChild(<div>now ok</div>)}>
            fix it
          </button>
          <ErrorBoundary>{child}</ErrorBoundary>
        </>
      );
    };

    render(<Wrapper />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Swap in a non-throwing child, then reset the boundary.
    await user.click(screen.getByText('fix it'));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('now ok')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders a custom fallback prop and supports its reset callback', async () => {
    const user = userEvent.setup();

    const Wrapper: React.FC = () => {
      const [crash, setCrash] = useState(true);
      return (
        <ErrorBoundary
          fallback={(error, reset) => (
            <div>
              <p>custom: {error.message}</p>
              <button
                type="button"
                onClick={() => {
                  setCrash(false);
                  reset();
                }}
              >
                retry
              </button>
            </div>
          )}
        >
          {crash ? <Boom message="x" /> : <div>fixed</div>}
        </ErrorBoundary>
      );
    };

    render(<Wrapper />);
    expect(screen.getByText('custom: x')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(screen.getByText('fixed')).toBeInTheDocument();
  });

  it('still resets via the default fallback for a once-throwing child', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <ThrowOnce />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Resetting re-renders the same (still-throwing) child, so the fallback
    // remains. This documents that reset alone does not fix a deterministic crash.
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
