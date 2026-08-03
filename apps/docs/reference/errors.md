# HTTP 错误码

失败响应使用同一结构，并带有 `Cache-Control: no-store`：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_SHARE_URL",
    "message": "The share URL is not a valid Milanote public board link."
  }
}
```

字段选择器报错时，`error` 还可能包含 `field: "include"` 或 `field: "exclude"`。这个字段是可选的，其他错误通常不会返回它。

| HTTP  | code                     | 含义                                                                   |
| ----- | ------------------------ | ---------------------------------------------------------------------- |
| `400` | `INVALID_REQUEST`        | 查询参数缺失、重复、过长、包含未知参数，或筛选参数组合冲突             |
| `400` | `INVALID_SHARE_URL`      | URL 不是合法的 Milanote 公开分享链接                                   |
| `400` | `INVALID_FIELD_SELECTOR` | `include`/`exclude` 为空、语法错误、未知、过多、过深，或请求了敏感字段 |
| `404` | `BOARD_NOT_FOUND`        | 上游确认画板不存在                                                     |
| `404` | `NOT_FOUND`              | API 路由不存在                                                         |
| `405` | `METHOD_NOT_ALLOWED`     | 端点不支持该 HTTP 方法                                                 |
| `502` | `UPSTREAM_ERROR`         | Milanote 暂时不可达、拒绝访问，或返回的数据无法解析                    |
| `500` | `INTERNAL_ERROR`         | 未预期的服务端错误                                                     |

例如，选择了未知字段：

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

`include + exclude`、`view + include` 等冲突属于 `INVALID_REQUEST`，不是字段选择器错误。为避免泄露信息，错误响应不会回显输入链接、permission ID、token 或上游详情。
