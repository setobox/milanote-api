# Linux 实时 API 与采集

`apps/self-hosted` 使用 Fastify，直接调用解析核心，无需依赖官方 API。实时解析、手动采集和系统定时任务共用请求契约；实时接口始终请求上游，不读取快照。

## 配置与首次运行

下载：[配置文件](/templates/linux-config.json)、[API Service](/templates/milanote-api.service)、[采集 Service](/templates/milanote-collect.service)、[Timer](/templates/milanote-collect.timer)、[crontab](/templates/crontab.example)。这些文件在项目完整源码中使用。

准备 Node.js 24、pnpm 11，将完整仓库放在 `/opt/milanote-api`，执行 `pnpm install --frozen-lockfile`。SQLite 驱动为 `better-sqlite3`，缺少适用预编译文件时需要系统 C++ 构建工具。

将 `apps/self-hosted/config.example.json` 复制为 `apps/self-hosted/config.json`。默认监听 `127.0.0.1:8787`，存储关闭。配置路径也可通过 `MILANOTE_CONFIG` 指定绝对路径；数据库和锁目录相对配置文件解析。程序不会自动加载 `.env` 文件；本地运行前需导出变量，systemd 和 cron 按下文加载环境文件。

```json
{
  "host": "127.0.0.1",
  "port": 8787,
  "lockDirectory": "./data/locks",
  "storage": { "enabled": false, "path": "./data/snapshots.sqlite", "tokenEnv": "SNAPSHOT_TOKEN" },
  "jobs": [
    {
      "id": "daily-board",
      "urlEnv": "BOARD_URL",
      "scope": "root",
      "cron": "* * * * *",
      "webhookUrlEnv": "WEBHOOK_URL"
    }
  ]
}
```

把分享链接放入环境变量 `BOARD_URL`，把接收地址放入 `WEBHOOK_URL`。有推送认证时，在任务配置中增加 `webhookTokenEnv: "WEBHOOK_TOKEN"`，并设置对应环境变量。配置文件只引用变量名称，不包含分享凭据。`scope`、`view`、`include`、`exclude` 与 HTTP API 规则相同。

在仓库根目录执行：

```sh
pnpm --filter @milanote-api/self-hosted start
# 另一个终端，继承相同环境：
pnpm --filter @milanote-api/self-hosted collect daily-board
```

服务提供 `POST /api/boards/parse`、`GET /api/capabilities` 和 `GET /api/openapi.json`。调试台 API 地址填 `http://127.0.0.1:8787`。命令返回脱敏执行摘要；至少配置存储或 Webhook 一个输出，二者可同时启用。`status`、`storage`、`webhook` 均符合预期后再配置定时任务。

## systemd 与 cron

仓库 `templates/linux` 提供 API Service、采集 Service、60 秒 Timer 和 crontab 示例。创建专用 `milanote` 系统用户，确保能访问仓库、Node/pnpm 和数据目录。将配置放在 `/etc/milanote-api.json`、环境变量放在权限为 `600` 且该用户可读的 `/etc/milanote-api.env`；修改模板中的实际路径、任务 ID 和用户。

配置移到 `/etc` 后，应将 `lockDirectory` 改为 `/var/lib/milanote-api/locks`，将 `storage.path` 改为 `/var/lib/milanote-api/snapshots.sqlite`，并创建归 `milanote` 用户所有、权限为 `700` 的 `/var/lib/milanote-api`。否则相对路径 `./data` 会落到 `/etc/data`，普通服务用户通常无法写入。关闭 SQLite 时采集仍需要可写的锁目录。

systemd 不会加载交互式 shell 配置。确认 Node 和 pnpm 位于服务的 PATH 中；若通过用户版本管理器安装，在 unit 中显式设置对应 PATH 或使用可执行文件的绝对路径。

复制 unit 文件到 `/etc/systemd/system/` 后：

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now milanote-api.service
sudo systemctl start milanote-collect.service
sudo systemctl enable --now milanote-collect.timer
sudo journalctl -u milanote-collect.service
```

每天北京时间 09:00：将 Timer 的 `OnCalendar` 改为 `*-*-* 01:00:00 UTC`。每周 Monday 北京时间 09:00 使用 `Mon *-*-* 01:00:00 UTC`。修改后 reload 并 restart timer。

选择 cron 时使用 `templates/linux/crontab.example`，不要同时启用 Timer。默认 `* * * * *` 每 60 秒；每天一次用 `0 1 * * *`，每周 Monday 用 `0 1 * * MON`。统一 UTC；系统 cron 不支持 `CRON_TZ` 时需把服务器时区设为 UTC。运行 `pnpm --filter @milanote-api/self-hosted schedule` 根据配置输出 cron 行，供安装到自己的 crontab。修改配置中的 cron 不会自动修改系统调度。

同一个任务通过独占锁文件防止跨进程重叠，不同任务可独立执行。异常退出可能留下锁；查看锁文件中的 PID，确认进程已经停止后再删除对应 `.lock`。不要在任务运行时删锁。

## SQLite、快照与访问控制

将 `storage.enabled` 改为 `true`，设置长随机环境变量 `SNAPSHOT_TOKEN`。默认关闭时不打开、不创建数据库。开启后默认文件在配置目录的 `data/snapshots.sqlite`；SQLite 使用 WAL 和事务，只有成功且完整的结果才能替换同任务的最新快照。失败和不完整采集保留旧快照，最多保留最近 100 条脱敏执行摘要。

```sh
curl -H "Authorization: Bearer $SNAPSHOT_TOKEN" \
  http://127.0.0.1:8787/api/snapshots/daily-board
```

该接口仅开启 SQLite 后可用，没有有效 Token 返回 401；没有快照返回 404。实时解析接口不使用这个 Token 做认证，默认本机监听；如需对外服务，在自己的反向代理增加 TLS、认证和访问策略。快照接口不开放跨域读取，避免浏览器跨站获取存储数据。

分享数据会保存在你自己的数据库中。保护数据目录及备份的文件权限。备份时使用 SQLite 的 `.backup` 命令（在线备份）或先停止采集和 API，再复制数据库及存在的 `-wal`、`-shm` 文件，不要只复制正在写入的主文件。可用 `sqlite3 /path/snapshots.sqlite '.backup /path/backup.sqlite'` 备份。

清理单个快照使用参数化 SQL 工具或可信任务 ID 执行 `DELETE FROM snapshots WHERE job_id = 'daily-board';`；清理执行摘要使用 `DELETE FROM runs;`。关闭所有访问进程后删除整个数据库及 WAL/SHM 文件可彻底清理数据，重新启用将创建空库。

## Webhook、停止与排错

推送包含 `runId`、`jobId`、`capturedAt`、`result`，头 `X-Run-Id` 供接收端去重。失败最多重试两次，存储和推送分别记录结果。不完整结果可以推送，但不会覆盖快照。失败时进程返回非零码，日志不含分享链接、响应数据和凭据。`status` 只表示解析结果，需同时检查两个输出状态，详见[采集结果与 Webhook](./deployment#采集结果与-webhook)。

- 停止自动采集：`sudo systemctl disable --now milanote-collect.timer` 或删除对应 cron 行。
- 停止 API：`sudo systemctl stop milanote-api.service`。停止采集不自动停止 API。
- 配置失败：检查任务 ID、环境变量、输出选择、配置路径及数据目录权限。
- 任务被锁：确认是否仍在执行或存在异常退出后的遗留锁。
- 读取失败/不完整：在调试台检查 API 错误和 `meta.warnings`，原快照保留。
- 推送失败：根据同一个运行 ID 在接收端排查地址、认证或超时；其他输出仍独立执行。
- 数据库失败：检查磁盘、权限和并发访问；事务失败不会留下半个快照。
