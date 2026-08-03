import { useEffect, useState } from "react";

export const appearanceStorageKey = "vitepress-theme-appearance";

export type Appearance = "auto" | "dark" | "light";
export type ResolvedAppearance = Exclude<Appearance, "auto">;

const darkThemeColor = "#141413";
const lightThemeColor = "#f0efe8";

function isAppearance(value: string | null): value is Appearance {
  return value === "auto" || value === "dark" || value === "light";
}

function getSystemAppearance(): ResolvedAppearance {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialAppearance(): Appearance {
  try {
    const stored = window.localStorage.getItem(appearanceStorageKey);
    return isAppearance(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

function resolveAppearance(preference: Appearance, systemAppearance: ResolvedAppearance) {
  return preference === "auto" ? systemAppearance : preference;
}

function applyAppearance(appearance: ResolvedAppearance): void {
  const root = document.documentElement;
  root.classList.toggle("dark", appearance === "dark");
  root.dataset.theme = appearance;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", appearance === "dark" ? darkThemeColor : lightThemeColor);
}

export function useAppearance() {
  const [preference, setPreference] = useState<Appearance>(getInitialAppearance);
  const [systemAppearance, setSystemAppearance] = useState<ResolvedAppearance>(getSystemAppearance);
  const appearance = resolveAppearance(preference, systemAppearance);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemAppearance(mediaQuery.matches ? "dark" : "light");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  function toggleAppearance(): void {
    const nextPreference = appearance === "dark" ? "light" : "dark";
    setPreference(nextPreference);
    try {
      window.localStorage.setItem(appearanceStorageKey, nextPreference);
    } catch {
      // A privacy-restricted browser should still permit an in-memory toggle.
    }
  }

  return { appearance, preference, toggleAppearance };
}
