import { defineConfig, devices } from "@playwright/test";

process.env.PACKAGE_E2E_FLAG_ON = "1";

const port = "3101";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/food-package.spec.ts",
  workers: 1,
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      HEALTH_AI_PROVIDER: "openai",
      HEALTH_AI_API_KEY: "package-e2e-placeholder",
      HEALTH_AI_PACKAGE_MODEL: "gpt-5.6-luna",
      NEXT_PUBLIC_FOOD_PACKAGE_SCAN: "1",
      FOOD_PACKAGE_SCAN_ENABLED: "1",
      FOOD_PACKAGE_SESSION_SECRET: "package-e2e-session-secret-32-bytes-minimum",
      DEMO_PASSCODE: "package-e2e"
    }
  },
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }
      }
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
        permissions: ["camera", "microphone"],
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }
      }
    }
  ]
});
