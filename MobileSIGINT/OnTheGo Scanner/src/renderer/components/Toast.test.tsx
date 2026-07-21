import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toast, type ToastProps } from './Toast';

const baseProps: ToastProps = {
  id: 'toast-1',
  message: 'Test message',
  type: 'info',
  duration: 0,
  position: 'top-right',
  onDismiss: () => {},
};

function renderToast(overrides: Partial<ToastProps> = {}) {
  return render(<Toast {...baseProps} {...overrides} />);
}

describe('Toast', () => {
  it('renders the message inside an alert region', () => {
    renderToast({ message: 'Drone detected' });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Drone detected')).toBeInTheDocument();
  });

  it('shows the icon that matches the toast type', () => {
    renderToast({ type: 'success' });
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('applies type and position modifier classes', () => {
    const { container } = renderToast({ type: 'error', position: 'bottom-left' });
    expect(container.querySelector('.toast')).toHaveClass('toast--error', 'toast--bottom-left');
  });

  it('calls onDismiss with its id when the close button is clicked', () => {
    const onDismiss = vi.fn();
    renderToast({ id: 'abc', onDismiss });

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(onDismiss).toHaveBeenCalledWith('abc');
  });

  it('auto-dismisses after the given duration', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      renderToast({ id: 'timed', duration: 3000, onDismiss });

      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onDismiss).toHaveBeenCalledWith('timed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      renderToast({ duration: 0, onDismiss });

      act(() => {
        vi.advanceTimersByTime(100_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
