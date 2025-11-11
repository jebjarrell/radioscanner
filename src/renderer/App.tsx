import React from 'react';

import { MainContent } from './components/MainContent';
import { TopBar } from './components/TopBar';
import { GPSProvider } from './contexts/GPSContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { TelemetryProvider } from './contexts/TelemetryContext';
import { ToastProvider } from './contexts/ToastContext';
import { AircraftDetail } from './features/aircraft/AircraftDetail';
import { DroneDetail } from './features/drone/DroneDetail';
import { useNotifications } from './hooks/useNotifications';

const AppContent: React.FC = () => {
  useNotifications();

  return (
    <div className="app-container">
      <TopBar />
      <MainContent />
      <AircraftDetail />
      <DroneDetail />
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider defaultPosition="top-right" defaultDuration={4000}>
    <TelemetryProvider>
      <GPSProvider>
        <SelectionProvider>
          <AppContent />
        </SelectionProvider>
      </GPSProvider>
    </TelemetryProvider>
  </ToastProvider>
);
