import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "test" ? [] : [cloudflare()])],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  build: {
    assetsDir: "playground/assets",
    rollupOptions: {
      input: path.resolve(projectRoot, "playground/index.html"),
    },
  },
  test: {
    projects: ["vitest.worker.config.ts", "vitest.ui.config.ts"],
  },
}));
