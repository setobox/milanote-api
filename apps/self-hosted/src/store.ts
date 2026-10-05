import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { successSchema } from "@milanote-api/api/contracts";
import type { RunSummary, Snapshot } from "@milanote-api/collector";
import { z } from "zod";

const snapshotSchema = z.object({
  runId: z.string(),
  jobId: z.string(),
  capturedAt: z.string(),
  result: successSchema,
});
export interface SnapshotStore {
  write(snapshot: Snapshot): void;
  record(summary: RunSummary): void;
  read(jobId: string): Snapshot | undefined;
  summaries(): unknown[];
  backup(path: string): Promise<unknown>;
  close(): void;
}
export function openStore(path: string): SnapshotStore {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.exec(
    "CREATE TABLE IF NOT EXISTS snapshots (job_id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);",
  );
  const write = database.transaction((snapshot: Snapshot) => {
    const checked = snapshotSchema.parse(snapshot);
    if (!checked.result.meta.complete) throw new Error("不完整结果不能覆盖快照");
    database
      .prepare(
        "INSERT INTO snapshots(job_id, body) VALUES (?, ?) ON CONFLICT(job_id) DO UPDATE SET body = excluded.body",
      )
      .run(checked.jobId, JSON.stringify(checked));
  });
  const record = database.transaction((summary: RunSummary) => {
    // Pick the public summary fields explicitly: no arbitrary response or secret fields may persist.
    const { runId, jobId, startedAt, elapsedMs, status, storage, webhook, webhookAttempts } =
      summary;
    database.prepare("INSERT INTO runs(body) VALUES (?)").run(
      JSON.stringify({
        runId,
        jobId,
        startedAt,
        elapsedMs,
        status,
        storage,
        webhook,
        webhookAttempts,
      }),
    );
    database.exec(
      "DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 100)",
    );
  });
  return {
    write,
    record,
    read(jobId: string): Snapshot | undefined {
      const row = database.prepare("SELECT body FROM snapshots WHERE job_id = ?").get(jobId) as
        | { body: string }
        | undefined;
      return row ? snapshotSchema.parse(JSON.parse(row.body)) : undefined;
    },
    summaries(): unknown[] {
      return (
        database.prepare("SELECT body FROM runs ORDER BY id DESC").all() as Array<{ body: string }>
      ).map((row) => JSON.parse(row.body) as unknown);
    },
    backup(path: string) {
      return database.backup(path);
    },
    close() {
      database.close();
    },
  };
}
