import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  use: { viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm exec astro preview --host 127.0.0.1 --port 4392',
    url: 'http://127.0.0.1:4392/generator/',
    reuseExistingServer: !process.env['CI'],
  },
});
