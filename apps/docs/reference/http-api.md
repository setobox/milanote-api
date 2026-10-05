# HTTP API

## 解析画板

`POST /api/boards/parse`，请求体为 JSON，最大 32 KiB。

| 字段    | 默认值 | 说明                                  |
| ------- | ------ | ------------------------------------- |
| url     | 必填   | 1–2048 字符的 Milanote HTTPS 分享链接 |
| scope   | root   | root 只读当前画板；tree 递归子画板    |
| view    | full   | full、standard、compact               |
| include | 无     | 要保留的字段路径数组，1–100 项        |
| exclude | 无     | 要排除的字段路径数组，1–100 项        |

不接受未知字段。`include` 不能与 `view` 或 `exclude` 同时出现。`scope` 独立于字段选择：精简响应不等于减少上游抓取。

所有参数从 POST JSON 读取。调试台地址中的查询参数仅方便查看当前配置，不替代请求体，也不会覆盖请求体。实时接口默认不要求 Bearer Token；接入方可在自部署代理增加认证，见[跨域连接与认证](../guide/deployment#跨域连接与认证)。

<!-- api-example -->

```json
{
  "url": "https://app.milanote.com/your-board/shared-view?p=your-permission",
  "scope": "root",
  "view": "full"
}
```

```bash
curl https://YOUR_API_HOST/api/boards/parse \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://app.milanote.com/your-board/shared-view?p=your-permission","scope":"root"}'
```

## 响应与完整性

成功返回 `{ ok: true, data, meta }`。完整字段的 data 符合 MilanoteDocument v1；字段投影可能缺少必需字段。

meta 包含：

- scope：此次读取的范围。
- complete：是否完成请求的范围。root 模式成功读取根画板即为 true，不表示子画板已展开。
- unloadedBoardIds：未展开或读取失败的子画板 ID。
- warnings：SUB_BOARDS_NOT_EXPANDED、BOARD_LIMIT_REACHED、SUB_BOARD_FAILED，附带相关 boardIds。
- upstreamRequests：实际上游请求数。
- timings：permission、boards、parse、total，单位毫秒。

root 正常需要一次权限请求、一次画板请求。tree 最多读取 100 个画板，总超时 15 秒。部分子画板失败或达到上限会返回 complete=false；调用方不可把缺失内容当作空画板。超时返回 504。

下面是精简字段、根范围读取的响应示例，包含一个尚未展开的子画板：

<!-- api-response -->

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "source": { "provider": "milanote", "boardId": "root" },
    "board": {
      "id": "root",
      "type": "BOARD",
      "title": "示例画板",
      "children": [{ "id": "child", "type": "BOARD", "title": "子画板", "children": [] }]
    }
  },
  "meta": {
    "scope": "root",
    "complete": true,
    "warnings": [{ "code": "SUB_BOARDS_NOT_EXPANDED", "boardIds": ["child"] }],
    "unloadedBoardIds": ["child"],
    "upstreamRequests": 2,
    "timings": { "permission": 30, "boards": 70, "parse": 2, "total": 102 }
  }
}
```

这里 `child.children=[]` 是兼容文档结构的占位。因为 ID 出现在 `unloadedBoardIds` 中，不能据此判断该子画板为空；`complete=true` 只表示本次 root 范围完成。后续请求 `scope=tree` 才会读取其内容。

## 响应头

所有数据响应返回 `Cache-Control: no-store`，没有 ETag 或条件缓存。
`Server-Timing` 提供分阶段耗时；`X-Upstream-Requests` 提供上游请求数；`X-Request-Id` 可用于关联本次请求。

分段耗时和上游请求数在解析成功响应中提供；错误响应仍带请求 ID 和禁止缓存头。`meta.timings.total` 是解析核心的处理时间，不含响应传输；调试台状态栏记录从发送到读取完正文的客户端耗时，两者不必相等。

CORS 允许跨域调用，并暴露上述头部。POST 支持 OPTIONS 预检，允许 Content-Type 和 Authorization。其他方法返回 405。

## 元数据

- `GET /api/openapi.json`：OpenAPI 3.1 定义与请求示例。
- `GET /api/capabilities`：实例能力。官方返回 version=1、storage=false、cache=false、scheduling=false。

错误格式为 `{ ok: false, error: { code, message, stage } }`，详见[错误说明](./errors)。
