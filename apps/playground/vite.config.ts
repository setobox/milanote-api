import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(({ mode }) => ({
  plugins: [vue(), UnoCSS(), ...(mode === "test" ? [] : [cloudflare()])],
  test: {
    clearMocks: true,
    environment: "node",
    include: ["worker/**/*.test.ts"],
    restoreMocks: true,
  },
}));
