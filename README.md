# Milanote JSON API

将一个已发布的 Milanote 画板转换为稳定、易渲染的 JSON，并提供一个可直接查看结果的 playground。

> Milanote 的 `/api/boards` 是内部接口，响应可能变化。使用前请确认画板可以通过公开分享链接访问。

## 快速开始

需要 Node.js 22.18 或更高版本。

在项目根目录安装依赖：

```bash
pnpm install
```

启动页面和 API：

```bash
pnpm run dev
```

打开终端输出的 `/playground`，输入分享链接即可查看画板；也可以直接请求 `/api/search?url=...` 获取 JSON。

## API

### `GET /api/search?url=<encoded-share-url>`

读取指定的公开共享画板并返回规范化结果。`url` 必须是经过 URL 编码的完整 Milanote HTTPS 分享链接。

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": {
      "provider": "milanote",
      "boardId": "board_demo"
    },
    "fetchedAt": "2026-07-22T00:00:00.000Z",
    "board": {
      "id": "board_demo",
      "type": "BOARD",
      "title": "Example board",
      "location": {},
      "timestamps": {},
      "defaultColorPalette": [],
      "children": []
    }
  }
}
```

节点通过大写 `type` 区分，包含 `BOARD`、`COLUMN`、`CARD`、`IMAGE`、`FILE`、`LINK`、`TASK_LIST`、`TASK`、`TABLE`、`COMMENT_THREAD`、`SKELETON` 和 `UNKNOWN`。富文本提供结构化 `blocks` 与可直接显示的 `plainText`。

接口支持 `ETag`、条件请求和公开只读缓存。读取失败时返回固定格式，且不会泄露分享链接、权限 ID、短期 token 或上游错误详情：

```json
{
  "ok": false,
  "error": {
    "code": "UPSTREAM_ERROR",
    "message": "The board source could not be read right now."
  }
}
```

## 验证

执行完整的检查、测试和构建：

```bash
pnpm run ready
```

也可以分别执行：

```bash
pnpm check
pnpm run test
pnpm run build
```

测试不读取真实分享链接，也不会请求 Milanote。

## 部署

部署到 Cloudflare：

```bash
pnpm run deploy
```

自动部署需要在 GitHub 仓库配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 使用限制

- GET 查询参数可能进入浏览器历史、CDN 缓存键和平台访问日志，只应解析有权公开访问的画板。
- 上游接口变化时，请先更新解析器及其测试，再更新依赖该 JSON 的渲染代码。
