# Workers 定时采集

这是 `apps/scheduled-worker` 提供的用户自部署模板，与无状态的官方 `apps/api-worker` 分开。模板调用你配置的实时 API，默认每 60 秒运行一次；默认不存储数据。

## 配置和首次运行

[下载 Wrangler 配置模板](/templates/worker-wrangler.jsonc)，与仓库内 `apps/scheduled-worker` 源码一起使用。

在完整仓库安装依赖 `pnpm install --frozen-lockfile`，修改 `apps/scheduled-worker/wrangler.jsonc` 中 Worker 名称和 `API_BASE_URL` 为你自己的服务。Node.js 24、pnpm 11、Cloudflare 账号是前提。

在 `apps/scheduled-worker` 目录执行以下命令，交互输入值，避免凭据进入命令历史：

```sh
pnpm exec wrangler secret put BOARD_URL
pnpm exec wrangler secret put WEBHOOK_URL
pnpm exec wrangler secret put RUN_TOKEN
# 有认证时再配置：
pnpm exec wrangler secret put API_TOKEN
pnpm exec wrangler secret put WEBHOOK_TOKEN
pnpm run deploy
```

分享链接只放 `BOARD_URL` Secret。`RUN_TOKEN` 保护手动触发入口。至少配置 Webhook 或存储之一。变量 `BOARD_SCOPE` 默认为 `root`，可改为 `tree`。

先发送 `POST https://YOUR_COLLECTOR_HOST/collect`，请求头 `Authorization: Bearer YOUR_MANUAL_TRIGGER_TOKEN`；响应中的 `status=success` 以及相应输出 `success` 表示首次运行通过。该入口只返回执行摘要。

## 定时调度

修改 Wrangler `triggers.crons` 后重新部署。所有表达式为 UTC：

| cron          | 北京时间          |
| ------------- | ----------------- |
| `* * * * *`   | 每 60 秒，默认    |
| `0 1 * * *`   | 每天 09:00        |
| `0 1 * * MON` | 每周 Monday 09:00 |

触发器更新可能需要传播时间，参见 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。本地将 `.dev.vars.example` 复制为 `.dev.vars` 并填写自己的值，执行 `pnpm run dev`；使用 `/__scheduled?cron=*+*+*+*+*` 测试计划任务。该本地测试也会访问你配置的 API 和输出端。

## 可选 R2 存储

在自己的 Cloudflare 账号创建 R2 bucket。在 Wrangler 中设置 `STORAGE_ENABLED: "true"` 并增加绑定：

```json
{
  "r2_buckets": [{ "binding": "SNAPSHOTS", "bucket_name": "YOUR_BUCKET_NAME" }]
}
```

将这个属性合并到现有 Wrangler 配置，保留 `main`、`vars`、`triggers` 等其他配置项。

仅成功且 `meta.complete=true` 的结果写入 `default/latest.json`，失败或不完整不会覆盖旧对象。不启用公共访问；在自己的 R2 控制台或已认证客户端查看、备份或删除对象。没有绑定却开启存储会报错；默认关闭时不会调用 R2。

Webhook 可与 R2 同时启用。正文包含 `runId`、`jobId`、`capturedAt` 和 API 响应 `result`。`X-Run-Id` 用于去重，失败最多重试两次。两种输出各自记录状态；读取不完整只允许推送，不覆盖快照。

`status=success` 只表示读取成功，还需检查 `storage` 和 `webhook`；字段含义见[采集结果与 Webhook](./deployment#采集结果与-webhook)。当前模板没有跨 Worker 实例的任务锁，手动触发与 Cron 可能并发；需要同一任务严格串行执行时使用提供跨进程锁的 Linux 方案。

## 停止与排错

清空 `triggers.crons` 并部署可停止自动采集；保留 `/collect` 手动入口。删除 Worker 会同时移除手动入口，R2 数据需单独清理。

使用 `pnpm exec wrangler tail` 查看脱敏执行摘要（模板默认关闭持久化观测日志）。不记录响应正文、链接、凭据或 Webhook 地址。`UNAUTHORIZED` 表示手动 Token 缺失或不匹配；`INVALID_COLLECTOR_CONFIG` 通常是地址、输出或 R2 绑定未配置。执行返回 502 时检查摘要中 `status`、`storage`、`webhook`，并在调试台手动测试 API。
