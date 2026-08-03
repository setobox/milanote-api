# 安全与缓存

## 只读取有权访问的画板

项目不提供认证、授权、限流或租户隔离。调用方需要确认自己有权读取和重新分发目标画板的内容。

::: danger 分享链接会经过基础设施
`GET /api/search` 和 `GET /api/detail` 会把完整分享链接放在查询参数中。直接在浏览器打开链接，或从 Playground 复制完整 API URL 后，权限参数可能进入浏览器历史、CDN 缓存键，以及 Cloudflare、反向代理或其他平台的访问日志。
:::

Playground 不会把输入写到自身页面地址、`localStorage` 或最近记录，但无法阻止剪贴板、浏览器网络面板和网络层记录完整请求 URL。

## 服务端会移除敏感字段

`exclude` 用来裁剪响应，不能用来保护敏感信息。服务端会先把上游数据整理成 `MilanoteDocument`，删除敏感键，再应用 `view`、`include` 或 `exclude`：

```text
上游数据
  → 规范化为 MilanoteDocument
  → 移除敏感字段
  → 应用字段筛选
  → 返回响应
```

无论选择什么字段，下面这些键都会在任意层级被移除，且键名不区分大小写：

- `internalId`
- `accessToken`
- `userId`
- `privateMetadata`
- permission / permission ID
- token

服务端也会检查 `UNKNOWN.content` 等通用 JSON 内容。请求 `include=**.accessToken` 会得到 `400 INVALID_FIELD_SELECTOR`，不能借此取回已过滤的内容。

成功和错误响应都不会包含 permission ID、Milanote 短期 token、完整输入链接或上游原始错误信息。

## 裁剪后的数据

字段筛选在移除敏感字段之后执行。`compact`、`standard`，以及任何使用 `include` 或 `exclude` 的结果，都可能缺少完整模型所需字段。把它们当作与你的筛选条件对应的 JSON；如果需要类型验证，请为自己的投影定义 schema。

## 缓存

成功响应：

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: W/"…"
```

客户端可以在 60 秒内直接复用缓存；之后的 300 秒内，缓存可以先返回旧结果，再在后台更新。ETag 根据实际返回的数据生成，应与发出它的完整请求一起保存，不能用于不同查询条件。

失败响应统一使用：

```http
Cache-Control: no-store
```

请求参数包含 permission ID。部署前请确认 CDN 和日志的访问控制、保存时间和脱敏策略符合你的要求。

## CORS

API 返回 `Access-Control-Allow-Origin: *`，适合公开只读数据。如果画板内容需要访问控制，应在 Worker 前增加认证，同时收紧 CORS 和缓存策略。
