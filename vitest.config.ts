import { defineConfig } from "vitest/config";

// the engine's tests; the app under app/ keeps its own
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
