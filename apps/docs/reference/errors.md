# HTTP 错误码

所有失败响应都使用相同结构，并设置 `Cache-Control: no-store`：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_SHARE_URL",
    "message": "The share URL is not a valid Milanote public board link."
  }
}
```

字段选择器错误可以额外包含 `"field": "include"` 或 `"field": "exclude"`。`field`
在公共错误 schema 中是可选字段，其他错误不会依赖它。

| HTTP  | code                     | 含义                                                               |
| ----- | ------------------------ | ------------------------------------------------------------------ |
| `400` | `INVALID_REQUEST`        | 查询参数缺失、重复、过长、存在未知参数，或筛选参数组合冲突         |
| `400` | `INVALID_SHARE_URL`      | URL 不是合法 Milanote 公开分享链接                                 |
| `400` | `INVALID_FIELD_SELECTOR` | `include`/`exclude` 为空、语法非法、未知、过多、过深或请求敏感字段 |
| `404` | `BOARD_NOT_FOUND`        | 上游确认画板不存在                                                 |
| `404` | `NOT_FOUND`              | API 路由不存在                                                     |
| `405` | `METHOD_NOT_ALLOWED`     | 端点不支持该 HTTP 方法                                             |
| `502` | `UPSTREAM_ERROR`         | Milanote 不可达、拒绝访问或返回无法解析的数据                      |
| `500` | `INTERNAL_ERROR`         | 未知内部失败                                                       |

例如未知字段：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_FIELD_SELECTOR",
    "message": "Unknown field selector: board.password",
    "field": "exclude"
  }
}
```

`include + exclude`、`view + include` 等组合冲突属于 `INVALID_REQUEST`，而不是选择器错误。
服务端不会在错误中回显输入链接、permission ID、token 或上游详情。`HEAD` 错误响应保留状态与
响应头，但 body 为空。
