/**
 * Vitest global setup for component tests.
 *
 * - Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, ...).
 * - Unmounts React trees after every test so the jsdom document stays clean.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
