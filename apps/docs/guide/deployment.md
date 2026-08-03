# Cloudflare 部署

项目会构建为一个 Cloudflare Worker 部署：

| 路径          | 内容                                 |
| ------------- | ------------------------------------ |
| `/`           | VitePress 文档                       |
| `/playground` | React Playground                     |
| `/api/search` | 默认返回 `compact` 数据的 Worker API |
| `/api/detail` | 默认返回 `full` 数据的 Worker API    |

## 构建

```bash
pnpm run build
```

Playground 的 `site:build` 任务依赖 `@milanote-api/docs#build`。构建时，Vite 会把 `apps/docs/.vitepress/dist` 复制到 `apps/playground/dist/client`，并在同一目录生成 `playground/index.html` 和 `playground/assets/*`。

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

- `run_worker_first` 让所有 `/api/*` 请求先进入 Worker，不会被同名静态文件截获。
- `404-page` 使用 VitePress 生成的 `404.html`。
- `drop-trailing-slash` 会把 `/playground/` 等地址规范化为无尾斜杠，同时仍可从目录中的 `index.html` 提供内容。

可参考 Cloudflare 的 [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) 和 [Static Assets](https://developers.cloudflare.com/workers/static-assets/) 文档。

## 部署命令

```bash
pnpm run deploy
```

应用运行时不需要环境变量。CI 部署需要 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 本地服务

```bash
pnpm run dev
```

这个命令同时提供文档、`/playground` 和两个 API 端点。`pnpm run docs:dev` 与 `pnpm run docs:preview` 只运行 VitePress；在它们启动的服务中访问 `/playground` 会得到文档 404。

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

`pnpm run verify:site` 会检查文档首页、404、字段选择器页、Playground 入口和内部链接，并确认指向 `/playground`、`/api/search`、`/api/detail` 的链接使用整页导航。
