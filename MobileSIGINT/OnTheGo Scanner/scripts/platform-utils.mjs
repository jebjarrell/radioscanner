/**
 * Platform detection utilities for cross-platform build scripts
 */

/**
 * Check if running on Windows
 * @returns {boolean} True if platform is Windows
 */
export function isWindows() {
  return process.platform === 'win32';
}

/**
 * Check if running on Linux
 * @returns {boolean} True if platform is Linux
 */
export function isLinux() {
  return process.platform === 'linux';
}

/**
 * Check if running on macOS
 * @returns {boolean} True if platform is macOS
 */
export function isMac() {
  return process.platform === 'darwin';
}

/**
 * Get platform name as string
 * @returns {string} Platform name
 */
export function getPlatformName() {
  if (isWindows()) return 'Windows';
  if (isLinux()) return 'Linux';
  if (isMac()) return 'macOS';
  return 'Unknown';
}

/**
 * Get recommended file extension for platform
 * @returns {string} File extension (with dot)
 */
export function getPlatformExtension() {
  if (isWindows()) return '.exe';
  if (isLinux()) return '.AppImage';
  if (isMac()) return '.dmg';
  return '';
}
