// Use the Vitest-specific entrypoint — this imports and extends `expect` from
// Vitest directly instead of relying on a global `expect` variable.
import '@testing-library/jest-dom/vitest';

// RTL auto-cleanup requires a globally available `afterEach`. Since we use
// globals:false in vitest.config.ts, we register cleanup manually.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
