import {
  EXAMPLE_URL,
  PARSE_PATH,
  parseRequestSchema,
  requestPresets,
} from "@milanote-api/api/contracts";
import { z } from "zod";
import { normalizeFieldRules } from "./field-rules.ts";

export type Operation = "parse" | "capabilities" | "openapi";
export const paths: Record<Operation, string> = {
  parse: PARSE_PATH,
  capabilities: "/api/capabilities",
  openapi: "/api/openapi.json",
};
export const operationNames: Record<Operation, string> = {
  parse: "解析画板",
  capabilities: "服务能力",
  openapi: "OpenAPI 定义",
};
export interface HttpResult {
  status: number;
  statusText: string;
  text: string;
  headers: Record<string, string>;
  elapsed: number;
  bytes: number;
  request: { url: string; method: string; body?: string };
}
export interface RequestTab {
  id: string;
  name: string;
  operation: Operation;
  raw: string;
  result?: HttpResult;
  pending: boolean;
  error?: string;
}
export const savedSchema = z.object({
  id: z.string(),
  name: z.string().max(80),
  operation: z.enum(["parse", "capabilities", "openapi"]),
  raw: z.string().max(32768),
  apiBase: z.string().max(2048),
});
export type SavedRequest = z.infer<typeof savedSchema>;
export const historySchema = z.object({
  id: z.string(),
  operation: z.enum(["parse", "capabilities", "openapi"]),
  status: z.number(),
  elapsed: z.number(),
  at: z.string(),
});
export type HistoryEntry = z.infer<typeof historySchema>;
export const SAVED_KEY = "milanote.workbench.saved.v1";
export const HISTORY_KEY = "milanote.workbench.history.v1";
export function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
export function readFields(raw: string): Record<string, unknown> | undefined {
  const value = readJson(raw);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function newTab(
  preset?: (typeof requestPresets)[number],
  operation: Operation = "parse",
): RequestTab {
  const selected = preset ?? { name: "根画板", body: { url: "", scope: "root", view: "full" } };
  return {
    id: crypto.randomUUID(),
    name: operation === "parse" ? selected.name : operationNames[operation],
    operation,
    raw: JSON.stringify(normalizeFieldRules(selected.body), null, 2),
    pending: false,
  };
}
export function loadSaved(): SavedRequest[] {
  try {
    const result = z
      .array(savedSchema)
      .max(100)
      .safeParse(readJson(localStorage.getItem(SAVED_KEY) ?? "[]"));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
export function loadHistory(): HistoryEntry[] {
  try {
    const result = z
      .array(historySchema)
      .max(100)
      .safeParse(readJson(localStorage.getItem(HISTORY_KEY) ?? "[]"));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
export function apiUrl(base: string, operation: Operation): string {
  const url = new URL(base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("请输入不含凭据和查询参数的 HTTP(S) API 地址。");
  return new URL(`${base.replace(/\/$/, "")}${paths[operation]}`).toString();
}
export function validatedBody(raw: string): string {
  const fields = readFields(raw);
  const result = parseRequestSchema.safeParse(fields ? normalizeFieldRules(fields) : undefined);
  if (!result.success)
    throw new Error("检查 JSON、分享链接和字段组合；include 不能与 view 或 exclude 同时使用。");
  return JSON.stringify(result.data);
}
// The POST body is authoritative. Mirror only public controls, never the share URL or credentials.
export function requestParameters(raw: string): string {
  const fields = readFields(raw);
  if (!fields) return "";
  const body = normalizeFieldRules(fields);
  const params = new URLSearchParams();
  if (body.scope === "tree") params.set("scope", "tree");
  if (body.view === "standard" || body.view === "compact") params.set("view", body.view);
  for (const key of ["include", "exclude"] as const) {
    if (Array.isArray(body[key]) && body[key].length) params.set(key, body[key].join(","));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasPlaceholderUrl(raw: string): boolean {
  const body = readFields(raw);
  return Boolean(
    body && (body.url === undefined || (typeof body.url === "string" && !body.url.trim())),
  );
}
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
export function requestCode(
  language: "curl" | "javascript" | "python",
  url: string,
  operation: Operation,
  raw: string,
  authenticated = false,
): string {
  const method = operation === "parse" ? "POST" : "GET";
  const body =
    operation === "parse"
      ? validatedBody(
          hasPlaceholderUrl(raw) ? JSON.stringify({ ...readFields(raw), url: EXAMPLE_URL }) : raw,
        )
      : undefined;
  if (body) url = url.split("?")[0] + requestParameters(body);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(authenticated ? { Authorization: "Bearer YOUR_API_TOKEN" } : {}),
  };
  if (language === "curl")
    return [
      `curl --request ${method} ${shellQuote(url)}`,
      ...Object.entries(headers).map(
        ([key, value]) => `  --header ${shellQuote(`${key}: ${value}`)}`,
      ),
      ...(body ? [`  --data ${shellQuote(body)}`] : []),
    ].join(" \\\n");
  if (language === "javascript")
    return `const response = await fetch(${JSON.stringify(url)}, ${JSON.stringify({ method, headers, cache: "no-store", ...(body ? { body } : {}) }, null, 2)});\nconst result = await response.json();\nif (!response.ok) throw new Error(result.error?.message ?? 'Request failed');\nconsole.log(result);`;
  return `import json\nimport urllib.request\n\nrequest = urllib.request.Request(\n    ${JSON.stringify(url)},\n    method=${JSON.stringify(method)},\n    headers=json.loads(${JSON.stringify(JSON.stringify(headers))}),${body ? `\n    data=${JSON.stringify(body)}.encode('utf-8'),` : ""}\n)\nwith urllib.request.urlopen(request, timeout=30) as response:\n    print(json.load(response))`;
}
