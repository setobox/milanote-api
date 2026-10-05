import { resolve } from "node:path";
import { runFailed } from "@milanote-api/collector";
import { runActions } from "./index.ts";

try {
  const summary = await runActions(process.env, resolve("output"));
  console.log(JSON.stringify(summary));
  if (runFailed(summary)) process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof Error && error.message === "调度间隔不得低于 5 分钟"
      ? error.message
      : "采集配置无效：检查 API_BASE_URL、BOARD_URL、COLLECT_CRON 和输出设置。",
  );
  process.exitCode = 1;
}
