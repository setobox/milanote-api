import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { EXAMPLE_URL } from "@milanote-api/api/contracts";
import { runFailed } from "@milanote-api/collector";
import { runActions } from "../src/index.ts";

const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
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
it("collects a mock API to artifact and webhook, preserving a successful artifact after failure", async () => {
  const path = await mkdtemp(join(tmpdir(), "milanote-actions-"));
  directories.push(path);
  const env = {
    BOARD_URL: EXAMPLE_URL,
    API_BASE_URL: "https://api.test",
    STORAGE_ENABLED: "true",
    WEBHOOK_URL: "https://hook.test",
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url) =>
    (url instanceof Request ? url.url : url.toString()).includes("api.test")
      ? Response.json(result)
      : new Response("ok"),
  );
  const summary = await runActions(env, path, fetchImpl);
  expect(summary).toMatchObject({ storage: "success", webhook: "success" });
  expect(JSON.parse(await readFile(join(path, "latest.json"), "utf8"))).toMatchObject({
    runId: summary.runId,
    result,
  });
  fetchImpl.mockImplementation(async () => new Response("offline", { status: 502 }));
  expect((await runActions(env, path, fetchImpl)).status).toBe("failed");
  expect(JSON.parse(await readFile(join(path, "latest.json"), "utf8"))).toMatchObject({
    runId: summary.runId,
  });
});
it("does not create storage by default and rejects schedules below five minutes", async () => {
  const path = await mkdtemp(join(tmpdir(), "milanote-actions-"));
  directories.push(path);
  const output = join(path, "unused");
  const env = {
    BOARD_URL: EXAMPLE_URL,
    API_BASE_URL: "https://api.test",
    WEBHOOK_URL: "https://hook.test",
  };
  const fetchImpl = vi.fn<typeof fetch>(async (url) =>
    (url instanceof Request ? url.url : url.toString()).includes("api.test")
      ? Response.json(result)
      : new Response("ok"),
  );
  expect((await runActions(env, output, fetchImpl)).storage).toBe("disabled");
  await expect(access(output)).rejects.toThrow();
  await expect(
    runActions({ ...env, COLLECT_CRON: "* * * * *" }, output, fetchImpl),
  ).rejects.toThrow("5 分钟");
});
it("keeps the artifact upload eligible when a webhook failure fails the collection step", async () => {
  const path = await mkdtemp(join(tmpdir(), "milanote-actions-"));
  directories.push(path);
  const summary = await runActions(
    {
      BOARD_URL: EXAMPLE_URL,
      API_BASE_URL: "https://api.test",
      STORAGE_ENABLED: "true",
      WEBHOOK_URL: "https://hook.test",
    },
    path,
    async (url) =>
      (url instanceof Request ? url.url : url.toString()).startsWith("https://api.test/")
        ? Response.json(result)
        : new Response("offline", { status: 503 }),
  );
  expect(summary).toMatchObject({
    status: "success",
    storage: "success",
    webhook: "failed",
    webhookAttempts: 3,
  });
  expect(runFailed(summary)).toBe(true);
  expect(JSON.parse(await readFile(join(path, "latest.json"), "utf8"))).toMatchObject({
    runId: summary.runId,
    result,
  });
  const workflow = await readFile(
    new URL("../../../templates/github-actions/collect.yml", import.meta.url),
    "utf8",
  );
  // A status function overrides Actions' implicit success() after the CLI exits nonzero.
  const uploadCondition = workflow.match(
    /uses: actions\/upload-artifact@[^\r\n]+\r?\n\s+if: ([^\r\n]+)/,
  )?.[1];
  expect(uploadCondition).toBe("${{ !cancelled() && env.STORAGE_ENABLED == 'true' }}");
});
