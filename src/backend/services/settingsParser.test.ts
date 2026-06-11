import { describe, expect, it } from 'vitest';

import { parseSettings, requiresRestart } from './settingsParser.js';

describe('parseSettings', () => {
  it('returns defaults for an empty input', () => {
    const settings = parseSettings({});

    expect(settings.session.storageMode).toBe('memory');
    expect(settings.services.backendHost).toBe('127.0.0.1');
    expect(settings.services.backendPort).toBe(3000);
    expect(settings.services.dump1090Port).toBe(8080);
    expect(settings.services.kismetPort).toBe(2501);
    expect(settings.services.rtlTcpPort).toBe(1234);
    expect(settings.services.gpsdPort).toBe(2947);
    expect(settings.preferences.distanceUnit).toBe('miles');
    expect(settings.preferences.mapDefaultCenterLat).toBeCloseTo(40.7306);
    expect(settings.notifications.enabled).toBe(true);
    expect(settings.notifications.aircraftProximity).toBe(false);
    expect(settings.notifications.duration).toBe(4000);
    expect(settings.performance.waterfallMaxRows).toBe(100);
    expect(settings.performance.peakDetectionSensitivity).toBe('medium');
  });

  it('coerces numeric strings to numbers', () => {
    const settings = parseSettings({
      'services.backendPort': '4000',
      'preferences.mapDefaultZoom': '12.5',
      'notifications.duration': '2000',
    });

    expect(settings.services.backendPort).toBe(4000);
    expect(settings.preferences.mapDefaultZoom).toBe(12.5);
    expect(settings.notifications.duration).toBe(2000);
  });

  it('falls back to the default for non-numeric values', () => {
    const settings = parseSettings({
      'services.backendPort': 'not-a-number',
      'preferences.mapDefaultZoom': '',
      'notifications.duration': 'NaN',
    });

    expect(settings.services.backendPort).toBe(3000);
    expect(settings.preferences.mapDefaultZoom).toBeCloseTo(9.5);
    expect(settings.notifications.duration).toBe(4000);
  });

  it('coerces booleans from true/false/1/0 case-insensitively', () => {
    expect(parseSettings({ 'notifications.enabled': 'false' }).notifications.enabled).toBe(false);
    expect(parseSettings({ 'notifications.enabled': '0' }).notifications.enabled).toBe(false);
    expect(
      parseSettings({ 'notifications.aircraftProximity': 'TRUE' }).notifications.aircraftProximity,
    ).toBe(true);
    expect(
      parseSettings({ 'notifications.aircraftProximity': '1' }).notifications.aircraftProximity,
    ).toBe(true);
  });

  it('uses the boolean fallback for unrecognized boolean values', () => {
    const settings = parseSettings({ 'notifications.enabled': 'maybe' });
    expect(settings.notifications.enabled).toBe(true);
  });

  it('maps storageMode disk explicitly and falls back to memory otherwise', () => {
    expect(parseSettings({ 'session.storageMode': 'disk' }).session.storageMode).toBe('disk');
    expect(parseSettings({ 'session.storageMode': 'garbage' }).session.storageMode).toBe('memory');
  });

  it('passes through string preferences', () => {
    const settings = parseSettings({
      'preferences.distanceUnit': 'kilometers',
      'preferences.mapStyle': 'satellite',
      'notifications.position': 'bottom-left',
    });

    expect(settings.preferences.distanceUnit).toBe('kilometers');
    expect(settings.preferences.mapStyle).toBe('satellite');
    expect(settings.notifications.position).toBe('bottom-left');
  });
});

describe('requiresRestart', () => {
  it('returns true when a restart-sensitive key changes', () => {
    expect(requiresRestart([{ key: 'services.backendPort', value: '4000' }])).toBe(true);
    expect(requiresRestart([{ key: 'session.storageMode', value: 'disk' }])).toBe(true);
    expect(requiresRestart([{ key: 'performance.telemetryUpdateInterval', value: '500' }])).toBe(
      true,
    );
  });

  it('returns false for keys that apply without restart', () => {
    expect(requiresRestart([{ key: 'performance.peakDetectionSensitivity', value: 'high' }])).toBe(
      false,
    );
    expect(requiresRestart([{ key: 'notifications.enabled', value: 'false' }])).toBe(false);
    expect(requiresRestart([])).toBe(false);
  });

  it('returns true if any update in the list requires a restart', () => {
    expect(
      requiresRestart([
        { key: 'notifications.enabled', value: 'false' },
        { key: 'services.kismetPort', value: '2502' },
      ]),
    ).toBe(true);
  });
});
