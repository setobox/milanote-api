# Milanote API

将 Milanote 公开共享画板转换为经过 Zod 验证的 `MilanoteDocument` v1。项目以单一 Cloudflare Worker 部署：

- `/`：VitePress 中文文档
- `/playground`：React + shadcn/ui 交互控制台
- `/api/search?url=...`：公开只读 JSON API

> Milanote 的上游接口未公开，响应可能变化。只应解析用户有权公开访问的画板。

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

应用运行时不需要环境变量。Cloudflare 自动部署仍需要
`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 文档

完整的快速开始、HTTP API、Zod 模型、Parser SDK、安全缓存和部署说明位于
[`apps/docs`](./apps/docs/index.md)，部署后由站点根路径提供。
