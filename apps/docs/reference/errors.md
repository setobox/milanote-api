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

| HTTP  | code                 | 含义                                          |
| ----- | -------------------- | --------------------------------------------- |
| `400` | `INVALID_REQUEST`    | `url` 缺失、重复、过长、为空或存在额外参数    |
| `400` | `INVALID_SHARE_URL`  | URL 不是合法 Milanote 公开分享链接            |
| `404` | `BOARD_NOT_FOUND`    | 上游确认画板不存在                            |
| `404` | `NOT_FOUND`          | API 路由不存在                                |
| `405` | `METHOD_NOT_ALLOWED` | 端点不支持该 HTTP 方法                        |
| `502` | `UPSTREAM_ERROR`     | Milanote 不可达、拒绝访问或返回无法解析的数据 |
| `500` | `INTERNAL_ERROR`     | 未知内部失败                                  |

服务端不会在错误中回显输入链接或上游详情。`HEAD` 错误响应保留状态与响应头，但 body 为空。
