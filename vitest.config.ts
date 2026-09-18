import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The opt-in integration suite runs against a real (remote) database, so
    // allow generous timeouts. Unit tests are unaffected.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
