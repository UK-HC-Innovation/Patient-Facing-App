import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx,js,jsx}", "src/**/*.spec.{ts,tsx,js,jsx}"],
    exclude: ["**/node_modules/**", "e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    css: true
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src")
    }
  }
});
