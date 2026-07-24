# 安全与缓存

## 只处理有权访问的公开画板

本项目没有认证、授权、限流或租户隔离。调用方必须确保用户有权解析并重新分发目标画板内容。

::: danger 分享链接会经过基础设施
`GET /api/search` 把完整分享链接放在查询参数中。直接在浏览器打开时，它会进入浏览器历史；它也会成为 CDN 缓存键的一部分，并可能记录在 Cloudflare、反向代理或其他平台的访问日志中。只应解析用户有权公开访问的画板。
:::

Playground 不会把输入写入自身页面地址、`localStorage` 或最近记录，但无法阻止网络层记录请求 URL。

## 响应脱敏

成功响应仅保留非敏感 `source.boardId`。以下内容不会进入成功或错误 body：

- permission ID
- Milanote 短期 token
- 完整输入链接
- 上游原始错误消息

## 缓存策略

成功响应：

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: W/"…"
```

客户端可在 60 秒内直接复用；随后 300 秒内可以返回旧结果并后台重新验证。失败响应统一为：

```http
Cache-Control: no-store
```

由于请求查询参数包含 permission ID，部署者应确认 CDN 和日志的访问控制、保留期与脱敏策略符合自身要求。

## CORS

API 返回 `Access-Control-Allow-Origin: *`，适合公开只读数据。若画板内容需要访问控制，应在 Worker 前增加认证，并同步收紧 CORS 与缓存策略。
