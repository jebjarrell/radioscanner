import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastContext';

const Trigger: React.FC = () => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('Hello toast', 'success', 0)}>
      fire
    </button>
  );
};

describe('ToastContext', () => {
  it('shows a toast through the provider and dismisses it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Hello toast')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', async () => {
    const user = userEvent.setup();
    const Multi: React.FC = () => {
      const { showToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => showToast(`msg-${Date.now()}-${Math.random()}`, 'info', 0)}
        >
          add
        </button>
      );
    };
    render(
      <ToastProvider>
        <Multi />
      </ToastProvider>,
    );
    const add = screen.getByRole('button', { name: 'add' });
    await user.click(add);
    await user.click(add);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('throws when useToast is used outside a provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Orphan: React.FC = () => {
      useToast();
      return null;
    };
    expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider');
    errorSpy.mockRestore();
  });
});
