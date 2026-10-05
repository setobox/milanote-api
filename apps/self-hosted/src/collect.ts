import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createApp, type BoardLoader } from "@milanote-api/api";
import { collect, secret, type RunSummary } from "@milanote-api/collector";
import { jobRequest, type Config } from "./config.ts";
import type { SnapshotStore } from "./store.ts";

export async function collectJob(
  config: Config,
  jobId: string,
  env: Record<string, string | undefined>,
  store?: SnapshotStore,
  loader?: BoardLoader,
  fetchImpl: typeof fetch = fetch,
): Promise<RunSummary> {
  const job = config.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("任务不存在");
  if (config.storage.enabled && !store) throw new Error("存储未初始化");
  const request = jobRequest(job, env);
  const webhook = job.webhookUrlEnv
    ? {
        url: secret(env, job.webhookUrlEnv),
        token: job.webhookTokenEnv ? secret(env, job.webhookTokenEnv) : undefined,
      }
    : undefined;
  if (!config.storage.enabled && !webhook) throw new Error("至少配置一个输出");
  await mkdir(config.lockDirectory, { recursive: true, mode: 0o700 });
  const lockPath = join(config.lockDirectory, `${job.id}.lock`);
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch {
    throw new Error("任务正在运行或存在遗留锁；确认没有运行进程后清理锁文件");
  }
  try {
    await lock.writeFile(String(process.pid));
    const api = createApp({ loader });
    const summary = await collect({
      jobId: job.id,
      request,
      webhook,
      fetchImpl,
      load: async (body) => {
        const response = await api.fetch(
          new Request("http://localhost/api/boards/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        );
        if (!response.ok) throw new Error("PARSE_FAILED");
        return response.json();
      },
      ...(config.storage.enabled && store ? { store: (snapshot) => store.write(snapshot) } : {}),
    });
    store?.record(summary);
    return summary;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
