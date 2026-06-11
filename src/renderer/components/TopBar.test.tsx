import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelemetryFrame } from '../types';

import { TopBar } from './TopBar';

const telemetryMock = vi.fn();

vi.mock('../contexts/TelemetryContext', () => ({
  useTelemetry: () => telemetryMock(),
}));

// Stub the heavy child dialogs; we only verify TopBar opens them.
vi.mock('./EnhancedSettingsPanel', () => ({
  EnhancedSettingsPanel: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="settings-panel">settings</div> : null,
}));
vi.mock('./ExportDialog', () => ({
  ExportDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="export-dialog">export</div> : null,
}));

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

const setTelemetry = (telemetry: DeepPartial<TelemetryFrame> | null, connected: boolean): void => {
  telemetryMock.mockReturnValue({ telemetry, connected });
};

describe('TopBar', () => {
  beforeEach(() => {
    setTelemetry(null, false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the offline connection pill when disconnected', () => {
    render(<TopBar />);
    expect(screen.getByText('Telemetry Offline')).toBeInTheDocument();
  });

  it('shows the connected pill when connected', () => {
    setTelemetry({}, true);
    render(<TopBar />);
    expect(screen.getByText('Telemetry Connected')).toBeInTheDocument();
  });

  it('renders a service indicator for each tracked service', () => {
    render(<TopBar />);
    for (const label of ['SDR', 'ADS-B', 'Kismet', 'GPS']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('marks services green based on health predicates', () => {
    setTelemetry(
      {
        health: {
          rtlTcp: { connected: true },
          dump1090: { healthy: true },
          kismet: { ridEnabled: false },
          gps: { connected: true },
        },
      },
      true,
    );
    render(<TopBar />);
    const sdrLed = screen.getByText('SDR').closest('.service-indicator')?.querySelector('.led');
    const kismetLed = screen
      .getByText('Kismet')
      .closest('.service-indicator')
      ?.querySelector('.led');
    expect(sdrLed?.className).toContain('led-green');
    expect(kismetLed?.className).toContain('led-red');
  });

  it('opens the settings panel and the export dialog', async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
  });
});
