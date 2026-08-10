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
    // DB-touching integration test files each open their own PrismaClient;
    // running them as parallel workers multiplies connection_limit across
    // processes and can exceed Supabase's pooler cap. Run files sequentially
    // instead of shrinking connection_limit for every consumer (including
    // the dev server) to compensate.
    fileParallelism: false,
  },
});
