# Cloudflare 部署

项目输出一个 Cloudflare Worker 部署：

| 路径          | 内容                       |
| ------------- | -------------------------- |
| `/`           | VitePress 文档             |
| `/playground` | React Playground           |
| `/api/search` | 默认 compact 的 Worker API |
| `/api/detail` | 默认 full 的 Worker API    |

旧版 `/api/search` 的完整响应行为已迁移到 `/api/detail`。由于 `run_worker_first`
覆盖 `/api/*`，两个端点不需要额外静态路由配置。

## 构建

```bash
pnpm run build
```

Playground 的 Vite Plus `site:build` 任务依赖 `@milanote-api/docs#build`。Vite 随后把 `apps/docs/.vitepress/dist` 作为根站静态内容复制到 `apps/playground/dist/client`，并在同一目录生成 `playground/index.html` 和 `playground/assets/*`。

## Wrangler 路由

关键配置：

```json
{
  "assets": {
    "run_worker_first": ["/api/*"],
    "not_found_handling": "404-page",
    "html_handling": "drop-trailing-slash"
  }
}
```

- `run_worker_first` 确保所有 `/api/*` 请求先进入 Worker，不会被同名静态文件截获。
- `404-page` 使用 VitePress 生成的 `404.html`。
- `drop-trailing-slash` 将 `/playground/` 等地址规范化为无尾斜杠形式，同时仍能从目录 `index.html` 提供内容。

参考 Cloudflare 官方的 [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) 与 [Static Assets](https://developers.cloudflare.com/workers/static-assets/) 文档。

## 部署命令

```bash
pnpm run deploy
```

应用运行时不需要环境变量。CI 仍需要 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 作为部署凭据。

## 本地服务边界

```bash
pnpm run dev
```

此命令提供根文档、`/playground` 与两个 API 端点。相比之下，`pnpm run docs:dev` 和
`pnpm run docs:preview` 只运行 VitePress；它们不会把 Playground 产物复制进文档服务，
所以在对应端口访问 `/playground` 会正确得到文档 404。

## 产物检查

```text
apps/playground/dist/client/
├─ index.html
├─ 404.html
├─ assets/
├─ reference/
│  └─ field-selectors.html
└─ playground/
   ├─ index.html
   └─ assets/
```

`pnpm run verify:site` 会检查文档首页、404、字段选择器页、Playground 入口、内部链接，以及
指向 `/playground`、`/api/search`、`/api/detail` 的链接是否使用整页导航。
