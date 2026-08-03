# 字段选择器

`/api/search` 和 `/api/detail` 都能筛选成功响应里的 `data`。外层 `{ "ok": true, "data": ... }` 不会变化。

筛选后的 `data` 可能少于完整 `MilanoteDocument` 所需字段。下文把这类结果称为“裁剪后的数据”（partial DTO）；只有未裁剪的 `full` 数据才是完整 `MilanoteDocument` v1。

## 预设视图

通过 `view=compact|standard|full` 选择预设：

| 视图       | 返回字段                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `compact`  | `version`、`source.provider`、`source.boardId`、`board.**.id`、`board.**.type`、`board.**.title` |
| `standard` | `version`、完整 `source`、`fetchedAt`、根画板的 `id/type/title/color` 和完整 `children` 分支     |
| `full`     | `**`，即完整的规范化文档                                                                         |

两个端点的默认视图不同：

| 请求                      | 未提供筛选参数时 |
| ------------------------- | ---------------- |
| `GET /api/search?url=...` | `compact`        |
| `GET /api/detail?url=...` | `full`           |

显式指定 `view` 会覆盖默认值，所以 `/api/search?view=full` 和 `/api/detail?view=compact` 都可以使用。

## 只保留字段：`include`

`include` 从空对象开始，只保留逗号分隔的字段：

```http
GET /api/detail?url=…&include=version,source.provider,board.id,board.title,board.children.id,board.children.type
```

命中子字段时，父对象会一并保留。数组路径不写下标：

```text
board.children.id
```

它会匹配 `children` 数组中的每一项，而不是某个固定位置。嵌套数组也一样，例如 `board.**.table.rows.value` 会穿过 `rows` 数组。

没有命中的空对象和数组元素会移除，但结构中命中的空数组 `[]` 会保留。如果没有字段命中，`data` 可以是 `{}`。

## 排除字段：`exclude`

`exclude` 会从当前视图中删除逗号分隔的字段：

```http
GET /api/detail?url=…&exclude=fetchedAt,**.timestamps,**.icon.svgUrl
```

单独使用 `exclude` 时，当前视图就是端点默认值：

- `/api/search?...&exclude=board.**.title` 会从 `compact` 数据中删除标题。
- `/api/detail?...&exclude=**.timestamps` 会从完整数据中删除所有层级的时间戳。

也可以组合 `view + exclude`：

```http
GET /api/detail?url=…&view=standard&exclude=fetchedAt,board.color
```

## 路径和通配符

选择器区分大小写，字段之间用 `.` 连接：

| 通配符 | 含义               | 示例          |
| ------ | ------------------ | ------------- |
| `*`    | 恰好匹配一层字段   | `board.*.id`  |
| `**`   | 匹配零层或任意深度 | `board.**.id` |

`board.*.id` 只会在固定的一层之后查找 `id`；`board.**.id` 会匹配 `board` 下任意深度的 `id`。例如：

```text
board.**.title
**.timestamps
**.file.url
board.**.richText.plainText
```

数组不占路径段，通配符只匹配对象字段层级。

## 参数组合

`url` 必须且只能出现一次；`view`、`include`、`exclude` 各自最多一次。

| 组合                       | 结果                     |
| -------------------------- | ------------------------ |
| 不传筛选参数               | 使用端点默认视图         |
| `include`                  | 从空对象开始保留字段     |
| `exclude`                  | 从端点默认视图中删除字段 |
| `view`                     | 使用指定预设             |
| `view + exclude`           | 先使用预设，再删除字段   |
| `include + exclude`        | `400 INVALID_REQUEST`    |
| `view + include`           | `400 INVALID_REQUEST`    |
| `view + include + exclude` | `400 INVALID_REQUEST`    |

服务端不会为冲突组合选择优先级，而是直接拒绝请求。

## 数量和深度限制

- 每个 `include` 或 `exclude` 最多 100 项。
- 每个参数的选择器列表最长 8192 个字符。
- 每条路径最多 20 段。
- 普通路径段必须以英文字母开头，后面只能使用英文字母、数字或下划线。
- 重复路径会按第一次出现去重，但原始重复项仍计入 100 项上限。
- 空项、连续逗号、非法字段名、未知字段和不能匹配模型的路径都会被拒绝。

无效选择器会返回 `400 INVALID_FIELD_SELECTOR`：

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

`error.field` 用来指出出错的是 `include` 还是 `exclude`。

## 安全规则

字段选择器不是权限控制。服务端会先移除敏感字段，再处理选择器；即使显式请求敏感字段，也不会绕过这一步。详情见[安全与缓存](/guide/security)。

## 正确编码请求

不要手动拼接分享链接和逗号列表，让 `URLSearchParams` 处理百分号编码：

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

选择器会影响返回的数据和 ETag。同一画板使用不同选择条件时，应分别保存 ETag。
