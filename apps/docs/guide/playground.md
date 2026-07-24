# Playground

<a href="/playground" target="_self">打开 Playground</a>

Playground 是位于 `/playground` 的 React 单页工具，用于交互式检查公开共享画板和生成可复用的
API 请求。

## 使用方式

1. 从 Milanote 复制公开分享链接。
2. 将链接粘贴到左侧输入框。
3. 保留默认“完整”预设，或选择预设/黑名单、白名单模式。
4. 提交后在右侧查看 Canvas 或 JSON。
5. 需要在代码中复用时，点击“复制完整 API 链接”。

Playground 默认请求 `/api/detail` 的 `full` 视图，因此首次使用无需配置筛选即可得到完整
`MilanoteDocument`。完整响应提供 Canvas 与 JSON 切换；`compact`、`standard`、白名单
或其他不足以构建完整文档的投影响应只提供 JSON，避免把 partial DTO 当成完整模型渲染。

## 字段筛选

“预设 / 黑名单”模式可以选择：

- `full`：完整文档，也是 Playground 默认值。
- `standard`：常用元数据和完整 `board.children` 分支。
- `compact`：版本、来源标识和递归的 `id/type/title`。

随后可以勾选需要额外移除的字段。“白名单”模式则只返回勾选字段。界面生成的请求始终遵守
`include` 与 `exclude` 互斥、`view + include` 禁止的协议。完整语义见
[字段选择器](/reference/field-selectors)。

节点卡片不显示 `COL`、`NTE`、`LST`、`LNK`、`BRD`、`TBL` 等内部类型缩写；列或评论等
数量提示只在悬停或键盘聚焦对应元素时出现。

## 复制完整 API 链接

复制按钮使用与实际请求相同的 URL 构造逻辑，包含：

- 当前站点 origin；
- `/api/detail` 路径；
- 已安全编码的完整 Milanote 分享链接；
- 当前 `view`、`include` 或 `exclude` 选择。

::: danger 复制结果包含分享权限参数
完整 API URL 包含 Milanote 分享链接中的 permission ID。不要粘贴到公开 issue、聊天记录、
截图或不受控日志中。复制链接并不会把它变成可以安全公开的凭据。
:::

## 客户端行为

- 初始页面不会自动发起 API 请求。
- 每次新提交都会中止尚未完成的旧请求。
- “重新抓取”会重放上一次已提交的完整请求，而不是未提交的当前控件状态。
- 输入不会写入 Playground 页面地址、`localStorage` 或最近记录。
- JSON 视图支持复制当前响应；筛选响应复制的是 partial DTO。
- 客户端会先验证链接；Worker 仍会独立执行完整边界验证。

::: warning GET 请求的可见性
Playground 不修改自身页面地址，但实际 API 请求和复制出的完整 URL 仍可能进入浏览器历史、
开发者工具、CDN 缓存键、网络基础设施和平台访问日志。
:::
