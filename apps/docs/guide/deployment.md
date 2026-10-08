# 部署指南

自动更新模板：[GitHub Actions](./actions)、[Workers Cron 与 R2](./scheduled-worker)、[Linux、systemd 与 SQLite](./linux)。每套方案均支持手动运行、Webhook 和可选存储。

官方站点分为静态网页与无状态 API 两部分。GitHub Pages 提供文档和调试台，Cloudflare Worker 只处理实时解析。官方不存储或缓存用户数据，不运行定时采集。

## 官方 Worker

```bash
pnpm install
pnpm --filter @milanote-api/worker run build
pnpm --filter @milanote-api/worker run deploy
```

Worker 不绑定数据库、KV、R2 或 Cron Trigger。部署需要自己的 CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ACCOUNT_ID。build 只执行类型检查与 dry-run，不发布。

可以通过 Worker 环境变量 `PUBLIC_SITE_URL` 指定文档首页的完整 HTTPS 地址。配置后，API 域名的根路径会以 302 跳转到文档站，查询参数不会被转发；`/api/*` 仍由 Worker 处理。未配置时，Worker 只提供 API。CI 默认使用当前仓库的 GitHub Pages 文档首页；自定义域名或用户主页仓库需另外设置仓库变量 `PUBLIC_SITE_URL` 为实际文档首页地址。

## 静态站点与 GitHub Pages

构建时设置：

```bash
export PUBLIC_BASE_PATH=/milanote-api/
export VITE_API_BASE_URL=https://YOUR_API_HOST
pnpm run build
pnpm run verify:site
```

PUBLIC_BASE_PATH 必须与 Pages 仓库路径相同；自定义域名或用户主页仓库使用 /。Windows PowerShell 使用 `$env:PUBLIC_BASE_PATH = "/milanote-api/"` 设置环境变量。

静态产物为 apps/playground/dist。站点根路径跳转到 `docs/` 首页，指南在 `guide/`、参考在 `reference/`，调试台在 `playground/`。API 地址是公开构建配置，不能包含 Token。在仓库 Variables 中设置 `API_BASE_URL`（CI 注入为 `VITE_API_BASE_URL`）；Pages 发布源选择 GitHub Actions。设置 `DEPLOY_WORKER=true` 才会自动发布 Worker，并配置上述两个 Cloudflare Secrets。

CI 会检查格式、类型、测试、文档示例、构建与站内链接。Pages 与 Worker 分别发布，静态站点不包含任何 Worker 密钥。

CI 默认按仓库名称生成子路径；自定义域名或用户主页仓库可设置仓库变量 `PUBLIC_BASE_PATH=/`。没有 `API_BASE_URL` 时只验证构建，不发布 Pages。main 分支 push 或在 Actions 的 CI 页面选择 Run workflow 后，验证通过才会发布，PR 不会部署。

## 本地开发

先检查是否已有服务运行。需要完整联调时在两个终端分别执行：

```bash
pnpm run dev:api
pnpm run dev
```

API 监听 8787，Vite 将 /api 转发到本地服务。文档单独开发可用 pnpm run docs:dev。根路径自动跳转到 `/docs/` 文档首页；配置仓库子路径时会保留该前缀。调试台可在设置页改用其他 API，跨域服务需允许 POST、Content-Type 和 Authorization。

`pnpm run dev` 启动前会构建一次文档。编辑 Markdown 后，需要重新执行 `pnpm --filter @milanote-api/docs build` 才会更新 5173 上的文档；需要文档热更新时使用独立的 `pnpm run docs:dev`。

## 跨域连接与认证

调试台“设置”中的 API 服务地址只填写服务根地址，例如 `https://YOUR_API_HOST`，不包含 `/api/boards/parse`、查询参数或令牌。Pages 的仓库子路径只影响静态站点；独立 Worker API 仍使用 `/api/boards/parse`。

Worker 与 Linux 的实时接口允许 `Access-Control-Allow-Origin: *`，预检允许 `Content-Type`、`Authorization` 和对应请求方法，并暴露 `Server-Timing`、`X-Upstream-Requests`、`X-Request-Id`。反向代理需同时放行 OPTIONS 和实际请求，并保留这些响应头；否则直接用 cURL 可成功，浏览器仍可能报告网络错误。

实时解析服务自身不校验 Bearer Token。调试台的 Token 字段用于连接用户增加了认证的网关或反向代理；填写 Token 不会自动为公开 API 加上访问控制。Linux 快照接口有独立的 Token 校验，且不开放跨域读取。需要限制可调用来源时在自己的代理设置允许的 Origin，CORS 本身不代替认证。

## 采集结果与 Webhook

三种采集方式使用相同的脱敏摘要：

| 字段                      | 含义                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `runId` / `jobId`         | 本次执行 ID / 任务 ID；一次执行的所有重试沿用 runId                           |
| `startedAt` / `elapsedMs` | UTC 开始时间 / 总耗时（毫秒）                                                 |
| `status`                  | `success` 读取完整；`incomplete` 读取不完整；`failed` 读取失败或 API 响应无效 |
| `storage` / `webhook`     | `disabled` 未配置；`skipped` 未执行；`success` 成功；`failed` 输出失败        |
| `webhookAttempts`         | 实际推送次数，0–3 次                                                          |

例如 `status=success, storage=success, webhook=failed` 表示已取得并保存完整数据，但推送失败，不能仅按 `status` 判断整个任务成功。Actions 和 Linux 此时返回非零退出码；Worker 手动入口返回 502，计划触发记录失败。读取失败时两种输出均跳过；读取不完整时只允许推送，不覆盖完整快照。存储关闭并不关闭 Webhook，二者可单独启用或同时启用。

Webhook 使用 HTTP POST、`Content-Type: application/json`，配置推送 Token 后附带 `Authorization: Bearer ...`。正文为 `{ runId, jobId, capturedAt, result }`，其中 `result` 是带 `ok`、`data`、`meta` 的 API 成功响应；快照存储使用同样的结构。`capturedAt` 为本次执行开始的 UTC 时间。

接收方以 2xx 确认接收，每次请求超时为 10 秒；网络错误或非 2xx 最多重试两次，重试前分别等待 250、500 毫秒。不跟随重定向。`X-Run-Id` 与正文 `runId` 一致，接收方应按该 ID 去重；单次执行结束后不会再后台补发。Webhook 会收到画板数据，请在自己的接收端检查认证与 `result.meta.complete`，不要把正文写入公开日志。

## 自部署扩展

用户自己的自动更新与存储独立于官方站点。每个部署环境的模板与教程随对应功能一起提供。分享链接通过环境变量或 Secrets 配置，官方服务不会保存定时任务。
