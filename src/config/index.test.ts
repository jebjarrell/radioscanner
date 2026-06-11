import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config/index', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('uses default endpoints when no env vars are set', async () => {
    delete process.env.BACKEND_HOST;
    delete process.env.BACKEND_PORT;
    delete process.env.DUMP1090_PORT;
    delete process.env.KISMET_PORT;

    const { config, BACKEND_CONFIG, KISMET_CONFIG } = await import('./index.js');

    expect(BACKEND_CONFIG.host).toBe('127.0.0.1');
    expect(BACKEND_CONFIG.port).toBe(3000);
    expect(BACKEND_CONFIG.baseUrl).toBe('http://127.0.0.1:3000');
    expect(BACKEND_CONFIG.wsUrl).toBe('ws://127.0.0.1:3000/ws');
    expect(config.dump1090.port).toBe(8080);
    expect(KISMET_CONFIG.port).toBe(2501);
    expect(config.rtlTcp.port).toBe(1234);
    expect(config.gpsd.port).toBe(2947);
  });

  it('reads host and port overrides from the environment', async () => {
    process.env.BACKEND_HOST = '0.0.0.0';
    process.env.BACKEND_PORT = '4321';
    process.env.KISMET_HOST = 'kismet.local';
    process.env.KISMET_PORT = '2502';

    const { BACKEND_CONFIG, KISMET_CONFIG } = await import('./index.js');

    expect(BACKEND_CONFIG.host).toBe('0.0.0.0');
    expect(BACKEND_CONFIG.port).toBe(4321);
    expect(BACKEND_CONFIG.baseUrl).toBe('http://0.0.0.0:4321');
    expect(KISMET_CONFIG.host).toBe('kismet.local');
    expect(KISMET_CONFIG.port).toBe(2502);
  });

  it('falls back to the default port for a non-numeric env value', async () => {
    process.env.BACKEND_PORT = 'not-a-port';
    const { BACKEND_CONFIG } = await import('./index.js');
    expect(BACKEND_CONFIG.port).toBe(3000);
  });

  it('falls back to the default host for a blank env value', async () => {
    process.env.BACKEND_HOST = '   ';
    const { BACKEND_CONFIG } = await import('./index.js');
    expect(BACKEND_CONFIG.host).toBe('127.0.0.1');
  });
});
