import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    include: ["worker/**/*.test.ts"],
    name: "worker",
    restoreMocks: true,
  },
});
