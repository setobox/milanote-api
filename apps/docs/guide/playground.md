# Playground

<a href="/playground" target="_self">打开 Playground</a>

Playground 位于 `/playground`，可以用来查看公开共享画板、调整字段筛选，并生成可复用的 API 请求。

## 使用方式

1. 从 Milanote 复制公开分享链接。
2. 粘贴链接，保留默认的“完整”预设，或选择“标准”“精简”。
3. 点击“解析画板”，在右侧查看 Canvas 或 JSON。
4. 需要自定义字段或复制请求时，展开“高级字段筛选”。

默认请求是 `/api/detail` 的 `full` 视图，因此可以直接查看完整画板。只有完整数据会显示 Canvas；`compact`、`standard`、白名单或其他裁剪后的结果只显示 JSON。

## 高级字段筛选

大多数情况只需要选一个预设：

- `full`：完整画板，也是 Playground 的默认值。
- `standard`：常用元数据和完整 `board.children` 分支。
- `compact`：版本、来源信息，以及递归的 `id`、`type` 和 `title`。
- `custom`：只返回字段树中选中的项目；选择保存在当前浏览器的 localStorage 中。

展开后还可以排除当前预设中的字段，或只返回选中的字段。界面不会组合服务端不接受的参数，例如 `include + exclude` 或 `view + include`。完整规则见[字段选择器](/reference/field-selectors)。

在字段树中选择子项会带上必要的父对象，例如选择 `source.provider` 也会包含 `source`；取消父项会一并取消子项。

节点卡片不直接显示 `COL`、`NTE`、`LST`、`LNK`、`BRD`、`TBL` 等内部类型缩写。列数、评论数等提示只会在悬停或键盘聚焦时出现。

## 复制 API 链接

复制按钮会按照当前请求生成完整 URL，其中包括：

- 当前站点 origin；
- `/api/detail` 路径；
- 已编码的 Milanote 分享链接；
- 当前的 `view`、`include` 或 `exclude` 选择。

::: danger 复制的链接包含权限参数
完整 API URL 会带上 Milanote 分享链接中的 permission ID。不要把它公开；更多风险说明见[安全与缓存](/guide/security)。
:::

## 客户端行为

- 页面打开时不会请求 API。
- 每次提交新请求都会取消仍在等待的旧请求。
- “重新抓取”会重放上一次已经提交的请求，不会读取尚未提交的控件状态。
- 输入不会写入页面地址、`localStorage` 或最近记录。
- JSON 视图可以复制当前响应。
- 客户端会先检查链接；Worker 仍会再次验证请求。

实际请求和复制出的完整 URL 仍可能出现在浏览器历史、开发者工具、CDN 缓存键、网络设备和平台日志中。
