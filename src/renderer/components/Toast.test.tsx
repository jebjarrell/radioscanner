import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast';

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message and an alert role', () => {
    render(
      <Toast
        id="t1"
        message="Hello"
        type="info"
        duration={0}
        position="top-right"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Hello');
  });

  it('calls onDismiss when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast
        id="t2"
        message="Bye"
        type="error"
        duration={0}
        position="top-right"
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledWith('t2');
  });

  it('auto-dismisses after the duration elapses', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        id="t3"
        message="Auto"
        type="success"
        duration={3000}
        position="top-left"
        onDismiss={onDismiss}
      />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onDismiss).toHaveBeenCalledWith('t3');
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        id="t4"
        message="Sticky"
        type="warning"
        duration={0}
        position="top-right"
        onDismiss={onDismiss}
      />,
    );
    vi.advanceTimersByTime(100000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('applies type and position class names', () => {
    render(
      <Toast
        id="t5"
        message="x"
        type="success"
        duration={0}
        position="bottom-left"
        onDismiss={vi.fn()}
      />,
    );
    const el = screen.getByRole('alert');
    expect(el.className).toContain('toast--success');
    expect(el.className).toContain('toast--bottom-left');
  });
});
