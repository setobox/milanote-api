import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  shortcuts: {
    "bg-base": "bg-[var(--c-bg)]",
    "bg-secondary": "bg-[var(--c-bg-secondary)]",
    "bg-elevated": "bg-[var(--c-bg-elevated)]",
    "border-base": "border-[var(--c-border)]",
    "color-base": "text-[var(--c-text)]",
    "color-soft": "text-[var(--c-text-soft)]",
    "color-active": "text-[var(--c-accent)]",
    "surface-panel": "border border-base rounded-md bg-elevated color-base",
    "focus-ring":
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]",
    "btn-action":
      "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-base bg-elevated px-3 text-sm font-600 color-base transition-colors hover:bg-[var(--c-bg-hover)] disabled:pointer-events-none disabled:opacity-45",
    "technical-value": "font-mono tabular-nums",
    "type-badge":
      "technical-value inline-flex min-h-5 items-center rounded border border-base bg-secondary px-1.5 text-[0.6875rem] font-700 tracking-wide color-soft",
  },
});
