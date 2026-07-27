import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Integration tests hit the real (remote, pooled) Supabase DB with
    // several sequential round trips per test; the 5s default is too tight
    // under normal network latency.
    testTimeout: 15000,
  },
});
