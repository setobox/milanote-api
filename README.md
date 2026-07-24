# Milanote API

将 Milanote 公开共享画板转换为经过 Zod 验证的 `MilanoteDocument` v1。项目以单一 Cloudflare Worker 部署：

- `/`：VitePress 中文文档
- `/playground`：React + shadcn/ui 交互控制台
- `/api/search?url=...`：默认返回 `compact` 精简视图
- `/api/detail?url=...`：默认返回完整 `MilanoteDocument` v1

> Milanote 的上游接口未公开，响应可能变化。只应解析用户有权公开访问的画板。

## API 快速开始

```ts
const shareUrl = "https://app.milanote.com/board-id/shared-view?p=permission-id";
const query = new URLSearchParams({ url: shareUrl });

const compact = await fetch(`/api/search?${query}`);
const full = await fetch(`/api/detail?${query}`);
```

两个端点都支持 `view`、`include` 与 `exclude` 字段筛选。筛选后的
`data` 是 partial DTO，不保证通过完整的 `milanoteDocumentSchema`。

> **破坏性路由变更：**旧版 `/api/search` 的完整响应行为已迁移到 `/api/detail`。
> 依赖完整文档的调用方应切换路由；继续使用 `/api/search` 会收到精简响应。

## 快速命令

需要 Node.js 22.18+、pnpm 11。

```bash
pnpm install
pnpm run dev
pnpm run ready
pnpm run deploy
```

文档开发与预览：

```bash
pnpm run docs:dev
pnpm run docs:preview
```

`docs:dev` 与 `docs:preview` 只提供文档站；需要同时访问 `/playground` 和 Worker API 时，
请使用 `pnpm run dev`。

应用运行时不需要环境变量。Cloudflare 自动部署仍需要
`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 文档

完整的[快速开始](./apps/docs/guide/getting-started.md)、[HTTP API](./apps/docs/reference/http-api.md)、
[字段选择器](./apps/docs/reference/field-selectors.md)、Zod 模型、Parser SDK、安全缓存和部署说明位于
[`apps/docs`](./apps/docs/index.md)，部署后由站点根路径提供。
