import { resolve } from "node:path";
import { runFailed, secret } from "@milanote-api/collector";
import { readConfig } from "./config.ts";
import { collectJob } from "./collect.ts";
import { openStore } from "./store.ts";
import { buildServer } from "./server.ts";

try {
  const [command, ...args] = process.argv.slice(2);
  const config = await readConfig(resolve(process.env.MILANOTE_CONFIG ?? "config.json"));
  if (command === "schedule") {
    console.log("# UTC schedules. Set CRON_TZ=UTC; run each command from the repository root.");
    for (const job of config.jobs)
      console.log(`${job.cron} pnpm --filter @milanote-api/self-hosted collect ${job.id}`);
  } else {
    const token = config.storage.enabled ? secret(process.env, config.storage.tokenEnv) : undefined;
    const store = config.storage.enabled ? openStore(config.storage.path) : undefined;
    try {
      if (command === "serve") {
        const server = buildServer({ store, token });
        for (const event of ["SIGTERM", "SIGINT"] as const)
          process.once(event, () => {
            void server.close().then(() => store?.close());
          });
        await server.listen({ host: config.host, port: config.port });
        console.log(`API listening on ${config.host}:${config.port}`);
      } else if (command === "collect" && args.length === 1) {
        const summary = await collectJob(config, args[0]!, process.env, store);
        console.log(JSON.stringify(summary));
        if (runFailed(summary)) process.exitCode = 1;
        store?.close();
      } else {
        store?.close();
        throw new Error("使用 serve、collect JOB_ID 或 schedule");
      }
    } catch (error) {
      store?.close();
      throw error;
    }
  }
} catch {
  console.error("启动或执行失败：检查配置、环境变量、任务锁和输出设置。");
  process.exitCode = 1;
}
