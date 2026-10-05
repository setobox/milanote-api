# Parser SDK

`@milanote-api/parser` 提供规范化文档与诊断读取入口。

```ts
import { fetchMilanoteBoardWithDiagnostics } from "@milanote-api/parser";

const { document, diagnostics } = await fetchMilanoteBoardWithDiagnostics(
  "https://app.milanote.com/your-board/shared-view?p=your-permission",
  { scope: "root", maxBoards: 100, timeoutMs: 15_000 },
);
console.log(document.board, diagnostics.complete);
```

诊断入口默认 root。options 支持 scope、maxBoards、timeoutMs、signal，以及测试用 fetch 和 now。maxBoards 与 timeoutMs 必须为正安全整数。

diagnostics 包含 scope、complete、warnings、unloadedBoardIds、upstreamRequests、timings。root 的 complete 只代表根画板范围完成，子画板仍可能未展开。

原 `fetchMilanoteBoard(url, options)` 继续只返回 MilanoteDocument，默认 tree；可显式传 scope。两种入口都不缓存上游请求。

`parseMilanoteBoardResponse` 为包内解析步骤。公开 schema、MilanoteDocument 和 MilanoteNode 可用于检查完整文档；裁剪响应需按自己的投影结构检查。
