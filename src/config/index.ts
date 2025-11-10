/**
 * Central configuration module for OnTheGo Scanner
 * Provides environment-based configuration for all service endpoints
 */

interface ServiceConfig {
  backend: {
    host: string;
    port: number;
    baseUrl: string;
    wsUrl: string;
  };
  dump1090: {
    host: string;
    port: number;
    baseUrl: string;
  };
  kismet: {
    host: string;
    port: number;
    baseUrl: string;
  };
  rtlTcp: {
    host: string;
    port: number;
  };
  gpsd: {
    host: string;
    port: number;
  };
}

/**
 * Parse environment variable as number with fallback
 */
function parsePort(envVar: string | undefined, defaultPort: number): number {
  if (!envVar) {
    return defaultPort;
  }
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultPort : parsed;
}

/**
 * Parse environment variable as string with fallback
 */
function parseHost(envVar: string | undefined, defaultHost: string): string {
  return envVar?.trim() || defaultHost;
}

// Parse environment variables
const BACKEND_HOST = parseHost(process.env.BACKEND_HOST, '127.0.0.1');
const BACKEND_PORT = parsePort(process.env.BACKEND_PORT, 3000);
const DUMP1090_HOST = parseHost(process.env.DUMP1090_HOST, '127.0.0.1');
const DUMP1090_PORT = parsePort(process.env.DUMP1090_PORT, 8080);
const KISMET_HOST = parseHost(process.env.KISMET_HOST, '127.0.0.1');
const KISMET_PORT = parsePort(process.env.KISMET_PORT, 2501);
const RTL_TCP_HOST = parseHost(process.env.RTL_TCP_HOST, '127.0.0.1');
const RTL_TCP_PORT = parsePort(process.env.RTL_TCP_PORT, 1234);
const GPSD_HOST = parseHost(process.env.GPSD_HOST, '127.0.0.1');
const GPSD_PORT = parsePort(process.env.GPSD_PORT, 2947);

/**
 * Service configuration object
 * All service endpoints are centralized here
 */
export const config: ServiceConfig = {
  backend: {
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    baseUrl: `http://${BACKEND_HOST}:${BACKEND_PORT}`,
    wsUrl: `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`,
  },
  dump1090: {
    host: DUMP1090_HOST,
    port: DUMP1090_PORT,
    baseUrl: `http://${DUMP1090_HOST}:${DUMP1090_PORT}`,
  },
  kismet: {
    host: KISMET_HOST,
    port: KISMET_PORT,
    baseUrl: `http://${KISMET_HOST}:${KISMET_PORT}`,
  },
  rtlTcp: {
    host: RTL_TCP_HOST,
    port: RTL_TCP_PORT,
  },
  gpsd: {
    host: GPSD_HOST,
    port: GPSD_PORT,
  },
};

/**
 * Export individual service configs for convenience
 */
export const BACKEND_CONFIG = config.backend;
export const DUMP1090_CONFIG = config.dump1090;
export const KISMET_CONFIG = config.kismet;
export const RTL_TCP_CONFIG = config.rtlTcp;
export const GPSD_CONFIG = config.gpsd;

/**
 * Validate configuration on load (useful for debugging)
 */
if (process.env.NODE_ENV !== 'production') {
  console.log('[Config] Service endpoints:', {
    backend: config.backend.baseUrl,
    websocket: config.backend.wsUrl,
    dump1090: config.dump1090.baseUrl,
    kismet: config.kismet.baseUrl,
    rtlTcp: `${config.rtlTcp.host}:${config.rtlTcp.port}`,
    gpsd: `${config.gpsd.host}:${config.gpsd.port}`,
  });
}
