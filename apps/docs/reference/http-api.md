# HTTP API

两个只读端点都解析 Milanote 公开分享链接，并返回统一的成功或错误契约。它们只在默认字段视图上
不同：

| 端点              | 默认视图  | 用途                                       |
| ----------------- | --------- | ------------------------------------------ |
| `GET /api/search` | `compact` | 列表、索引、搜索结果和低带宽读取           |
| `GET /api/detail` | `full`    | 完整 `MilanoteDocument`、Canvas 与数据归档 |

::: warning 破坏性变更
旧版 `/api/search` 的完整响应行为已迁移到 `/api/detail`。`/api/search` 仍保留同一路径，
但默认结果现在是 partial DTO。
:::

## 查询参数

| 参数      | 约束                                               |
| --------- | -------------------------------------------------- |
| `url`     | 必须且只能出现一次；去除首尾空白后为 1–2048 个字符 |
| `view`    | 可选且最多一次；`compact`、`standard` 或 `full`    |
| `include` | 可选且最多一次；逗号分隔的白名单选择器             |
| `exclude` | 可选且最多一次；逗号分隔的黑名单选择器             |

`url` 必须是 `https:` 的 `app.milanote.com` 分享链接，并包含格式合法的 board ID 与
`p` permission ID。除上述四个参数外不允许额外查询参数。

字段参数的合法组合为：无参数、`include`、`exclude`、`view`、`view + exclude`。
`include + exclude` 与 `view + include` 返回 `400 INVALID_REQUEST`。完整语义见
[字段选择器](/reference/field-selectors)。

## 请求示例

精简搜索：

```bash
curl --get \
  --data-urlencode "url=https://app.milanote.com/board-id/shared-view?p=permission-id" \
  https://your-worker.example/api/search
```

完整详情：

```bash
curl --get \
  --data-urlencode "url=https://app.milanote.com/board-id/shared-view?p=permission-id" \
  https://your-worker.example/api/detail
```

标准视图并移除时间戳：

```bash
curl --get \
  --data-urlencode "url=https://app.milanote.com/board-id/shared-view?p=permission-id" \
  --data-urlencode "view=standard" \
  --data-urlencode "exclude=**.timestamps" \
  https://your-worker.example/api/detail
```

## 成功响应

状态码 `200`，投影只作用于 `data`：

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": {
      "provider": "milanote",
      "boardId": "board-id"
    },
    "board": {
      "id": "board-id",
      "type": "BOARD",
      "title": "Example",
      "children": []
    }
  }
}
```

只有未删减的 `full` 数据保证通过 `milanoteDocumentSchema`。`compact`、`standard`、
`include` 与 `exclude` 结果都是通用 JSON 对象，可能缺少完整模型的必填字段。

## 方法与 CORS

- `GET`：返回 JSON 数据。
- `HEAD`：返回与对应 GET 一致的状态和响应头，不返回 body。
- `OPTIONS`：返回 CORS 预检响应。
- 其他方法返回 `405 METHOD_NOT_ALLOWED`，并包含 `Allow`。
- API 允许跨域只读访问，并暴露 `ETag` 响应头。

两个端点拥有相同的方法、CORS、错误与缓存行为。未知 `/api/*` 路由返回统一
`404 NOT_FOUND`。

## 条件请求

成功响应带有基于最终序列化投影生成的弱 `ETag`。发送 `If-None-Match` 且该表示未变化时
返回 `304`：

```bash
curl -H 'If-None-Match: W/"…"' \
  'https://your-worker.example/api/detail?url=…&view=standard'
```

端点默认视图、画板内容和显式字段选择共同决定最终表示；客户端应把 ETag 与发出它的完整请求
一起保存，不要跨查询条件复用。成功响应使用 `public, max-age=60, stale-while-revalidate=300`，
失败响应使用 `no-store`。
