import {
  fieldViewExclusions,
  MAX_FIELD_SELECTORS,
  MAX_FIELD_SELECTOR_LENGTH,
  parseFieldSelectors,
} from "@milanote-api/api/selectors";

export type FieldMode = "full" | "standard" | "compact" | "custom";
export const fieldModes = [
  { id: "full", name: "完整", description: "返回完整字段，敏感信息始终过滤。" },
  { id: "standard", name: "标准", description: "保留画板基本信息和子内容，排除根画板的附加属性。" },
  { id: "compact", name: "精简", description: "保留来源、ID、类型和标题，减少返回内容。" },
  { id: "custom", name: "自定义", description: "按下方规则排除或保留字段，每行填写一条路径。" },
] as const;

export function fieldMode(body: Record<string, unknown>): FieldMode {
  if (body.include !== undefined) return "custom";
  if (body.view === "standard" || body.view === "compact") {
    const preset = fieldViewExclusions[body.view];
    const additional = Array.isArray(body.exclude) ? cleanFieldRules(body.exclude) : [];
    return additional.some((rule) => !preset.includes(rule)) ? "custom" : body.view;
  }
  return body.exclude !== undefined ? "custom" : "full";
}

export function chooseFieldMode(
  body: Record<string, unknown>,
  mode: FieldMode,
): Record<string, unknown> {
  if (mode === "custom" && fieldMode(body) === "custom") return body;
  const next = { ...body };
  delete next.include;
  delete next.exclude;
  next.view = mode === "custom" ? "full" : mode;
  if (mode !== "full") {
    next.exclude =
      mode === "custom"
        ? Array.isArray(body.exclude)
          ? body.exclude
          : [...fieldViewExclusions.standard]
        : [...fieldViewExclusions[mode]];
  }
  return next;
}

// Textarea lines are individual paths; commas never silently become separators here.
export function cleanFieldRules(values: readonly unknown[]): string[] {
  const result = new Set<string>();
  let length = 0;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const path = value.trim();
    if (
      !path ||
      path.includes(",") ||
      path.split(".").every((part) => part === "*" || part === "**")
    )
      continue;
    if (result.has(path)) continue;
    try {
      parseFieldSelectors(path, "exclude");
    } catch {
      continue;
    }
    const added = path.length + (result.size ? 1 : 0);
    if (result.size === MAX_FIELD_SELECTORS || length + added > MAX_FIELD_SELECTOR_LENGTH) continue;
    result.add(path);
    length += added;
  }
  return [...result];
}

export function rulesFor(body: Record<string, unknown>, key: "include" | "exclude"): unknown[] {
  const rules: unknown[] = Array.isArray(body[key]) ? body[key] : [];
  if (key === "exclude" && !body.include && (body.view === "standard" || body.view === "compact")) {
    return [...new Set([...fieldViewExclusions[body.view], ...rules])];
  }
  return rules;
}

export function normalizeFieldRules(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  for (const key of ["include", "exclude"] as const) {
    // Preserve invalid non-array types for contract validation rather than guessing user intent.
    if (body[key] !== undefined && !Array.isArray(body[key])) continue;
    const rules = cleanFieldRules(rulesFor(body, key));
    if (rules.length) next[key] = rules;
    else delete next[key];
  }
  return next;
}
