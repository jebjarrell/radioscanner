/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

// The root tsconfig pins an explicit `types` array (vite/client, node), so the
// global augmentations from vitest and @testing-library/jest-dom are not picked
// up automatically. This file lives under `src/` (which tsconfig includes) and
// pulls those ambient types in so test files type-check.
//
// @testing-library/jest-dom/vitest is loaded at runtime via vitest.setup.ts;
// here we only need the matcher type declarations.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, any> {}
}
