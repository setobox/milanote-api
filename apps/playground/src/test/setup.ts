import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

import { SAVED_KEY, HISTORY_KEY } from "@/features/workbench/model.ts";
import { appearanceStorageKey } from "@/hooks/useAppearance.ts";

// Layout is checked in a real browser; JSDOM supplies no ResizeObserver.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

afterEach(() => {
  window.history.replaceState(null, "", window.location.pathname);
  cleanup();
  window.localStorage.removeItem(SAVED_KEY);
  window.localStorage.removeItem(HISTORY_KEY);
  window.localStorage.removeItem(appearanceStorageKey);
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
});
