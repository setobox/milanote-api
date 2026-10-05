import {
  fetchMilanoteBoardWithDiagnostics,
  MilanoteParserError,
  type BoardFetchResult,
  type FetchMilanoteBoardOptions,
} from "@milanote-api/parser";
import { PARSE_PATH, openApiDocument, parseRequestSchema } from "./contracts.ts";
import {
  FieldSelectorError,
  parseFieldSelectors,
  selectDocumentFields,
} from "./field-selectors.ts";
export * from "./contracts.ts";

export type BoardLoader = (
  url: string,
  options: FetchMilanoteBoardOptions,
) => Promise<BoardFetchResult>;
export interface ApiDependencies {
  loader?: BoardLoader;
  storage?: boolean;
}
const MAX_BODY = 32_768;
function headers(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Server-Timing, X-Upstream-Requests, X-Request-Id",
    "X-Request-Id": crypto.randomUUID(),
  });
}
function json(body: unknown, status = 200, extra?: Headers): Response {
  return new Response(JSON.stringify(body), { status, headers: extra ?? headers() });
}
function error(code: string, message: string, status: number, stage = "request"): Response {
  return json({ ok: false, error: { code, message, stage } }, status);
}
async function readBody(request: Request): Promise<string | undefined> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let result = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return result + decoder.decode();
      size += chunk.value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return undefined;
      }
      result += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
export function createApp(dependencies: ApiDependencies = {}) {
  const loader = dependencies.loader ?? fetchMilanoteBoardWithDiagnostics;
  return {
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname;
      const method =
        path === PARSE_PATH
          ? "POST"
          : path === "/api/capabilities" || path === "/api/openapi.json"
            ? "GET"
            : undefined;
      if (!method) return error("NOT_FOUND", "接口不存在。", 404);
      if (request.method === "OPTIONS") {
        const responseHeaders = headers();
        responseHeaders.set("Access-Control-Allow-Methods", `${method}, OPTIONS`);
        responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      if (request.method !== method) {
        const response = error("METHOD_NOT_ALLOWED", `请使用 ${method}。`, 405);
        response.headers.set("Allow", `${method}, OPTIONS`);
        return response;
      }
      if (path === "/api/openapi.json") return json(openApiDocument);
      if (path === "/api/capabilities")
        return json({
          version: 1,
          storage: dependencies.storage ?? false,
          cache: false,
          scheduling: false,
        });
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? ""))
        return error("UNSUPPORTED_MEDIA_TYPE", "请发送 application/json。", 415);
      let input: unknown;
      try {
        const body = await readBody(request);
        if (body === undefined) return error("PAYLOAD_TOO_LARGE", "请求体不能超过 32 KiB。", 413);
        input = JSON.parse(body);
      } catch {
        return error("INVALID_REQUEST", "请求体不是有效 JSON。", 400);
      }
      const parsed = parseRequestSchema.safeParse(input);
      if (!parsed.success)
        return error(
          "INVALID_REQUEST",
          "检查分享链接、读取范围和字段组合；include 不能与 view 或 exclude 混用。",
          400,
        );
      const value = parsed.data;
      try {
        const selection = value.include
          ? { include: parseFieldSelectors(value.include.join(","), "include") }
          : {
              view: value.view ?? "full",
              ...(value.exclude
                ? { exclude: parseFieldSelectors(value.exclude.join(","), "exclude") }
                : {}),
            };
        const result = await loader(value.url, { scope: value.scope, signal: request.signal });
        const data = selectDocumentFields(result.document, selection);
        const responseHeaders = headers();
        responseHeaders.set(
          "Server-Timing",
          Object.entries(result.diagnostics.timings)
            .map(([name, ms]) => `${name};dur=${ms.toFixed(2)}`)
            .join(", "),
        );
        responseHeaders.set("X-Upstream-Requests", String(result.diagnostics.upstreamRequests));
        return json({ ok: true, data, meta: result.diagnostics }, 200, responseHeaders);
      } catch (caught) {
        if (caught instanceof FieldSelectorError)
          return error("INVALID_FIELD_SELECTOR", caught.message, 400);
        if (caught instanceof MilanoteParserError) {
          const status =
            caught.code === "UPSTREAM_TIMEOUT"
              ? 504
              : caught.code === "UPSTREAM_ACCESS_DENIED"
                ? 403
                : caught.code === "BOARD_NOT_FOUND"
                  ? 404
                  : caught.code === "INVALID_SHARE_URL"
                    ? 400
                    : 502;
          return error(caught.code, caught.message, status, caught.stage);
        }
        return error("INTERNAL_ERROR", "画板读取失败。", 500, "parse");
      }
    },
  };
}
