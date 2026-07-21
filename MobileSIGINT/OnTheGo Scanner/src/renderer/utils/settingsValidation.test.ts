import { describe, expect, it } from 'vitest';

import { validateSettingUpdates } from './settingsValidation';

describe('validateSettingUpdates', () => {
  it('accepts a valid mixed batch', () => {
    expect(
      validateSettingUpdates({
        'services.dump1090Host': '192.168.1.52',
        'services.dump1090Port': '8080',
        'preferences.distanceUnit': 'nautical',
        'preferences.mapDefaultZoom': '9.5',
        'notifications.duration': '4000',
        'performance.waterfallMaxRows': '150',
        'session.storageMode': 'disk',
      }),
    ).toEqual([]);
  });

  it('rejects empty and malformed hosts', () => {
    expect(validateSettingUpdates({ 'services.kismetHost': '' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'services.kismetHost': 'bad host!' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'services.kismetHost': 'kismet.local' })).toEqual([]);
  });

  it('rejects out-of-range and non-numeric ports', () => {
    expect(validateSettingUpdates({ 'services.gpsdPort': '0' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'services.gpsdPort': '65536' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'services.gpsdPort': 'abc' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'services.gpsdPort': '2947' })).toEqual([]);
  });

  it('validates map coordinates and zoom ranges', () => {
    expect(validateSettingUpdates({ 'preferences.mapDefaultCenterLat': '91' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'preferences.mapDefaultCenterLon': '-181' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'preferences.mapDefaultZoom': '25' })).toHaveLength(1);
    expect(
      validateSettingUpdates({
        'preferences.mapDefaultCenterLat': '40.73',
        'preferences.mapDefaultCenterLon': '-73.93',
        'preferences.mapDefaultZoom': '10',
      }),
    ).toEqual([]);
  });

  it('validates enum-valued settings', () => {
    expect(validateSettingUpdates({ 'preferences.distanceUnit': 'furlongs' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'notifications.position': 'center' })).toHaveLength(1);
    expect(
      validateSettingUpdates({ 'performance.peakDetectionSensitivity': 'extreme' }),
    ).toHaveLength(1);
    expect(validateSettingUpdates({ 'session.storageMode': 'cloud' })).toHaveLength(1);
  });

  it('validates numeric ranges for notifications and performance', () => {
    expect(
      validateSettingUpdates({ 'notifications.aircraftProximityThresholdMiles': '0' }),
    ).toHaveLength(1);
    expect(validateSettingUpdates({ 'notifications.duration': '500' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'performance.waterfallMaxRows': '39' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'performance.maxAircraftDisplayed': '201' })).toHaveLength(1);
    expect(validateSettingUpdates({ 'performance.telemetryUpdateInterval': '100' })).toHaveLength(
      1,
    );
  });

  it('collects one error per invalid key', () => {
    const errors = validateSettingUpdates({
      'services.gpsdPort': '-1',
      'preferences.mapDefaultZoom': '0',
    });
    expect(errors).toHaveLength(2);
  });

  it('ignores unknown keys (forward compatibility)', () => {
    expect(validateSettingUpdates({ 'future.someSetting': 'anything' })).toEqual([]);
  });
});
