import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  reporter: 'list', outputDir: 'test-results',
  use: { baseURL: 'http://127.0.0.1:5173', actionTimeout: 10000, viewport: { width: 1440, height: 980 }, launchOptions: { executablePath: chrome }, screenshot: 'off', trace: 'off' },
  webServer: [
    { command: process.platform === 'win32' ? 'cmd.exe /d /c .\\start-dashboard.cmd --no-open' : 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 60000 },
    { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 60000 },
  ],
});
