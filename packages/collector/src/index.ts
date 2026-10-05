import {
  PARSE_PATH,
  parseRequestSchema,
  successSchema,
  type ParseRequest,
  type ParseSuccess,
} from "@milanote-api/api/contracts";
import { z } from "zod";

export type OutputResult = "disabled" | "success" | "failed" | "skipped";
export interface RunSummary {
  runId: string;
  jobId: string;
  startedAt: string;
  elapsedMs: number;
  status: "success" | "incomplete" | "failed";
  storage: OutputResult;
  webhook: OutputResult;
  webhookAttempts: number;
}
export interface Snapshot {
  runId: string;
  jobId: string;
  capturedAt: string;
  result: ParseSuccess;
}
export interface RunOptions {
  jobId: string;
  request: ParseRequest;
  load: (request: ParseRequest) => Promise<unknown>;
  webhook?: { url: string; token?: string };
  store?: (snapshot: Snapshot) => Promise<void> | void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}
const httpUrl = z.url().refine((text) => {
  const url = new URL(text);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash;
}, "需要不含凭据的 HTTP(S) 地址");
export const jobIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

export function apiLoader(apiBase: string, token?: string, fetchImpl: typeof fetch = fetch) {
  const base = new URL(httpUrl.parse(apiBase));
  if (base.search) throw new Error("API 地址不能包含查询参数");
  const endpoint = base.toString().replace(/\/$/, "") + PARSE_PATH;
  return async (request: ParseRequest): Promise<ParseSuccess> => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(parseRequestSchema.parse(request)),
    });
    if (!response.ok) throw new Error(`API_HTTP_${response.status}`);
    return successSchema.parse(await response.json());
  };
}

export async function collect(options: RunOptions): Promise<RunSummary> {
  jobIdSchema.parse(options.jobId);
  const request = parseRequestSchema.parse(options.request);
  if (options.webhook) httpUrl.parse(options.webhook.url);
  if (!options.store && !options.webhook) throw new Error("必须配置至少一个输出：存储或 Webhook");
  const start = Date.now();
  const summary: RunSummary = {
    runId: crypto.randomUUID(),
    jobId: options.jobId,
    startedAt: new Date(start).toISOString(),
    elapsedMs: 0,
    status: "failed",
    storage: options.store ? "skipped" : "disabled",
    webhook: options.webhook ? "skipped" : "disabled",
    webhookAttempts: 0,
  };
  let result: ParseSuccess;
  try {
    result = successSchema.parse(await options.load(request));
  } catch {
    summary.elapsedMs = Date.now() - start;
    return summary;
  }
  summary.status = result.meta.complete ? "success" : "incomplete";
  const snapshot: Snapshot = {
    runId: summary.runId,
    jobId: options.jobId,
    capturedAt: summary.startedAt,
    result,
  };
  if (options.store && result.meta.complete) {
    try {
      await options.store(snapshot);
      summary.storage = "success";
    } catch {
      summary.storage = "failed";
    }
  }
  if (options.webhook) {
    const fetchImpl = options.fetchImpl ?? fetch;
    summary.webhook = "failed";
    for (let attempt = 0; attempt < 3; attempt++) {
      summary.webhookAttempts++;
      try {
        const response = await fetchImpl(options.webhook.url, {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "Content-Type": "application/json",
            "X-Run-Id": summary.runId,
            ...(options.webhook.token ? { Authorization: `Bearer ${options.webhook.token}` } : {}),
          },
          body: JSON.stringify(snapshot),
        });
        const accepted = response.ok;
        await response.body?.cancel();
        if (accepted) {
          summary.webhook = "success";
          break;
        }
      } catch {
        /* Retry with the same run ID; never put destination or credentials into logs. */
      }
      if (attempt < 2)
        await (options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(
          250 * 2 ** attempt,
        );
    }
  }
  summary.elapsedMs = Date.now() - start;
  return summary;
}

export function runFailed(summary: RunSummary): boolean {
  return (
    summary.status !== "success" || summary.storage === "failed" || summary.webhook === "failed"
  );
}

export function secret(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

// POSIX five-field cron. Weekdays deliberately use English names in templates.
export function validateSchedule(cron: string, minimumMinutes = 1): string {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("cron 必须包含五个字段，使用 UTC");
  const limits = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  const names: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const values = fields.map((field, index) => {
    const normalized = field
      .toUpperCase()
      .replace(/[A-Z]{3}/g, (name) => (index === 4 && name in names ? String(names[name]) : name));
    const set = new Set<number>();
    const [low, high] = limits[index]!;
    for (const part of normalized.split(",")) {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
      if (!match) throw new Error("无效的 cron 字段");
      const range = match[1]!;
      const step = Number(match[2] ?? 1);
      const [start, end] =
        range === "*"
          ? [low, high]
          : range.includes("-")
            ? range.split("-").map(Number)
            : [Number(range), match[2] ? high : Number(range)];
      if (!step || step > high + 1 || start! < low || end! > high || start! > end!)
        throw new Error("cron 字段超出范围");
      for (let n = start!; n <= end!; n += step) set.add(n);
    }
    return [...set].sort((a, b) => a - b);
  });
  const times = values[1]!.flatMap((hour) => values[0]!.map((minute) => hour * 60 + minute));
  const gaps = times.map((time, index) =>
    index ? time - times[index - 1]! : time + 1440 - times[times.length - 1]!,
  );
  if (Math.min(...gaps) < minimumMinutes)
    throw new Error(`调度间隔不得低于 ${minimumMinutes} 分钟`);
  return cron;
}
