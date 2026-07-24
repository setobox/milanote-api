# Cloudflare 部署

项目输出一个 Cloudflare Worker 部署：

| 路径          | 内容             |
| ------------- | ---------------- |
| `/`           | VitePress 文档   |
| `/playground` | React Playground |
| `/api/search` | Worker API       |

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

## 产物检查

```text
apps/playground/dist/client/
├─ index.html
├─ 404.html
├─ assets/
└─ playground/
   ├─ index.html
   └─ assets/
```
