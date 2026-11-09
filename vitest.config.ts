import { defineConfig } from "vitest/config";

// the engine's tests; the tool under web/ keeps its own
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
