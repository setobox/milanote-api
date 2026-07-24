# 安全与缓存

## 只处理有权访问的公开画板

本项目没有认证、授权、限流或租户隔离。调用方必须确保用户有权解析并重新分发目标画板内容。

::: danger 分享链接会经过基础设施
`GET /api/search` 与 `GET /api/detail` 都把完整分享链接放在查询参数中。直接在浏览器打开或
使用 Playground 复制完整 API URL 时，它可能进入浏览器历史；它也会成为 CDN 缓存键的一部分，
并可能记录在 Cloudflare、反向代理或其他平台的访问日志中。只应解析用户有权公开访问的画板。
:::

Playground 不会把输入写入自身页面地址、`localStorage` 或最近记录，但无法阻止剪贴板、浏览器
网络面板和网络层记录完整请求 URL。

## 永久安全过滤

`exclude` 是用户控制的响应裁剪，不是敏感字段保护机制。服务端在用户投影之前，递归移除
任意深度的敏感键，包括：

- `internalId`
- `accessToken`
- `userId`
- `privateMetadata`
- permission / permission ID
- token

键名比较不区分大小写，并且会深入 `UNKNOWN.content` 等通用 JSON 内容。处理顺序固定为：

```text
上游数据
  → 规范化 MilanoteDocument
  → 永久敏感字段过滤
  → view / include / exclude
  → 最终响应
```

因此 `include=**.accessToken` 不能绕过保护，而会返回
`400 INVALID_FIELD_SELECTOR`。成功响应只保留非敏感的 `source.boardId`；以下内容不会进入
成功或错误 body：

- permission ID
- Milanote 短期 token
- 完整输入链接
- 上游原始错误消息

## Partial DTO

字段筛选发生在安全过滤之后。`compact`、`standard`、`include` 或 `exclude` 响应可以缺少
完整 Zod 模型的必填字段，因此不能默认视为 `MilanoteDocument`。客户端应使用与自身投影匹配的
schema，或只把它当成经过 JSON 边界验证的对象。

## 缓存策略

成功响应：

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: W/"…"
```

客户端可在 60 秒内直接复用；随后 300 秒内可以返回旧结果并后台重新验证。ETag 从最终序列化
投影生成；应与发出它的完整请求一起保存，不能跨查询条件复用。失败响应统一为：

```http
Cache-Control: no-store
```

由于请求查询参数包含 permission ID，部署者应确认 CDN 和日志的访问控制、保留期与脱敏策略
符合自身要求。

## CORS

API 返回 `Access-Control-Allow-Origin: *`，适合公开只读数据。若画板内容需要访问控制，应在
Worker 前增加认证，并同步收紧 CORS 与缓存策略。
