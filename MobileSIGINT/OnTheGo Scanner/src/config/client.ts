/**
 * Client-side configuration for browser/renderer process
 * Uses Vite environment variables (import.meta.env) for configuration
 */

interface ClientConfig {
  backend: {
    host: string;
    port: number;
    baseUrl: string;
    wsUrl: string;
  };
}

// Parse environment variables from Vite (import.meta.env)
// These can be set via .env files or build-time configuration
const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = parseInt(import.meta.env.VITE_BACKEND_PORT || '3000', 10);

/**
 * Client-side service configuration
 * Matches server-side config but uses browser-compatible env vars
 */
export const clientConfig: ClientConfig = {
  backend: {
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    baseUrl: `http://${BACKEND_HOST}:${BACKEND_PORT}`,
    wsUrl: `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`,
  },
};

// Export for convenience
export const BACKEND_URL = clientConfig.backend.baseUrl;
export const WEBSOCKET_URL = clientConfig.backend.wsUrl;

if (import.meta.env.DEV) {
  console.log('[Client Config] Using backend:', BACKEND_URL);
  console.log('[Client Config] WebSocket:', WEBSOCKET_URL);
}
