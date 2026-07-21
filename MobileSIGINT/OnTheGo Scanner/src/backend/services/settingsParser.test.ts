// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { parseSettings, requiresRestart } from './settingsParser';

describe('parseSettings', () => {
  it('fills defaults for an empty map', () => {
    const settings = parseSettings({});
    expect(settings.services.backendPort).toBe(3000);
    expect(settings.session.storageMode).toBe('memory');
    expect(settings.preferences.distanceUnit).toBe('miles');
    expect(settings.notifications.enabled).toBe(true);
    expect(settings.performance.peakDetectionSensitivity).toBe('medium');
  });

  it('parses numeric values and falls back on invalid numbers', () => {
    expect(parseSettings({ 'services.backendPort': '4000' }).services.backendPort).toBe(4000);
    expect(parseSettings({ 'services.backendPort': 'not-a-number' }).services.backendPort).toBe(
      3000,
    );
  });

  it('parses booleans from true/false and 1/0, falling back on anything else', () => {
    expect(parseSettings({ 'notifications.enabled': 'false' }).notifications.enabled).toBe(false);
    expect(
      parseSettings({ 'notifications.aircraftProximity': '1' }).notifications.aircraftProximity,
    ).toBe(true);
    expect(parseSettings({ 'notifications.enabled': 'maybe' }).notifications.enabled).toBe(true);
  });

  it('maps storageMode to disk only for the exact value', () => {
    expect(parseSettings({ 'session.storageMode': 'disk' }).session.storageMode).toBe('disk');
    expect(parseSettings({ 'session.storageMode': 'weird' }).session.storageMode).toBe('memory');
  });

  it('passes string preferences through', () => {
    expect(
      parseSettings({ 'preferences.distanceUnit': 'kilometers' }).preferences.distanceUnit,
    ).toBe('kilometers');
    expect(parseSettings({ 'preferences.mapStyle': 'satellite' }).preferences.mapStyle).toBe(
      'satellite',
    );
  });
});

describe('requiresRestart', () => {
  it('is true when a service or session key changes', () => {
    expect(requiresRestart([{ key: 'services.backendPort', value: '4000' }])).toBe(true);
    expect(requiresRestart([{ key: 'session.storageMode', value: 'disk' }])).toBe(true);
  });

  it('is false for preference-only or dynamically-applied changes', () => {
    expect(requiresRestart([{ key: 'preferences.mapStyle', value: 'dark' }])).toBe(false);
    expect(requiresRestart([{ key: 'performance.peakDetectionSensitivity', value: 'high' }])).toBe(
      false,
    );
  });

  it('is false for an empty update list', () => {
    expect(requiresRestart([])).toBe(false);
  });
});
