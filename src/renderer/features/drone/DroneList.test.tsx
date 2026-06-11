import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';

import { DroneList } from './DroneList';
import type { Drone } from './types';

const droneData = vi.fn<[], Drone[]>();
const telemetryMock = vi.fn();

vi.mock('./hooks/useDrones', () => ({
  useDrones: () => droneData(),
}));
vi.mock('../../contexts/TelemetryContext', () => ({
  useTelemetry: () => telemetryMock(),
}));
vi.mock('../../hooks/useDistanceUnit', () => ({
  useDistanceUnit: () => 'miles',
}));

const makeDrone = (overrides: Partial<Drone>): Drone => ({
  droneId: 'DR1',
  manufacturer: 'DJI',
  model: 'Mini',
  droneLat: 40,
  droneLon: -73,
  droneAltitude: 120,
  operatorLat: 40,
  operatorLon: -73,
  speed: 5,
  heading: 90,
  lastSeen: Date.now(),
  distance: 16.09344,
  ...overrides,
});

const setRidAvailable = (ridAvailable: boolean): void => {
  telemetryMock.mockReturnValue({ telemetry: { drone: { ridAvailable } } });
};

const SelectionProbe: React.FC = () => {
  const { selectedDroneId } = useSelection();
  return <div data-testid="selected">{selectedDroneId ?? 'none'}</div>;
};

describe('DroneList', () => {
  beforeEach(() => {
    droneData.mockReturnValue([]);
    setRidAvailable(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Remote ID unavailable state when rid is off', () => {
    setRidAvailable(false);
    render(
      <SelectionProvider>
        <DroneList />
      </SelectionProvider>,
    );
    expect(screen.getByText('Remote ID Unavailable')).toBeInTheDocument();
  });

  it('shows the empty state when rid is available but no drones', () => {
    render(
      <SelectionProvider>
        <DroneList />
      </SelectionProvider>,
    );
    expect(screen.getByText('No drones detected')).toBeInTheDocument();
  });

  it('renders a row per drone with formatted cells', () => {
    droneData.mockReturnValue([
      makeDrone({ droneId: 'D9', manufacturer: 'Autel', droneAltitude: 88 }),
    ]);
    render(
      <SelectionProvider>
        <DroneList />
      </SelectionProvider>,
    );
    const row = screen.getByText('D9').closest('tr') as HTMLElement;
    const cells = within(row);
    expect(cells.getByText('Autel')).toBeInTheDocument();
    expect(cells.getByText('88')).toBeInTheDocument();
    expect(cells.getByText('10.0 mi')).toBeInTheDocument();
  });

  it('shows em dashes for null manufacturer/altitude/distance', () => {
    droneData.mockReturnValue([
      makeDrone({ droneId: 'D0', manufacturer: null, droneAltitude: null, distance: undefined }),
    ]);
    render(
      <SelectionProvider>
        <DroneList />
      </SelectionProvider>,
    );
    const row = screen.getByText('D0').closest('tr') as HTMLElement;
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('selects a drone when its row is clicked', async () => {
    const user = userEvent.setup();
    droneData.mockReturnValue([makeDrone({ droneId: 'PICK' })]);
    render(
      <SelectionProvider>
        <DroneList />
        <SelectionProbe />
      </SelectionProvider>,
    );
    await user.click(screen.getByText('PICK'));
    expect(screen.getByTestId('selected')).toHaveTextContent('PICK');
  });
});
