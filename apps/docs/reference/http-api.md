# `GET /api/search`

解析一个 Milanote 公开分享链接，并返回 `MilanoteDocument` v1。

## 查询参数

| 参数   | 约束                                             |
| ------ | ------------------------------------------------ |
| `url`  | 必须且只能出现一次                               |
| 长度   | 去除首尾空白后为 1–2048 个字符                   |
| 协议   | `https:`                                         |
| 主机   | `app.milanote.com`                               |
| 标识符 | board ID 与 `p` permission ID 必须存在且格式合法 |

不允许任何额外查询参数。非法查询结构返回 `INVALID_REQUEST`，格式非法的分享链接返回 `INVALID_SHARE_URL`。

```bash
curl --get \
  --data-urlencode "url=https://app.milanote.com/board-id/shared-view?p=permission-id" \
  https://your-worker.example/api/search
```

## 成功响应

状态码 `200`：

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
    "board": {}
  }
}
```

实际的 `board` 必须通过 `milanoteBoardNodeSchema`，示例为简洁省略了节点字段。

## 方法与 CORS

- `GET`：返回 JSON 数据。
- `HEAD`：返回与 GET 一致的状态和响应头，不返回 body。
- `OPTIONS`：返回 CORS 预检响应。
- 其他方法返回 `405 METHOD_NOT_ALLOWED`，并包含 `Allow`。
- API 允许跨域只读访问，并暴露 `ETag` 响应头。

## 条件请求

成功响应带有弱 `ETag`。发送 `If-None-Match` 且实体未变化时返回 `304`：

```bash
curl -H 'If-None-Match: W/"…"' \
  'https://your-worker.example/api/search?url=…'
```

ETag 不包含 `fetchedAt`，同一画板内容未变化时可稳定命中。
