# Milanote API

将 Milanote 公开共享画板整理为结构化 JSON。实时 API 不缓存用户数据。

```ts
const response = await fetch("https://YOUR_API_HOST/api/boards/parse", {
  method: "POST",
  cache: "no-store",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "https://app.milanote.com/your-board/shared-view?p=your-permission",
    scope: "root",
  }),
});
const result = await response.json();
```

默认只读取根画板。需要嵌套内容时使用 `scope: "tree"`。字段精简只控制返回内容，不减少同一 scope 的上游读取。

需要 Node.js 22.18+、pnpm 11。使用 `pnpm install` 安装、`pnpm run ready` 检查。完整说明见 [快速开始](apps/docs/guide/getting-started.md) 与 [HTTP API](apps/docs/reference/http-api.md)。

官方静态文档和调试台由 GitHub Pages 托管；独立 Cloudflare Worker 提供无状态 API。自部署扩展与官方服务的数据边界见 [部署说明](apps/docs/guide/deployment.md)。
