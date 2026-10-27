import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts", "test/browser/**/*.test.ts"],
    testTimeout: 20000,
  },
});
