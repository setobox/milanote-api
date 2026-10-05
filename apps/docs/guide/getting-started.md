# 快速开始

复制你有权访问的 Milanote 公开分享链接，在调试台选择“根画板”并发送。没有分享权限的画板无法解析。

## 发出第一个请求

```js
const response = await fetch("https://YOUR_API_HOST/api/boards/parse", {
  method: "POST",
  cache: "no-store",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "https://app.milanote.com/your-board/shared-view?p=your-permission",
    scope: "root",
    view: "full",
  }),
});
const result = await response.json();
if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "请求失败");
console.log(result.data);
```

YOUR_API_HOST 使用你部署的 API 地址，或在调试台“设置”页查看的 API 服务地址。只填服务根地址，不包含 `/api/boards/parse`、查询参数或凭据；示例中的 YOUR_API_HOST 不能直接使用。GitHub Pages 本身不执行 API。

## 选择读取范围

默认 root 只请求当前画板，保留子画板入口但不展开。tree 读取嵌套内容，画板越多可能越慢。检查 meta.complete、meta.warnings 和 meta.unloadedBoardIds 来判断内容是否齐全。

## 只取需要的字段

<!-- api-example -->

```json
{
  "url": "https://app.milanote.com/your-board/shared-view?p=your-permission",
  "scope": "root",
  "include": ["board.id", "board.title", "board.**.richText.plainText"]
}
```

字段投影在读取和解析之后执行，只减少返回内容。完整参数见 [HTTP API](../reference/http-api)，字段语法见[字段筛选](../reference/field-selectors)。
