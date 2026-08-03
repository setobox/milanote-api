# Zod 数据模型

规范化数据由 Zod 4 schema 定义，TypeScript 类型从 schema 推导。接收网络数据、读取持久化数据或调用第三方服务时，都可以再次验证。

```ts
import {
  milanoteDocumentSchema,
  milanoteNodeSchema,
  type MilanoteDocument,
  type MilanoteNode,
} from "@milanote-api/parser";

const document: MilanoteDocument = milanoteDocumentSchema.parse(input);
const node: MilanoteNode = milanoteNodeSchema.parse(inputNode);
```

## 文档结构

`milanoteDocumentSchema` 包含：

- `version: 1`
- `source.provider: "milanote"`
- `source.boardId`
- ISO 字符串 `fetchedAt`
- 根 `BOARD` 节点

## 递归节点联合

`milanoteNodeSchema` 按 `type` 验证以下节点：

| 类型             | 主要内容                         |
| ---------------- | -------------------------------- |
| `BOARD`          | 标题、图标、颜色、媒体和子节点   |
| `COLUMN`         | 标题和子节点                     |
| `CARD`           | 富文本、背景和透明状态           |
| `IMAGE`          | 图片与文件元数据                 |
| `FILE`           | 文件、预览图和显示模式           |
| `LINK`           | URL、标题、provider 和 caption   |
| `TASK_LIST`      | 标题和任务子节点                 |
| `TASK`           | 富文本、完成状态、截止和提醒时间 |
| `TABLE`          | 行、单元格、列宽和样式           |
| `COMMENT_THREAD` | 规范化评论数组                   |
| `SKELETON`       | 上游占位节点                     |
| `UNKNOWN`        | 未识别元素类型及安全 JSON 内容   |

每个节点都有 `id`、`location`、`timestamps` 和递归 `children`。

## 值对象 schema

包还导出：

- `milanoteRichTextSchema`
- `milanoteImageMediaSchema`、`milanoteFileMediaSchema`
- `milanoteTableDataSchema`、`milanoteTableCellSchema`
- `milanoteCommentSchema`
- `milanotePositionSchema`、`milanoteLocationSchema`
- `milanoteTimestampsSchema`
- `milanoteShareUrlSchema`

Zod 会从规范化对象中移除未知键。上游原始响应则由内部解析器宽容读取，两者用途不同。

## HTTP 数据与完整模型

`milanoteDocumentSchema` 只描述完整的规范化文档，不描述任意字段筛选结果：

| HTTP 数据                              | 能否按 `MilanoteDocument` 验证 |
| -------------------------------------- | ------------------------------ |
| `/api/detail` 默认响应                 | 可以                           |
| 任一端点显式 `view=full`，且未排除字段 | 可以                           |
| `/api/search` 默认 `compact` 响应      | 不可以                         |
| `view=compact` / `view=standard`       | 不可以                         |
| 任意 `include` / `exclude` 结果        | 不保证                         |

筛选后的成功响应仍是 `{ ok: true, data: object }`，但 `data` 要按实际字段处理。需要验证时，为自己的筛选条件定义更小的 schema；不要为了套用完整 schema 补造缺失字段。

字段筛选发生在 Worker 层。Parser SDK 始终返回完整 `MilanoteDocument`。
