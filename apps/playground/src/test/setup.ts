import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

import { customPresetStorageKey } from "@/features/api/request.ts";
import { appearanceStorageKey } from "@/hooks/useAppearance.ts";

// JSDOM does not implement these pointer-capture methods. Radix Select checks
// them during its real pointer interaction, so provide the browser-equivalent
// no-op behavior for UI tests.
if (!HTMLElement.prototype.hasPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    value: () => false,
  });
}

if (!HTMLElement.prototype.releasePointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    value: () => undefined,
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: () => undefined,
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(customPresetStorageKey);
  window.localStorage.removeItem(appearanceStorageKey);
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
});
