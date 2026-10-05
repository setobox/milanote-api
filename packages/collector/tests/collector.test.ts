import { describe, expect, it, vi } from "vite-plus/test";
import { EXAMPLE_URL, type ParseSuccess } from "@milanote-api/api/contracts";
import { collect, apiLoader, validateSchedule } from "../src/index.ts";

const result: ParseSuccess = {
  ok: true,
  data: { title: "private-board" },
  meta: {
    scope: "root",
    complete: true,
    warnings: [],
    unloadedBoardIds: [],
    upstreamRequests: 2,
    timings: { permission: 1, boards: 2, parse: 1, total: 4 },
  },
};
const base = {
  jobId: "test",
  request: { url: EXAMPLE_URL, scope: "root" as const },
  load: async () => structuredClone(result),
};
describe("collection outputs", () => {
  it("retries Webhook twice with a stable run ID and records storage independently", async () => {
    const store = vi.fn();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("fail", { status: 503 }))
      .mockRejectedValueOnce(new Error("secret-url"))
      .mockResolvedValue(new Response("ok"));
    const summary = await collect({
      ...base,
      store,
      webhook: { url: "https://webhook.test/secret", token: "private-token" },
      fetchImpl,
      sleep: async () => {},
    });
    expect(summary).toMatchObject({
      status: "success",
      storage: "success",
      webhook: "success",
      webhookAttempts: 3,
    });
    expect(store).toHaveBeenCalledOnce();
    expect(
      fetchImpl.mock.calls.every(
        ([, init]) => new Headers(init?.headers).get("X-Run-Id") === summary.runId,
      ),
    ).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/private|secret|milanote\.com/);
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body.runId).toBe(summary.runId);
  });
  it("does not overwrite a complete snapshot with incomplete data but still pushes it", async () => {
    const store = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok"));
    const summary = await collect({
      ...base,
      load: async () => ({ ...result, meta: { ...result.meta, complete: false } }),
      store,
      webhook: { url: "https://webhook.test" },
      fetchImpl,
    });
    expect(summary).toMatchObject({ status: "incomplete", storage: "skipped", webhook: "success" });
    expect(store).not.toHaveBeenCalled();
  });
  it("retains the old snapshot on failure or malformed API success", async () => {
    const store = vi.fn();
    for (const load of [
      async () => {
        throw new Error("secret");
      },
      async () => ({ ok: true }),
    ]) {
      expect(await collect({ ...base, store, load })).toMatchObject({
        status: "failed",
        storage: "skipped",
      });
    }
    expect(store).not.toHaveBeenCalled();
  });
  it("continues webhook after storage fails and stops after three failed attempts", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("failure"));
    const summary = await collect({
      ...base,
      store: () => {
        throw new Error("disk full");
      },
      webhook: { url: "https://webhook.test" },
      fetchImpl,
      sleep: async () => {},
    });
    expect(summary).toMatchObject({ storage: "failed", webhook: "failed", webhookAttempts: 3 });
  });
  it("requires an output and validates API boundaries", async () => {
    await expect(collect(base)).rejects.toThrow("至少一个输出");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("bad", { status: 502 }));
    await expect(apiLoader("https://api.test", undefined, fetchImpl)(base.request)).rejects.toThrow(
      "API_HTTP_502",
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(() => apiLoader("https://secret@api.test")).toThrow();
  });
  it("validates UTC schedules and the Actions five-minute floor", () => {
    for (const cron of ["*/5 * * * *", "0 1 * * *", "0 1 * * MON", "0,10,20 1-3 * * MON-FRI"])
      expect(validateSchedule(cron, 5)).toBe(cron);
    for (const cron of ["* * * * *", "*/2 * * * *", "0,1 * * * *"])
      expect(() => validateSchedule(cron, 5)).toThrow("5 分钟");
    for (const cron of ["60 * * * *", "0 25 * * *", "*/0 * * * *", "0 0 * * NOPE"])
      expect(() => validateSchedule(cron)).toThrow();
  });
});
