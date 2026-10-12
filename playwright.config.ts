import { defineConfig, devices } from '@playwright/test'

// Not 5173: that is where the app itself runs ("PokeBinder starten.cmd", npm run dev).
// The tests must never pick up a running app with an older build, nor touch its data.
const port = 5174

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // a worker left over from the built app would answer image requests past the test doubles
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      // high enough for the open binder at its usual zoom; on lower screens the app zooms
      // out by itself, which tests/e2e/tablet.spec.ts covers
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
})
