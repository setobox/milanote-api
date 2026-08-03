# 快速开始

## 环境要求

- Node.js 22.18 或更高版本
- pnpm 11

应用运行时不需要 Milanote 环境变量。每次请求都由调用方提供分享链接。

## 本地启动

```bash
pnpm install
pnpm run dev
```

文档位于 `/`，Playground 位于 `/playground`。`pnpm run dev` 会先构建文档，再启动同时提供 Worker API 和 Playground 的开发服务器。

只改文档时，可以使用 `pnpm run docs:dev` 或 `pnpm run docs:preview`。这两个命令只启动 VitePress，不提供 `/playground` 或 Worker API。

## 获取精简数据

`/api/search` 默认使用 `compact` 视图，适合列表、索引和搜索结果。把完整分享链接放进唯一的 `url` 参数，并交给 `URLSearchParams` 编码：

```ts
const shareUrl = "https://app.milanote.com/board-id/shared-view?p=permission-id";
const query = new URLSearchParams({ url: shareUrl });
const response = await fetch(`/api/search?${query}`);
const payload = await response.json();
```

成功响应的外层结构固定，字段筛选只影响 `data`：

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

这类精简数据不包含完整 `MilanoteDocument` 的全部字段。

## 获取完整画板

如果要使用完整 Zod 模型，或绘制 Canvas，改用 `/api/detail`：

```ts
const query = new URLSearchParams({ url: shareUrl });
const response = await fetch(`/api/detail?${query}`);
const payload = await response.json();
```

`/api/detail` 默认返回 `full` 数据。没有使用 `exclude` 时，成功响应里的 `data` 可以交给 `milanoteDocumentSchema` 验证。两个端点都支持[字段选择器](/reference/field-selectors)。

从旧版 `/api/search` 升级的项目，请先阅读 [HTTP API 中的迁移说明](/reference/http-api#http-api)。分享链接和权限参数的处理注意事项见[安全与缓存](/guide/security)。

## 验证项目

```bash
pnpm run ready
```

这个命令会依次运行格式检查、lint、类型检查、测试、各 workspace 构建和站点产物验证。
