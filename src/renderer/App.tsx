import React from 'react';

import { MainContent } from './components/MainContent';
import { TopBar } from './components/TopBar';
import { WaterfallView } from './components/WaterfallView';
import { SelectionProvider } from './contexts/SelectionContext';
import { TelemetryProvider } from './contexts/TelemetryContext';
import { AircraftDetail } from './features/aircraft/AircraftDetail';

export const App: React.FC = () => (
  <TelemetryProvider>
    <SelectionProvider>
      <div className="app-container">
        <TopBar />
        <MainContent />
        <WaterfallView />
        <AircraftDetail />
      </div>
    </SelectionProvider>
  </TelemetryProvider>
);
