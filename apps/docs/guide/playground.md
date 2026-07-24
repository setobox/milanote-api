# Playground

[打开 Playground](/playground)

Playground 是位于 `/playground` 的 React 单页工具，用于交互式检查公开共享画板。

## 使用方式

1. 从 Milanote 复制公开分享链接。
2. 将链接粘贴到左侧输入框。
3. 提交后在右侧切换 Canvas 或 JSON。
4. 需要最新结果时使用“重新抓取”。

Canvas 会展示画板、列、卡片、图片、文件、链接、任务、表格和评论线程。未知上游元素会以 `UNKNOWN` 节点保留安全的 JSON 内容。

## 客户端行为

- 初始页面不会自动发起 API 请求。
- 每次新提交都会中止尚未完成的旧请求。
- 输入不会写入页面地址、`localStorage` 或最近记录。
- JSON 视图支持复制完整规范化文档。
- 客户端会先验证链接；Worker 仍会独立执行完整边界验证。

::: warning GET 请求的可见性
Playground 不修改浏览器地址，但请求 URL 仍可能进入开发者工具、网络基础设施和平台访问日志。
:::
