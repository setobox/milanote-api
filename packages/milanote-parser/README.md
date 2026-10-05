# @milanote-api/parser

将公开分享画板转换为经过 Zod 验证的 MilanoteDocument。

```ts
import { fetchMilanoteBoardWithDiagnostics } from "@milanote-api/parser";
const { document, diagnostics } = await fetchMilanoteBoardWithDiagnostics(
  "https://app.milanote.com/your-board/shared-view?p=your-permission",
  { scope: "root", timeoutMs: 15_000 },
);
```

诊断入口默认只读根画板；scope=tree 递归读取。diagnostics 标记未展开、达到上限和失败的子画板。原 fetchMilanoteBoard 保留文档返回类型和默认递归读取。接口不缓存请求。
