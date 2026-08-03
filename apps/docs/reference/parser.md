# Parser SDK

`@milanote-api/parser` 提供画板抓取函数、错误类型、规范化 schema 和对应的 TypeScript 类型。

## `fetchMilanoteBoard`

```ts
import { fetchMilanoteBoard, MilanoteParserError } from "@milanote-api/parser";

try {
  const document = await fetchMilanoteBoard(
    "https://app.milanote.com/board-id/shared-view?p=permission-id",
    {
      maxBoards: 100,
      timeoutMs: 15_000,
    },
  );
  console.log(document.board.title);
} catch (error) {
  if (error instanceof MilanoteParserError) {
    console.error(error.code);
  }
}
```

## 选项

| 选项        | 类型                      | 默认值     | 说明                   |
| ----------- | ------------------------- | ---------- | ---------------------- |
| `fetch`     | `typeof globalThis.fetch` | 全局 fetch | 注入网络实现或测试替身 |
| `now`       | `() => Date`              | 当前时间   | 控制 `fetchedAt`       |
| `maxBoards` | `number`                  | `100`      | 限制递归加载的画板数量 |
| `timeoutMs` | `number`                  | `15000`    | 整个上游请求的超时时间 |

`maxBoards` 和 `timeoutMs` 必须是正安全整数。

## 错误

`MilanoteParserError.code` 的可能值：

- `INVALID_SHARE_URL`
- `UPSTREAM_REQUEST_FAILED`
- `UPSTREAM_ACCESS_DENIED`
- `INVALID_UPSTREAM_RESPONSE`
- `BOARD_NOT_FOUND`

错误消息不会带出分享链接、permission ID、token 或上游响应详情。

## 公共 API

原始响应解析和分享链接拆解属于包内实现，不从公共入口导出。调用方应使用 `fetchMilanoteBoard` 抓取数据，或用公开的 Zod schema 验证已有的规范化数据。

## 与 HTTP 字段筛选的关系

`fetchMilanoteBoard` 始终返回完整 `MilanoteDocument`，不接受 `view`、`include` 或 `exclude`。字段筛选只存在于 Worker HTTP 层：

- `/api/search` 默认返回 `compact` 数据。
- `/api/detail` 默认返回完整数据。
- 任一端点都能通过[字段选择器](/reference/field-selectors)覆盖默认返回字段。

SDK 调用方如果需要筛选，应在应用中定义自己的投影类型。不要把 HTTP 返回的裁剪数据声明成 `MilanoteDocument`。
