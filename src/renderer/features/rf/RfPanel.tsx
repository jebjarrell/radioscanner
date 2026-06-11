import React from 'react';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useRfStream } from '../../hooks/useRfStream';

import { EnhancedRfSpectrum } from './EnhancedRfSpectrum';
import { EnhancedRfWaterfall } from './EnhancedRfWaterfall';
import { RfControls } from './RfControls';

export const RfPanel: React.FC = () => {
  const frame = useRfStream();

  return (
    <ErrorBoundary label="RF panel">
      <div className="rf-panel">
        <RfControls />
        <div className="rf-panel__section">
          <EnhancedRfSpectrum frame={frame} />
        </div>
        <div className="rf-panel__section">
          <EnhancedRfWaterfall frame={frame} />
        </div>
      </div>
    </ErrorBoundary>
  );
};
