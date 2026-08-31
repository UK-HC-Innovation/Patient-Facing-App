import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  workers: 2,
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    // Browser regression tests must never inherit a developer's live provider
    // credentials from .env.local. Route-level live behavior is intercepted in
    // the few tests that exercise it explicitly.
    env: {
      HEALTH_AI_PROVIDER: "mock",
      HEALTH_AI_API_KEY: "",
      NEXT_PUBLIC_FOOD_PACKAGE_SCAN: "0",
      FOOD_PACKAGE_SCAN_ENABLED: "0",
      FOOD_PACKAGE_SESSION_SECRET: "",
      SCREENING_LIVE_EXTRACT: "0"
    }
  },
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        }
      }
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        }
      }
    },
    {
      name: "firefox-smoke",
      testMatch: "**/ladder-browser-contract.spec.ts",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit-smoke",
      testMatch: "**/ladder-browser-contract.spec.ts",
      use: { ...devices["Desktop Safari"] }
    },
    {
      name: "mobile-webkit-smoke",
      testMatch: "**/ladder-browser-contract.spec.ts",
      use: { ...devices["iPhone 13"] }
    }
  ]
});
