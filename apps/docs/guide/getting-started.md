# 快速开始

## 环境要求

- Node.js 22.18 或更高版本
- pnpm 11

项目运行时不需要 Milanote 环境变量。分享链接由调用方按请求提供。

## 本地启动

```bash
pnpm install
pnpm run dev
```

根站文档位于 `/`，Playground 位于 `/playground`。开发命令会先构建文档，再启动包含 Worker API 的 Vite 开发服务器。

## 发起请求

将完整分享链接作为唯一的 `url` 查询参数。客户端应使用 `URLSearchParams` 编码：

```ts
const shareUrl = "https://app.milanote.com/board-id/shared-view?p=permission-id";
const query = new URLSearchParams({ url: shareUrl });
const response = await fetch(`/api/search?${query}`);
const payload = await response.json();
```

成功响应：

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": {
      "provider": "milanote",
      "boardId": "board-id"
    },
    "fetchedAt": "2026-07-24T00:00:00.000Z",
    "board": {
      "id": "board-id",
      "type": "BOARD",
      "title": "Example",
      "location": {},
      "timestamps": {},
      "defaultColorPalette": [],
      "children": []
    }
  }
}
```

响应不会包含 permission ID 或 Milanote 短期 token。

## 验证项目

```bash
pnpm run ready
```

该命令依次运行格式、lint、类型检查、测试、所有 workspace 构建和最终站点产物验证。
