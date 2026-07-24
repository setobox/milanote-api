# 字段选择器

`/api/search` 与 `/api/detail` 都可以在成功响应的 `data` 内执行字段投影。外层
`{ "ok": true, "data": ... }` 契约不会被筛选。

::: warning Partial DTO
`compact`、`standard`、`include` 以及任何 `exclude` 结果都可能省略必填字段。此时
`data` 是通用 JSON 对象，不保证通过完整的 `milanoteDocumentSchema`；只有未删减的
`full` 响应才是 `MilanoteDocument` v1。
:::

## 预设视图

使用 `view=compact|standard|full` 选择预设：

| 视图       | 字段                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `compact`  | `version`、`source.provider`、`source.boardId`、`board.**.id`、`board.**.type`、`board.**.title` |
| `standard` | `version`、完整 `source`、`fetchedAt`、根画板的 `id/type/title/color` 与完整 `children` 分支     |
| `full`     | `**`，即完整规范化文档                                                                           |

端点的默认视图不同：

| 请求                      | 未提供筛选参数时 |
| ------------------------- | ---------------- |
| `GET /api/search?url=...` | `compact`        |
| `GET /api/detail?url=...` | `full`           |

显式 `view` 会覆盖端点默认值，因此 `/api/search?view=full` 与
`/api/detail?view=compact` 都是合法请求。

## 白名单 `include`

`include` 从空结果开始，只保留逗号分隔的选择器：

```http
GET /api/detail?url=…&include=version,source.provider,board.id,board.title,board.children.id,board.children.type
```

子字段命中时会自动保留父对象。数组路径不使用下标：

```text
board.children.id
```

它会把 `id` 投影到 `children` 的每一个元素，而不是读取某个固定位置。嵌套数组同样透明，
例如 `board.**.table.rows.value` 会跨过 `rows` 的数组层级。

`include` 投影会删除没有任何命中字段的空对象和数组元素，但会保留结构上命中的空数组
`[]`。如果没有任何字段命中，`data` 可以是 `{}`。

## 黑名单 `exclude`

`exclude` 从当前视图开始删除逗号分隔的选择器：

```http
GET /api/detail?url=…&exclude=fetchedAt,**.timestamps,**.icon.svgUrl
```

单独使用 `exclude` 时，“当前视图”就是端点默认值。因此：

- `/api/search?...&exclude=board.**.title` 从 `compact` 删除标题。
- `/api/detail?...&exclude=**.timestamps` 从 `full` 删除所有层级的时间戳。

也可以显式组合 `view + exclude`：

```http
GET /api/detail?url=…&view=standard&exclude=fetchedAt,board.color
```

## 点路径与通配符

选择器区分大小写，普通字段使用 `.` 连接。两个通配符含义不同：

| 通配符 | 含义               | 示例          |
| ------ | ------------------ | ------------- |
| `*`    | 恰好匹配一层字段   | `board.*.id`  |
| `**`   | 匹配零层到任意深度 | `board.**.id` |

`board.*.id` 只在固定的一层之后寻找 `id`；`board.**.id` 则会匹配 `board` 下任意深度
的 `id`。常见示例：

```text
board.**.title
**.timestamps
**.file.url
board.**.richText.plainText
```

数组不会占用路径段，通配符只描述对象字段层级。

## 参数组合

`url` 始终必须且只能出现一次；`view`、`include`、`exclude` 各自也最多出现一次。

| 组合                       | 结果                         |
| -------------------------- | ---------------------------- |
| 无筛选参数                 | 使用端点默认视图             |
| `include`                  | 合法，从空结果开始投影       |
| `exclude`                  | 合法，从端点默认视图开始删除 |
| `view`                     | 合法，使用指定预设           |
| `view + exclude`           | 合法，先应用预设再删除       |
| `include + exclude`        | `400 INVALID_REQUEST`        |
| `view + include`           | `400 INVALID_REQUEST`        |
| `view + include + exclude` | `400 INVALID_REQUEST`        |

不要为冲突组合设计客户端优先级；服务端会直接拒绝。

## 数量与深度限制

- 每个 `include` 或 `exclude` 最多包含 100 个逗号项。
- 每个参数的选择器列表最长为 8192 个字符。
- 每个路径最多包含 20 个点路径段。
- 普通路径段必须以英文字母开头，后续只能使用英文字母、数字或下划线。
- 重复路径会按第一次出现自动去重，但原始重复项仍计入 100 项上限。
- 空项、连续逗号、非法字段名、未知字段以及无法匹配规范模型的路径都会被拒绝。

无效选择器返回 `400 INVALID_FIELD_SELECTOR`：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_FIELD_SELECTOR",
    "message": "Unknown field selector: board.password",
    "field": "include"
  }
}
```

`error.field` 在字段选择器错误中标识 `include` 或 `exclude`；错误契约将它定义为可选字段，
其他错误不会包含它。

## 安全顺序

用户筛选不是敏感字段保护机制。服务端处理顺序固定为：

```text
上游数据
  → 规范化 MilanoteDocument
  → 永久敏感字段过滤
  → view / include / exclude
  → 最终响应
```

`internalId`、`accessToken`、`userId`、`privateMetadata`、permission 与 token
等敏感字段会在任意深度、大小写不敏感地永久移除。即使通过 `include` 明确请求，也只会收到
`INVALID_FIELD_SELECTOR`，绝不会绕过服务端过滤。

## 正确编码请求

不要手动拼接分享链接与逗号列表。让 `URLSearchParams` 负责百分号编码：

```ts
const parameters = new URLSearchParams({
  url: "https://app.milanote.com/board-id/shared-view?p=permission-id",
  include: [
    "version",
    "source.provider",
    "board.id",
    "board.title",
    "board.**.id",
    "board.**.type",
  ].join(","),
});

const response = await fetch(`/api/detail?${parameters}`);
```

选择器会参与最终响应和 ETag 的计算。不同投影即使来自同一画板，也应视为不同表示。
