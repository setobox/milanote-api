# 快速开始

## 环境要求

- Node.js 22.18 或更高版本
- pnpm 11

项目运行时不需要 Milanote 环境变量。分享链接由调用方随每个请求提供。

## 本地启动

```bash
pnpm install
pnpm run dev
```

根站文档位于 `/`，Playground 位于 `/playground`。`pnpm run dev` 会先构建文档，再启动包含
Worker API 与 Playground 的 Vite 开发服务器。

::: info 只开发文档
`pnpm run docs:dev` 和 `pnpm run docs:preview` 只提供 VitePress 文档，
不会提供 `/playground` 或 Worker API；在这些服务中访问 `/playground` 会得到文档 404。
:::

## 获取精简响应

`/api/search` 默认使用 `compact` 视图，适合列表、索引和搜索结果。将完整分享链接作为
唯一的 `url` 参数，并使用 `URLSearchParams` 编码：

```ts
const shareUrl = "https://app.milanote.com/board-id/shared-view?p=permission-id";
const query = new URLSearchParams({ url: shareUrl });
const response = await fetch(`/api/search?${query}`);
const payload = await response.json();
```

成功响应保留统一外层结构，筛选只发生在 `data` 内：

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": {
      "provider": "milanote",
      "boardId": "board-id"
    },
    "board": {
      "id": "board-id",
      "type": "BOARD",
      "title": "Example",
      "children": []
    }
  }
}
```

精简 `data` 是 partial DTO，不是完整 `MilanoteDocument`。

## 获取完整文档

需要完整 Zod 模型或 Canvas 所需字段时，改用 `/api/detail`：

```ts
const query = new URLSearchParams({ url: shareUrl });
const response = await fetch(`/api/detail?${query}`);
const payload = await response.json();
```

`/api/detail` 默认 `full`；未附加 `exclude` 时，成功响应的 `data` 可以交给
`milanoteDocumentSchema` 验证。两个端点都支持[预设、白名单与黑名单筛选](/reference/field-selectors)。

::: warning 从旧版迁移
旧版 `/api/search` 的完整响应行为已迁移到 `/api/detail`。如果现有调用方读取
`fetchedAt`、完整节点内容、媒体、表格或评论，应先切换到 `/api/detail`，再部署新版本。
:::

响应不会包含 permission ID、Milanote 短期 token 或完整输入链接。

## 验证项目

```bash
pnpm run ready
```

该命令依次运行格式、lint、类型检查、测试、所有 workspace 构建和最终站点产物验证。
