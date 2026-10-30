import { defineConfig } from "vitest/config";
import path from "path";
const root = path.resolve(import.meta.dirname);
export default defineConfig({
  root,
  resolve: { alias: { "@": path.resolve(root, "client", "src"), "@shared": path.resolve(root, "shared") } },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    env: { NODE_ENV: "test", SESSION_SECRET: "test-only-secret-0123456789abcdef0123456789" },
  },
});
