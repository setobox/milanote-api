# Parser SDK

`@milanote-api/parser` 提供高层抓取函数、稳定错误类型、规范化 schemas 与推导类型。

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
| `timeoutMs` | `number`                  | `15000`    | 整个上游请求过程的超时 |

`maxBoards` 和 `timeoutMs` 必须是正安全整数。

## 错误

`MilanoteParserError.code` 可能为：

- `INVALID_SHARE_URL`
- `UPSTREAM_REQUEST_FAILED`
- `UPSTREAM_ACCESS_DENIED`
- `INVALID_UPSTREAM_RESPONSE`
- `BOARD_NOT_FOUND`

错误消息不包含分享链接、permission ID、token 或上游响应详情。

## 公共入口边界

原始响应解析与分享链接拆解是包内实现，不作为公共 API 导出。调用方应使用 `fetchMilanoteBoard`，或使用公开 Zod schemas 验证已有规范化数据。
