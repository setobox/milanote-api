# 错误与排查

错误格式：`{ ok: false, error: { code, message, stage } }`。

| HTTP | code                                                | 下一步                                |
| ---- | --------------------------------------------------- | ------------------------------------- |
| 400  | INVALID_REQUEST                                     | 检查 JSON、分享链接、scope 和参数组合 |
| 400  | INVALID_FIELD_SELECTOR                              | 检查字段路径和通配符                  |
| 403  | UPSTREAM_ACCESS_DENIED                              | 确认分享已开启且具备访问权限          |
| 404  | BOARD_NOT_FOUND                                     | 确认画板仍存在                        |
| 404  | NOT_FOUND                                           | 检查 API 路径                         |
| 405  | METHOD_NOT_ALLOWED                                  | 解析接口使用 POST                     |
| 413  | PAYLOAD_TOO_LARGE                                   | 请求体不能超过 32 KiB                 |
| 415  | UNSUPPORTED_MEDIA_TYPE                              | 设置 Content-Type: application/json   |
| 502  | UPSTREAM_REQUEST_FAILED / INVALID_UPSTREAM_RESPONSE | 稍后重试；检查上游是否变化            |
| 504  | UPSTREAM_TIMEOUT                                    | 改用 root 或减少递归读取需求          |
| 500  | INTERNAL_ERROR                                      | 使用请求 ID 和脱敏日志定位            |

stage 区分 request、permission、boards、parse。服务端不会返回输入分享链接、短期令牌或上游原始错误正文。

tree 部分失败时可能仍然返回 200，但 meta.complete=false。检查 warnings，不要将缺失子画板当作空内容。官方接口不提供旧快照回退。

请求耗时可在 Server-Timing 和 meta.timings 中查看。权限与画板阶段慢需要检查上游；字段精简不会缩短这些阶段。
