import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_AZURE_PORT ?? "43822";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "foodlens-azure.spec.ts",
  workers: 1,
  webServer: {
    command: "node server.js",
    cwd: ".next/standalone",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_SURFACE: "foodlens",
      HEALTH_AI_PROVIDER: "mock",
      HEALTH_AI_API_KEY: "",
      NEXT_PUBLIC_FOOD_PACKAGE_SCAN: "0",
      FOOD_PACKAGE_SCAN_ENABLED: "0",
      FOOD_PACKAGE_SESSION_SECRET: "",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: port
    }
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium" }]
});
