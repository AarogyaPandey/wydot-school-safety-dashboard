import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Deliberately no webServer: these tests must work by opening file:// directly.
export default defineConfig({
  ...base, testDir: './tests/standalone', webServer: undefined,
  outputDir: 'test-results/standalone', timeout: 90000,
  use: { ...base.use, baseURL: undefined },
});
