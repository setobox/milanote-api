# HTTP API

两个只读端点都解析 Milanote 公开分享链接，并使用相同的成功和错误响应格式。区别在于默认返回的数据：

| 端点              | 默认视图  | 适合什么场景                               |
| ----------------- | --------- | ------------------------------------------ |
| `GET /api/search` | `compact` | 列表、索引、搜索结果和低带宽读取           |
| `GET /api/detail` | `full`    | 完整 `MilanoteDocument`、Canvas 和数据归档 |

::: warning 从旧版 `/api/search` 升级
旧版 `/api/search` 默认返回完整画板。现在完整响应改由 `/api/detail` 提供，`/api/search` 默认只返回精简数据。如果现有调用方会读取 `fetchedAt`、完整节点内容、媒体、表格或评论，请改用 `/api/detail`。
:::

字段筛选后的 `data` 不一定符合完整 `MilanoteDocument`。下文将它称为“裁剪后的数据”（partial DTO）；选择规则见[字段选择器](/reference/field-selectors)。

## 查询参数

| 参数      | 约束                                                   |
| --------- | ------------------------------------------------------ |
| `url`     | 必须且只能出现一次；去除首尾空白后为 1–2048 个字符     |
| `view`    | 可选且最多一次；取值为 `compact`、`standard` 或 `full` |
| `include` | 可选且最多一次；逗号分隔的保留字段                     |
| `exclude` | 可选且最多一次；逗号分隔的排除字段                     |

`url` 必须是 `https:` 的 `app.milanote.com` 分享链接，并带有合法的 board ID 和 `p` permission ID。除此之外不能传其他查询参数。

可以使用的组合是：不传筛选参数、`include`、`exclude`、`view`，或 `view + exclude`。`include + exclude` 和 `view + include` 会返回 `400 INVALID_REQUEST`。

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

状态码为 `200`，字段筛选只作用于 `data`：

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

只有未裁剪的 `full` 数据可以按 `milanoteDocumentSchema` 验证。`compact`、`standard`，以及使用 `include` 或 `exclude` 的结果，都应该按实际选择的字段处理。

## 方法和 CORS

- `GET`：返回 JSON 数据。
- `HEAD`：返回与 GET 相同的状态和响应头，不返回 body。
- `OPTIONS`：返回 CORS 预检响应。
- 其他方法：返回 `405 METHOD_NOT_ALLOWED`，并包含 `Allow`。
- API 允许跨域只读访问，并暴露 `ETag` 响应头。

两个端点的方法、CORS、错误和缓存行为相同。未知的 `/api/*` 路由返回 `404 NOT_FOUND`。

## 条件请求

成功响应带有弱 `ETag`，它根据实际返回的数据生成。发送相同请求，并在 `If-None-Match` 中带上匹配的 ETag 时，服务会返回 `304`：

```bash
curl -H 'If-None-Match: W/"…"' \
  'https://your-worker.example/api/detail?url=…&view=standard'
```

端点默认视图、画板内容和字段选择都会影响 ETag。请把 ETag 和生成它的完整请求一起保存，不要跨查询条件复用。成功响应使用 `public, max-age=60, stale-while-revalidate=300`；失败响应使用 `no-store`。缓存和权限参数的风险见[安全与缓存](/guide/security)。
