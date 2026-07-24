import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite-plus";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function playgroundDevRoute(): Plugin {
  return {
    name: "milanote-playground-dev-route",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? "/", "http://vite.local");
        if (url.pathname === "/playground") {
          request.url = `/playground/index.html${url.search}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  publicDir: path.resolve(projectRoot, "../docs/.vitepress/dist"),
  plugins: [
    playgroundDevRoute(),
    react(),
    tailwindcss(),
    ...(mode === "test" ? [] : [cloudflare()]),
  ],
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
  run: {
    tasks: {
      "site:build": {
        command: ["vp run typecheck", "vp build"],
        dependsOn: ["@milanote-api/docs#build"],
      },
    },
  },
}));
