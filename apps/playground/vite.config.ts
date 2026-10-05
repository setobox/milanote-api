import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { documentRoutes } from "./plugins/document-routes.ts";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH ?? "/",
  publicDir: path.resolve(root, "../docs/.vitepress/dist"),
  plugins: [documentRoutes(process.env.PUBLIC_BASE_PATH ?? "/"), react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(root, "src") } },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: {
    assetsDir: "playground/assets",
    rollupOptions: { input: path.resolve(root, "playground/index.html") },
  },
  test: { projects: ["vitest.ui.config.ts", "vitest.server.config.ts"] },
  run: {
    tasks: {
      "site:build": {
        command: ["vp run typecheck", "vp build"],
        dependsOn: ["@milanote-api/docs#build"],
        cache: { env: ["PUBLIC_BASE_PATH", "VITE_API_BASE_URL"] },
      },
    },
  },
});
