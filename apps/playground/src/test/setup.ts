import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

import { customPresetStorageKey } from "@/features/api/request.ts";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(customPresetStorageKey);
});
