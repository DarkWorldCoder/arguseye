import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 120000,
    globalSetup: ["test/globalSetup.ts"],
    projects: [
      { test: { name: "unit", include: ["test/unit/**/*.test.ts"] } },
      // Browser tests carry timing budgets, so they run one file at a time on a quiet machine.
      { test: { name: "browser", include: ["test/browser/**/*.test.ts"], fileParallelism: false, testTimeout: 20000, hookTimeout: 120000 } },
    ],
  },
});
