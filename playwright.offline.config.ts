import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3110";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/ladder-offline.spec.ts",
  workers: 1,
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      HEALTH_AI_PROVIDER: "mock",
      HEALTH_AI_API_KEY: "",
      SCREENING_LIVE_EXTRACT: "0"
    }
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    serviceWorkers: "allow",
    trace: "on-first-retry"
  }
});
