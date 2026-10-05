# GitHub Actions 定时采集

此方案运行在你自己的仓库，调用 `API_BASE_URL` 指向的实时 API。官方页面不会代你采集。需要 Node.js 24、pnpm 11 和本项目完整源码。

## 配置与首次运行

[下载 Workflow 模板](/templates/github-actions.yml)。模板随文档构建从仓库源文件导出，在项目完整源码中使用。

1. Fork 或克隆项目到自己的仓库，将 `templates/github-actions/collect.yml` 复制到 `.github/workflows/collect.yml`，提交到默认分支。
2. 在仓库 Settings → Secrets and variables → Actions 中配置变量 `API_BASE_URL`（例如 `https://YOUR_API_HOST`）；在 Secrets 中设置 `BOARD_URL`，内容为完整公开分享链接。
3. 至少选择一个输出：设置变量 `STORAGE_ENABLED=true` 保存运行产物，或者配置 Secret `WEBHOOK_URL`。默认不存储，没有任何输出会失败。
4. 可选 Secret：`API_TOKEN` 是 API Bearer Token，`WEBHOOK_TOKEN` 用于推送认证。不要将分享链接或令牌写入 Workflow。
5. 在 Actions → Collect Milanote → Run workflow 手动运行，确认日志中的 `status`、`storage`、`webhook`，再启用计划调度。

默认 `BOARD_SCOPE=root`；要采集完整递归，在 Workflow 中改为 `tree`。读取不完整时跳过存储，但 Webhook 仍携带 `meta.complete=false`，供接收方判断。

## 调度

| UTC cron      | 北京时间          | 用途     |
| ------------- | ----------------- | -------- |
| `*/5 * * * *` | 每 5 分钟         | 默认     |
| `0 1 * * *`   | 每天 09:00        | 每天一次 |
| `0 1 * * MON` | 每周 Monday 09:00 | 每周一次 |

修改 Workflow 的 `schedule` 字段。手动执行的校验值默认为 5 分钟；计划执行校验实际事件的 cron。低于 5 分钟会明确报错。GitHub 的计划任务可能延迟，并非准点保证，详见 [GitHub 调度文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

## 输出与查看结果

开启存储后，在对应运行的 Artifacts 下载 `milanote-snapshot-运行ID`，默认保留 7 天。包含 `latest.json`：运行 ID、任务 ID、采集时间及完整 API 响应。文件属于你自己的仓库运行产物，注意仓库的读取权限。

Webhook 发送同样的 JSON，`X-Run-Id` 与正文 `runId` 一致。失败最多重试两次，重试沿用同一个 ID；接收方应按 ID 去重。存储和推送分别记录状态，某个输出失败不会阻止另一个输出。日志只有脱敏摘要，不输出分享链接、正文或凭据。各状态的含义见[采集结果与 Webhook](./deployment#采集结果与-webhook)。

Webhook 失败时采集步骤和整个 Workflow 仍会标记失败，但只要已经生成完整快照且运行未被取消，上传产物步骤仍会执行。模板用 `!cancelled()` 覆盖 GitHub Actions 默认的 `success()` 条件，参见 [GitHub 状态检查函数](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)。

每次托管运行使用独立工作目录，不自动下载前一次产物。失败或不完整的读取不会生成新快照；前次成功运行的产物会保留到其过期时间。这里不提供一个跨运行永久存在的“最新快照”地址。

## 本地执行、停止和排错

设置上述环境变量后执行 `pnpm --filter @milanote-api/actions-collector collect`，产物位于 `apps/actions-collector/output/latest.json`。纯 Webhook 模式不创建输出目录。

停止定时任务可删除 Workflow 的 `schedule`（保留手动触发）或在 Actions 禁用 Workflow。删除运行产物可提前清理快照。

- 配置失败：检查至少一个输出、API 地址、公开分享链接及五字段 cron。
- `status=failed`：API 不可用、认证失败、超时或响应不符合契约；到调试台重现相同请求。
- `status=incomplete`：子画板失败或达到上限，旧快照不会被替换。
- `webhook=failed`：确认接收端地址、认证和容量限制；查看接收端按运行 ID 查询的日志。
- 同一仓库 Workflow 使用 concurrency 禁止重叠执行；平台可能合并或延迟排队任务。
