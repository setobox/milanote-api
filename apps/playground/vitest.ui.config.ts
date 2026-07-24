import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    name: "ui",
    restoreMocks: true,
    setupFiles: ["src/test/setup.ts"],
  },
});
