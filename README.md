# Milanote JSON API

将一个已发布的 Milanote 画板转换为稳定、易渲染的 JSON，并提供一个可直接查看结果的 playground。分享链接始终只在服务端使用，浏览器只请求本项目的同源 API。

> Milanote 的 `/api/boards` 是内部接口，响应可能变化。使用前请确认画板可以通过公开分享链接访问。

## 快速开始

需要 Node.js 22.18 或更高版本。

在项目根目录安装依赖并创建本地密钥文件：

```bash
pnpm install
```

复制粘贴 `apps/playground/.dev.vars.example`并改名 `apps/playground/.dev.vars`

在 `apps/playground/.dev.vars` 填入完整的 Milanote 分享链接：

```dotenv
MILANOTE_SHARE_URL=https://app.milanote.com/...
```

启动页面和 API：

```bash
pnpm run dev
```

打开终端输出的本地地址，即可在 playground 中查看画板；也可以直接请求 `/api/board` 获取 JSON。

## API

### `GET /api/board`

读取配置的画板并返回规范化结果。接口不接受 URL、board ID 或 permission ID 参数，因此始终只会读取服务端配置的一个画板。

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

### `GET /api/health`

返回服务状态及生产环境是否配置了分享链接，不会返回 Secret 的值。

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

首次部署前，先在 Cloudflare Worker 中创建加密 Secret `MILANOTE_SHARE_URL`。可以在 Cloudflare Dashboard 中设置，或在本机从 secrets file 部署：

```bash
cd apps/playground
pnpm run build
pnpm exec wrangler deploy --secrets-file .dev.vars
```

后续部署：

```bash
pnpm run deploy
```

自动部署需要在 GitHub 仓库配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。建议将 `MILANOTE_SHARE_URL` 仅保存于 Cloudflare，不要提交、公开，或放进前端 `VITE_` 环境变量。

## 使用限制

- 配置的画板内容会通过公开 API 返回；需要保护画板时，请在 Worker 前增加访问控制。
- 本地 `.dev.vars` 仅用于开发，已被忽略，不应提交到仓库。
- 上游接口变化时，请先更新解析器及其测试，再更新依赖该 JSON 的渲染代码。
