import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import React, { type ReactElement, type ReactNode } from 'react';

import { SelectionProvider } from './contexts/SelectionContext';
import { ToastProvider } from './contexts/ToastContext';

/**
 * Test-only providers that do NOT touch the network. The real TelemetryProvider
 * opens a WebSocket and IndexedDB, so tests that need telemetry/GPS data should
 * mock the underlying hooks/contexts instead of mounting the real providers.
 */
export const AllProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ToastProvider>
    <SelectionProvider>{children}</SelectionProvider>
  </ToastProvider>
);

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
