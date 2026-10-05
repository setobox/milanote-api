import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { name: "server", environment: "node", include: ["plugins/**/*.test.ts"] },
});
