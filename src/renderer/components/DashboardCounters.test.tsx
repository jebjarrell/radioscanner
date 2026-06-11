import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Aircraft } from '../features/aircraft/types';
import type { Drone } from '../features/drone/types';
import type { SignalSample } from '../hooks/useSignals';

import { DashboardCounters } from './DashboardCounters';

const telemetryMock = vi.fn();
const aircraftMock = vi.fn<[], Aircraft[]>();
const dronesMock = vi.fn<[], Drone[]>();
const signalsMock = vi.fn<[], SignalSample[]>();

vi.mock('../contexts/TelemetryContext', () => ({
  useTelemetry: () => telemetryMock(),
}));
vi.mock('../features/aircraft/hooks/useAircraft', () => ({
  useAircraft: () => aircraftMock(),
}));
vi.mock('../features/drone/hooks/useDrones', () => ({
  useDrones: () => dronesMock(),
}));
vi.mock('../hooks/useSignals', () => ({
  useSignals: () => signalsMock(),
}));
vi.mock('./SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}));

const makeAircraft = (callsign: string): Aircraft => ({
  icao: callsign,
  callsign,
  lat: 0,
  lon: 0,
  altitude: 0,
  speed: 0,
  heading: 0,
  verticalRate: null,
  squawk: null,
  lastSeen: Date.now(),
});

const makeDrone = (manufacturer: string | null): Drone => ({
  droneId: `id-${manufacturer}-${Math.random()}`,
  manufacturer,
  model: null,
  droneLat: null,
  droneLon: null,
  droneAltitude: null,
  operatorLat: null,
  operatorLon: null,
  speed: null,
  heading: null,
  lastSeen: Date.now(),
});

describe('DashboardCounters', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    telemetryMock.mockReturnValue({ telemetry: { signals: { rtlTcpConnected: true } } });
    aircraftMock.mockReturnValue([]);
    dronesMock.mockReturnValue([]);
    signalsMock.mockReturnValue([]);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('counts commercial vs private aircraft from recent telemetry', () => {
    aircraftMock.mockReturnValue([
      makeAircraft('UAL123'), // commercial pattern
      makeAircraft('DAL45'), // commercial pattern
      makeAircraft('N12345'), // private
    ]);
    render(<DashboardCounters />);

    const aircraftCard = screen.getByText('Aircraft (last 60s)').closest('section') as HTMLElement;
    const card = within(aircraftCard);
    expect(card.getByText('Commercial').nextElementSibling).toHaveTextContent('2');
    expect(card.getByText('Private').nextElementSibling).toHaveTextContent('1');
  });

  it('shows the empty drones state', () => {
    render(<DashboardCounters />);
    expect(screen.getByText('No drones detected')).toBeInTheDocument();
  });

  it('breaks drones down by manufacturer', () => {
    dronesMock.mockReturnValue([makeDrone('DJI'), makeDrone('DJI'), makeDrone('Autel')]);
    render(<DashboardCounters />);
    const droneCard = screen.getByText('Drones (last 30s)').closest('section') as HTMLElement;
    const card = within(droneCard);
    expect(card.getByText('DJI').nextElementSibling).toHaveTextContent('2');
    expect(card.getByText('Autel').nextElementSibling).toHaveTextContent('1');
  });

  it('starts a scan via the backend when Start Scan is clicked', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    render(<DashboardCounters />);

    await user.click(screen.getByRole('button', { name: 'Start Scan' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/scan/start'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Stop Scan' })).toBeInTheDocument();
  });

  it('renders band options in the quick controls', () => {
    render(<DashboardCounters />);
    const select = screen.getByLabelText('Active Band');
    expect(within(select).getByRole('option', { name: 'Airband' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Marine' })).toBeInTheDocument();
  });
});
