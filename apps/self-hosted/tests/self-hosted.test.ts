import { mkdtemp, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { EXAMPLE_URL, type BoardLoader } from "@milanote-api/api";
import type { BoardFetchResult } from "@milanote-api/parser";
import { collectJob } from "../src/collect.ts";
import { configSchema } from "../src/config.ts";
import { openStore, type SnapshotStore } from "../src/store.ts";
import { buildServer } from "../src/server.ts";

const directories: string[] = [];
const stores: SnapshotStore[] = [];
afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
const fixture: BoardFetchResult = {
  document: {
    version: 1,
    source: { provider: "milanote", boardId: "example" },
    fetchedAt: "2026-10-04T00:00:00.000Z",
    board: {
      id: "example",
      type: "BOARD",
      title: "Private",
      location: {},
      timestamps: {},
      children: [],
      defaultColorPalette: [],
    },
  },
  diagnostics: {
    scope: "root",
    complete: true,
    unloadedBoardIds: [],
    warnings: [],
    upstreamRequests: 2,
    timings: { permission: 1, boards: 2, parse: 1, total: 4 },
  },
};
async function setup(storage = true) {
  const path = await mkdtemp(join(tmpdir(), "milanote-linux-"));
  directories.push(path);
  const config = configSchema.parse({
    lockDirectory: join(path, "locks"),
    storage: { enabled: storage, path: join(path, "snapshots.sqlite") },
    jobs: [{ id: "board", urlEnv: "BOARD_URL", webhookUrlEnv: "WEBHOOK_URL" }],
  });
  const store = storage ? openStore(config.storage.path) : undefined;
  if (store) stores.push(store);
  return { config, store, env: { BOARD_URL: EXAMPLE_URL, WEBHOOK_URL: "https://hook.test" } };
}
it("collects to SQLite and webhook; serves authenticated snapshots while parsing remains live", async () => {
  const { config, store, env } = await setup();
  const loader = vi.fn<BoardLoader>(async () => structuredClone(fixture));
  const webhook = vi.fn<typeof fetch>(async () => new Response("ok"));
  const summary = await collectJob(config, "board", env, store, loader, webhook);
  expect(summary).toMatchObject({ status: "success", storage: "success", webhook: "success" });
  expect(store!.read("board")?.runId).toBe(summary.runId);
  const server = buildServer({ store, token: "secret-token", loader });
  try {
    expect((await server.inject({ method: "GET", url: "/api/snapshots/board" })).statusCode).toBe(
      401,
    );
    const snapshot = await server.inject({
      method: "GET",
      url: "/api/snapshots/board",
      headers: { authorization: "Bearer secret-token" },
    });
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json().runId).toBe(summary.runId);
    expect(snapshot.headers["cache-control"]).toBe("no-store");
    expect((await server.inject({ method: "GET", url: "/api/capabilities" })).json()).toMatchObject(
      { storage: true, cache: false, scheduling: false },
    );
    const live = await server.inject({
      method: "POST",
      url: "/api/boards/parse",
      payload: { url: EXAMPLE_URL },
    });
    expect(live.statusCode).toBe(200);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/boards/parse",
          headers: { "content-type": "application/json" },
          payload: "{",
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await server.close();
  }
});
it("does not create a database with storage off", async () => {
  const { config, env } = await setup(false);
  const summary = await collectJob(
    config,
    "board",
    env,
    undefined,
    async () => fixture,
    async () => new Response("ok"),
  );
  expect(summary.storage).toBe("disabled");
  await expect(access(config.storage.path)).rejects.toThrow();
  const server = buildServer();
  try {
    expect((await server.inject({ method: "GET", url: "/api/snapshots/board" })).statusCode).toBe(
      404,
    );
  } finally {
    await server.close();
  }
});
it("retains snapshots on upstream failure, incomplete reads, and a failed SQLite transaction", async () => {
  const { config, store, env } = await setup();
  const webhook: typeof fetch = async () => new Response("ok");
  const initial = await collectJob(config, "board", env, store, async () => fixture, webhook);
  const incomplete = await collectJob(
    config,
    "board",
    env,
    store,
    async () => ({ ...fixture, diagnostics: { ...fixture.diagnostics, complete: false } }),
    webhook,
  );
  expect(incomplete.status).toBe("incomplete");
  const failed = await collectJob(
    config,
    "board",
    env,
    store,
    async () => {
      throw new Error("upstream secret");
    },
    webhook,
  );
  expect(failed.status).toBe("failed");
  const database = new Database(config.storage.path);
  database.exec(
    "CREATE TRIGGER reject_snapshot BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT, 'disk failure simulation'); END;",
  );
  database.close();
  const transaction = await collectJob(config, "board", env, store, async () => fixture, webhook);
  expect(transaction).toMatchObject({ storage: "failed", webhook: "success" });
  expect(store!.read("board")?.runId).toBe(initial.runId);
  for (let count = 0; count < 110; count++) store!.record(initial);
  expect(store!.summaries()).toHaveLength(100);
  expect(JSON.stringify(store!.summaries())).not.toMatch(/Private|your-permission|upstream secret/);
});
it("prevents overlapping processes for one job and releases its lock after completion", async () => {
  const { config, env } = await setup(false);
  let resolve!: (value: BoardFetchResult) => void;
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const pending = new Promise<BoardFetchResult>((r) => {
    resolve = r;
  });
  const first = collectJob(
    config,
    "board",
    env,
    undefined,
    async () => {
      entered();
      return pending;
    },
    async () => new Response("ok"),
  );
  await started;
  await expect(collectJob(config, "board", env, undefined, async () => fixture)).rejects.toThrow(
    "任务正在运行",
  );
  resolve(fixture);
  await first;
  expect(
    (
      await collectJob(
        config,
        "board",
        env,
        undefined,
        async () => fixture,
        async () => new Response("ok"),
      )
    ).status,
  ).toBe("success");
});
