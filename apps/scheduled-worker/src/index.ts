import { z } from "zod";
import { parseRequestSchema } from "@milanote-api/api/contracts";
import { apiLoader, collect, runFailed, validateSchedule } from "@milanote-api/collector";

export interface Env {
  API_BASE_URL: string;
  BOARD_URL: string;
  BOARD_SCOPE?: string;
  API_TOKEN?: string;
  STORAGE_ENABLED?: string;
  WEBHOOK_URL?: string;
  WEBHOOK_TOKEN?: string;
  RUN_TOKEN?: string;
  SNAPSHOTS?: {
    put(
      key: string,
      value: string,
      options: { httpMetadata: { contentType: string; cacheControl: string } },
    ): Promise<unknown>;
  };
}
export async function runWorker(env: Env, fetchImpl: typeof fetch = fetch) {
  const storage = z.enum(["true", "false"]).parse(env.STORAGE_ENABLED ?? "false") === "true";
  if (storage && !env.SNAPSHOTS) throw new Error("开启存储需要配置自己的 R2 SNAPSHOTS 绑定");
  return collect({
    jobId: "default",
    request: parseRequestSchema.parse({ url: env.BOARD_URL, scope: env.BOARD_SCOPE ?? "root" }),
    load: apiLoader(env.API_BASE_URL, env.API_TOKEN, fetchImpl),
    fetchImpl,
    ...(env.WEBHOOK_URL ? { webhook: { url: env.WEBHOOK_URL, token: env.WEBHOOK_TOKEN } } : {}),
    ...(storage
      ? {
          store: async (snapshot) => {
            await env.SNAPSHOTS!.put("default/latest.json", JSON.stringify(snapshot), {
              httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
            });
          },
        }
      : {}),
  });
}
async function authorized(request: Request, token: string | undefined) {
  if (!token) return false;
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, actual] = await Promise.all([
    digest(`Bearer ${token}`),
    digest(request.headers.get("Authorization") ?? ""),
  ]);
  const a = new Uint8Array(expected);
  const b = new Uint8Array(actual);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}
export default {
  async scheduled(event: { cron: string }, env: Env) {
    validateSchedule(event.cron);
    try {
      const summary = await runWorker(env);
      console.log(JSON.stringify(summary));
      if (runFailed(summary)) throw new Error("采集或输出未完成");
    } catch {
      throw new Error("定时采集失败；检查配置、API 与输出状态");
    }
  },
  async fetch(request: Request, env: Env) {
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (new URL(request.url).pathname !== "/collect")
      return new Response('{"error":"NOT_FOUND"}', { status: 404, headers });
    if (request.method !== "POST")
      return new Response('{"error":"METHOD_NOT_ALLOWED"}', {
        status: 405,
        headers: { ...headers, Allow: "POST" },
      });
    if (!(await authorized(request, env.RUN_TOKEN)))
      return new Response('{"error":"UNAUTHORIZED"}', { status: 401, headers });
    try {
      const summary = await runWorker(env);
      return new Response(JSON.stringify(summary), {
        status: runFailed(summary) ? 502 : 200,
        headers,
      });
    } catch {
      return new Response('{"error":"INVALID_COLLECTOR_CONFIG"}', { status: 400, headers });
    }
  },
};
