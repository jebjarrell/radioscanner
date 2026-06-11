import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';

import { AircraftList } from './AircraftList';
import type { Aircraft } from './types';

const aircraftData = vi.fn<[], Aircraft[]>();

vi.mock('./hooks/useAircraft', () => ({
  useAircraft: () => aircraftData(),
}));
vi.mock('../../hooks/useDistanceUnit', () => ({
  useDistanceUnit: () => 'miles',
}));
vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { performance: { maxAircraftDisplayed: 200 } } }),
}));

const makeAircraft = (overrides: Partial<Aircraft>): Aircraft => ({
  icao: 'AAA111',
  callsign: 'TEST1',
  lat: 40,
  lon: -73,
  altitude: 10000,
  speed: 300,
  heading: 90,
  verticalRate: null,
  squawk: null,
  lastSeen: Date.now(),
  distance: 12.3,
  ...overrides,
});

const SelectionProbe: React.FC = () => {
  const { selectedAircraftIcao } = useSelection();
  return <div data-testid="selected">{selectedAircraftIcao ?? 'none'}</div>;
};

describe('AircraftList', () => {
  beforeEach(() => {
    aircraftData.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when there are no aircraft', () => {
    render(
      <SelectionProvider>
        <AircraftList />
      </SelectionProvider>,
    );
    expect(screen.getByText('No aircraft detected')).toBeInTheDocument();
    expect(screen.getByText('Waiting for ADS-B telemetry…')).toBeInTheDocument();
  });

  it('renders a row per aircraft with formatted cells', () => {
    aircraftData.mockReturnValue([
      makeAircraft({
        icao: 'A1',
        callsign: 'UAL1',
        altitude: 35000,
        speed: 450,
        distance: 16.09344,
      }),
    ]);
    render(
      <SelectionProvider>
        <AircraftList />
      </SelectionProvider>,
    );
    const row = screen.getByText('UAL1').closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('35,000 ft')).toBeInTheDocument();
    expect(cells.getByText('450 kts')).toBeInTheDocument();
    expect(cells.getByText('10.0 mi')).toBeInTheDocument();
  });

  it('shows an em dash when distance is undefined', () => {
    aircraftData.mockReturnValue([makeAircraft({ callsign: 'NODIST', distance: undefined })]);
    render(
      <SelectionProvider>
        <AircraftList />
      </SelectionProvider>,
    );
    const row = screen.getByText('NODIST').closest('tr') as HTMLElement;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('selects an aircraft when its row is clicked', async () => {
    const user = userEvent.setup();
    aircraftData.mockReturnValue([makeAircraft({ icao: 'SEL1', callsign: 'PICKME' })]);
    render(
      <SelectionProvider>
        <AircraftList />
        <SelectionProbe />
      </SelectionProvider>,
    );
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    await user.click(screen.getByText('PICKME'));
    expect(screen.getByTestId('selected')).toHaveTextContent('SEL1');
  });

  it('re-sorts when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    aircraftData.mockReturnValue([
      makeAircraft({ icao: 'A', callsign: 'AAA', distance: 5 }),
      makeAircraft({ icao: 'B', callsign: 'BBB', distance: 1 }),
    ]);
    render(
      <SelectionProvider>
        <AircraftList />
      </SelectionProvider>,
    );
    // Default ascending distance => BBB (1) before AAA (5)
    let rows = screen.getAllByRole('row').slice(1); // drop header row
    expect(within(rows[0]).getByText('BBB')).toBeInTheDocument();

    await user.click(screen.getByRole('columnheader', { name: /Callsign/ }));
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('AAA')).toBeInTheDocument();
  });
});
