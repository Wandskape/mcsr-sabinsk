import { defineConfig, devices } from "@playwright/test"

const frontendUrl = process.env.E2E_BASE_URL ?? "http://localhost:4321"
const backendUrl =
  process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3000/api/v1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: /(admin-flow|performance)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "./apps/backend",
      url: `${backendUrl}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "node node_modules/astro/bin/astro.mjs preview --host localhost",
      cwd: "./apps/frontend",
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
