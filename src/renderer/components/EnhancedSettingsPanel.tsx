import React, { useState } from 'react';

import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../hooks/useSettings';

type TabId = 'services' | 'preferences' | 'notifications' | 'performance';

interface EnhancedSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnhancedSettingsPanel: React.FC<EnhancedSettingsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, loading, updateBulk, testConnection, resetSettings } = useSettings();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('services');
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [testingService, setTestingService] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string, fallback: string = ''): string => {
    if (key in pendingChanges) return pendingChanges[key];

    const parts = key.split('.');
    let current: unknown = settings;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return fallback;
      }
    }
    return String(current ?? fallback);
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      showToast('No changes to save', 'info');
      return;
    }

    setIsSaving(true);
    const updates = Object.entries(pendingChanges).map(([key, value]) => ({ key, value }));
    const result = await updateBulk(updates);
    setIsSaving(false);

    if (result.success) {
      setPendingChanges({});
      showToast('Settings saved successfully', 'success');
      if (result.requiresRestart) {
        showToast('⚠ Application restart required for changes to take effect', 'warning', 8000);
      }
    } else {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleCancel = () => {
    setPendingChanges({});
    onClose();
  };

  const handleReset = async (section?: string) => {
    const confirmed = confirm(
      section
        ? `Reset ${section} settings to defaults?`
        : 'Reset all settings to defaults? This cannot be undone.',
    );
    if (!confirmed) return;

    const result = await resetSettings(section);
    if (result.success) {
      setPendingChanges({});
      showToast('Settings reset to defaults', 'success');
      if (result.requiresRestart) {
        showToast('⚠ Application restart required', 'warning', 8000);
      }
    } else {
      showToast('Failed to reset settings', 'error');
    }
  };

  const handleTestConnection = async (service: string, host: string, port: number) => {
    setTestingService(service);
    const result = await testConnection(service, host, port);
    setTestingService(null);

    if (result.success) {
      showToast(`✓ ${service} connected (${result.latencyMs}ms)`, 'success');
    } else {
      showToast(`✕ ${service} connection failed: ${result.error}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="settings-overlay">
        <div className="settings-panel">
          <div className="settings-loading">Loading settings...</div>
        </div>
      </div>
    );
  }

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Application Settings</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-tabs">
          <button
            type="button"
            className={`settings-tab ${activeTab === 'services' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            Services
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === 'preferences' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === 'notifications' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === 'performance' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'services' && (
            <div className="settings-section">
              <h3>Service URLs</h3>
              <p className="settings-description">
                Configure connection endpoints for external services. Changes require application
                restart.
              </p>

              <div className="settings-group">
                <label className="settings-label">Backend Server</label>
                <div className="settings-row">
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="Host"
                    value={getValue('services.backendHost')}
                    onChange={(e) => handleChange('services.backendHost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="settings-input settings-input--small"
                    placeholder="Port"
                    value={getValue('services.backendPort')}
                    onChange={(e) => handleChange('services.backendPort', e.target.value)}
                  />
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">dump1090 (ADS-B)</label>
                <div className="settings-row">
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="Host"
                    value={getValue('services.dump1090Host')}
                    onChange={(e) => handleChange('services.dump1090Host', e.target.value)}
                  />
                  <input
                    type="number"
                    className="settings-input settings-input--small"
                    placeholder="Port"
                    value={getValue('services.dump1090Port')}
                    onChange={(e) => handleChange('services.dump1090Port', e.target.value)}
                  />
                  <button
                    type="button"
                    className="settings-btn settings-btn--test"
                    disabled={testingService === 'dump1090'}
                    onClick={() =>
                      handleTestConnection(
                        'dump1090',
                        getValue('services.dump1090Host'),
                        parseInt(getValue('services.dump1090Port')),
                      )
                    }
                  >
                    {testingService === 'dump1090' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">Kismet</label>
                <div className="settings-row">
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="Host"
                    value={getValue('services.kismetHost')}
                    onChange={(e) => handleChange('services.kismetHost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="settings-input settings-input--small"
                    placeholder="Port"
                    value={getValue('services.kismetPort')}
                    onChange={(e) => handleChange('services.kismetPort', e.target.value)}
                  />
                  <button
                    type="button"
                    className="settings-btn settings-btn--test"
                    disabled={testingService === 'kismet'}
                    onClick={() =>
                      handleTestConnection(
                        'kismet',
                        getValue('services.kismetHost'),
                        parseInt(getValue('services.kismetPort')),
                      )
                    }
                  >
                    {testingService === 'kismet' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">RTL-SDR (rtl_tcp)</label>
                <div className="settings-row">
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="Host"
                    value={getValue('services.rtlTcpHost')}
                    onChange={(e) => handleChange('services.rtlTcpHost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="settings-input settings-input--small"
                    placeholder="Port"
                    value={getValue('services.rtlTcpPort')}
                    onChange={(e) => handleChange('services.rtlTcpPort', e.target.value)}
                  />
                  <button
                    type="button"
                    className="settings-btn settings-btn--test"
                    disabled={testingService === 'rtlTcp'}
                    onClick={() =>
                      handleTestConnection(
                        'rtlTcp',
                        getValue('services.rtlTcpHost'),
                        parseInt(getValue('services.rtlTcpPort')),
                      )
                    }
                  >
                    {testingService === 'rtlTcp' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">GPSd</label>
                <div className="settings-row">
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="Host"
                    value={getValue('services.gpsdHost')}
                    onChange={(e) => handleChange('services.gpsdHost', e.target.value)}
                  />
                  <input
                    type="number"
                    className="settings-input settings-input--small"
                    placeholder="Port"
                    value={getValue('services.gpsdPort')}
                    onChange={(e) => handleChange('services.gpsdPort', e.target.value)}
                  />
                  <button
                    type="button"
                    className="settings-btn settings-btn--test"
                    disabled={testingService === 'gpsd'}
                    onClick={() =>
                      handleTestConnection(
                        'gpsd',
                        getValue('services.gpsdHost'),
                        parseInt(getValue('services.gpsdPort')),
                      )
                    }
                  >
                    {testingService === 'gpsd' ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="settings-btn settings-btn--reset"
                onClick={() => handleReset('services')}
              >
                Reset Services to Defaults
              </button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-section">
              <h3>User Preferences</h3>
              <p className="settings-description">
                Customize display units, map appearance, and default view settings.
              </p>

              <div className="settings-group">
                <label className="settings-label">Distance Units</label>
                <select
                  className="settings-select"
                  value={getValue('preferences.distanceUnit')}
                  onChange={(e) => handleChange('preferences.distanceUnit', e.target.value)}
                >
                  <option value="miles">Miles</option>
                  <option value="kilometers">Kilometers</option>
                  <option value="nautical">Nautical Miles</option>
                </select>
              </div>

              <div className="settings-group">
                <label className="settings-label">Map Style</label>
                <select
                  className="settings-select"
                  value={getValue('preferences.mapStyle')}
                  onChange={(e) => handleChange('preferences.mapStyle', e.target.value)}
                >
                  <option value="offline">Offline (Local Tiles)</option>
                  <option value="demotiles">MapLibre Demo Tiles</option>
                  <option value="osm">OpenStreetMap</option>
                  <option value="dark">Dark Mode</option>
                  <option value="satellite">Satellite</option>
                </select>
              </div>

              <div className="settings-group">
                <label className="settings-label">Default Map Center (Latitude)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="settings-input"
                  value={getValue('preferences.mapDefaultCenterLat')}
                  onChange={(e) => handleChange('preferences.mapDefaultCenterLat', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Default Map Center (Longitude)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="settings-input"
                  value={getValue('preferences.mapDefaultCenterLon')}
                  onChange={(e) => handleChange('preferences.mapDefaultCenterLon', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Default Map Zoom</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="20"
                  className="settings-input"
                  value={getValue('preferences.mapDefaultZoom')}
                  onChange={(e) => handleChange('preferences.mapDefaultZoom', e.target.value)}
                />
              </div>

              <button
                type="button"
                className="settings-btn settings-btn--reset"
                onClick={() => handleReset('preferences')}
              >
                Reset Preferences to Defaults
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h3>Notifications</h3>
              <p className="settings-description">
                Configure toast notifications for real-time alerts.
              </p>

              <div className="settings-group">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={getValue('notifications.enabled') === 'true'}
                    onChange={(e) =>
                      handleChange('notifications.enabled', e.target.checked ? 'true' : 'false')
                    }
                  />
                  <span>Enable Notifications</span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={getValue('notifications.droneDetected') === 'true'}
                    onChange={(e) =>
                      handleChange(
                        'notifications.droneDetected',
                        e.target.checked ? 'true' : 'false',
                      )
                    }
                  />
                  <span>Drone Detected Alert</span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={getValue('notifications.aircraftProximity') === 'true'}
                    onChange={(e) =>
                      handleChange(
                        'notifications.aircraftProximity',
                        e.target.checked ? 'true' : 'false',
                      )
                    }
                  />
                  <span>Aircraft Proximity Alert</span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-label">Proximity Threshold (miles)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="settings-input"
                  value={getValue('notifications.aircraftProximityThresholdMiles')}
                  onChange={(e) =>
                    handleChange('notifications.aircraftProximityThresholdMiles', e.target.value)
                  }
                />
              </div>

              <div className="settings-group">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={getValue('notifications.newSignal') === 'true'}
                    onChange={(e) =>
                      handleChange('notifications.newSignal', e.target.checked ? 'true' : 'false')
                    }
                  />
                  <span>New Signal Detected Alert</span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-label">Toast Duration (milliseconds)</label>
                <input
                  type="number"
                  min="1000"
                  max="10000"
                  step="1000"
                  className="settings-input"
                  value={getValue('notifications.duration')}
                  onChange={(e) => handleChange('notifications.duration', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Toast Position</label>
                <select
                  className="settings-select"
                  value={getValue('notifications.position')}
                  onChange={(e) => handleChange('notifications.position', e.target.value)}
                >
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>

              <button
                type="button"
                className="settings-btn settings-btn--reset"
                onClick={() => handleReset('notifications')}
              >
                Reset Notifications to Defaults
              </button>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="settings-section">
              <h3>Performance Tuning</h3>
              <p className="settings-description">
                Adjust performance settings for optimal display and responsiveness.
              </p>

              <div className="settings-group">
                <label className="settings-label">Waterfall History (rows)</label>
                <input
                  type="number"
                  min="40"
                  max="200"
                  step="10"
                  className="settings-input"
                  value={getValue('performance.waterfallMaxRows')}
                  onChange={(e) => handleChange('performance.waterfallMaxRows', e.target.value)}
                />
                <p className="settings-hint">More rows = more history, slower rendering</p>
              </div>

              <div className="settings-group">
                <label className="settings-label">Max Aircraft Displayed</label>
                <input
                  type="number"
                  min="40"
                  max="200"
                  step="10"
                  className="settings-input"
                  value={getValue('performance.maxAircraftDisplayed')}
                  onChange={(e) => handleChange('performance.maxAircraftDisplayed', e.target.value)}
                />
                <p className="settings-hint">Limit for better performance on slower systems</p>
              </div>

              <div className="settings-group">
                <label className="settings-label">Peak Detection Sensitivity</label>
                <select
                  className="settings-select"
                  value={getValue('performance.peakDetectionSensitivity')}
                  onChange={(e) =>
                    handleChange('performance.peakDetectionSensitivity', e.target.value)
                  }
                >
                  <option value="low">Low (Fewer peaks, more strict)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (More peaks, more sensitive)</option>
                </select>
              </div>

              <div className="settings-group">
                <label className="settings-label">Telemetry Update Interval (ms)</label>
                <input
                  type="number"
                  min="500"
                  max="5000"
                  step="500"
                  className="settings-input"
                  value={getValue('performance.telemetryUpdateInterval')}
                  onChange={(e) =>
                    handleChange('performance.telemetryUpdateInterval', e.target.value)
                  }
                />
                <p className="settings-hint">Lower = more frequent updates, higher CPU usage</p>
              </div>

              <button
                type="button"
                className="settings-btn settings-btn--reset"
                onClick={() => handleReset('performance')}
              >
                Reset Performance to Defaults
              </button>
            </div>
          )}
        </div>

        <div className="settings-footer">
          {hasChanges && <div className="settings-warning">⚠ You have unsaved changes</div>}
          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="settings-btn settings-btn--primary"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
