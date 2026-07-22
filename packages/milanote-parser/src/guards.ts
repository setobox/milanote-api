import type { JsonValue } from "./types.ts";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRecord(value: UnknownRecord, key: string): UnknownRecord | undefined {
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

export function readString(value: UnknownRecord, key: string): string | undefined {
  const child = value[key];
  return typeof child === "string" ? child : undefined;
}

export function readNonEmptyString(value: UnknownRecord, key: string): string | undefined {
  const child = readString(value, key);
  return child !== undefined && child.trim() !== "" ? child : undefined;
}

export function readNumber(value: UnknownRecord, key: string): number | undefined {
  const child = value[key];
  return typeof child === "number" && Number.isFinite(child) ? child : undefined;
}

export function readBoolean(value: UnknownRecord, key: string): boolean | undefined {
  const child = value[key];
  return typeof child === "boolean" ? child : undefined;
}

export function readStringArray(value: UnknownRecord, key: string): string[] {
  const child = value[key];
  return Array.isArray(child)
    ? child.filter((item): item is string => typeof item === "string")
    : [];
}

export function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (isRecord(value)) {
    const output: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined && typeof child !== "function" && typeof child !== "symbol") {
        output[key] = toJsonValue(child);
      }
    }
    return output;
  }

  return null;
}
