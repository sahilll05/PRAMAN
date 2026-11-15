import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    // environment defaults to "node"; switch to "happy-dom" or "jsdom" in T6 when DOM APIs needed
  },
});
