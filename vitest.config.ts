import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // `server-only` is a build-time marker that throws at runtime when
      // imported outside a React Server context. In unit tests we want the
      // empty stub so server modules can be imported and exercised directly.
      "server-only": path.resolve(process.cwd(), "node_modules/server-only/empty.js"),
    },
  },
});
