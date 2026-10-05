import { expect, it, vi } from "vite-plus/test";
import { EXAMPLE_URL } from "@milanote-api/api/contracts";
import worker, { runWorker } from "../src/index.ts";

const result = {
  ok: true,
  data: {},
  meta: {
    scope: "root",
    complete: true,
    warnings: [],
    unloadedBoardIds: [],
    upstreamRequests: 2,
    timings: { permission: 1, boards: 2, parse: 1, total: 4 },
  },
};
it("collects the mock API into R2 and webhook, preserving old snapshots on incomplete reads", async () => {
  const put = vi.fn().mockResolvedValue(undefined);
  const env = {
    BOARD_URL: EXAMPLE_URL,
    API_BASE_URL: "https://api.test",
    WEBHOOK_URL: "https://hook.test",
    STORAGE_ENABLED: "true",
    SNAPSHOTS: { put },
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url) =>
    (url instanceof Request ? url.url : url.toString()).includes("api.test")
      ? Response.json(result)
      : new Response("ok"),
  );
  const summary = await runWorker(env, fetchImpl);
  expect(summary).toMatchObject({ status: "success", storage: "success", webhook: "success" });
  expect(JSON.parse(put.mock.calls[0]![1] as string)).toMatchObject({
    runId: summary.runId,
    result,
  });
  fetchImpl.mockImplementation(async (url) =>
    (url instanceof Request ? url.url : url.toString()).includes("api.test")
      ? Response.json({ ...result, meta: { ...result.meta, complete: false } })
      : new Response("ok"),
  );
  expect((await runWorker(env, fetchImpl)).storage).toBe("skipped");
  expect(put).toHaveBeenCalledOnce();
});
it("defaults storage off, requires an output and protects manual trigger", async () => {
  const env = { BOARD_URL: EXAMPLE_URL, API_BASE_URL: "https://api.test", RUN_TOKEN: "private" };
  await expect(runWorker(env)).rejects.toThrow("至少一个输出");
  const response = await worker.fetch(
    new Request("https://worker.test/collect", { method: "POST" }),
    env,
  );
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(runWorker({ ...env, STORAGE_ENABLED: "true" })).rejects.toThrow("R2");
});
