import React from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';

export const DashboardCounters: React.FC = () => {
  const { telemetry } = useTelemetry();
  const aircraftCount = telemetry?.aircraft?.length ?? 0;
  const droneCount = 0;
  const signalCount = 0;

  return (
    <div className="dashboard-counters">
      <div className="counter">
        <span className="counter-label">Aircraft</span>
        <span className="counter-value">{aircraftCount}</span>
      </div>
      <div className="counter">
        <span className="counter-label">Drones</span>
        <span className="counter-value">{droneCount}</span>
      </div>
      <div className="counter">
        <span className="counter-label">RF Signals</span>
        <span className="counter-value">{signalCount}</span>
      </div>
    </div>
  );
};
