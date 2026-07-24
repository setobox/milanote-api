# Zod 数据模型

规范化模型由 Zod 4 schema 定义，TypeScript 类型从 schema 推导。可在网络、持久化或第三方调用边界再次验证。

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

`milanoteNodeSchema` 验证以下 `type` 判别联合：

| 类型             | 主要内容                         |
| ---------------- | -------------------------------- |
| `BOARD`          | 标题、图标、颜色、媒体和子节点   |
| `COLUMN`         | 标题和子节点                     |
| `CARD`           | 富文本、背景和透明状态           |
| `IMAGE`          | 图片与文件元数据                 |
| `FILE`           | 文件、预览图和显示模式           |
| `LINK`           | URL、标题、provider 与 caption   |
| `TASK_LIST`      | 标题和任务子节点                 |
| `TASK`           | 富文本、完成状态、截止与提醒时间 |
| `TABLE`          | 行、单元格、列宽和样式           |
| `COMMENT_THREAD` | 规范化评论数组                   |
| `SKELETON`       | 上游占位节点                     |
| `UNKNOWN`        | 未识别元素类型及安全 JSON 内容   |

每个节点都包含 `id`、`location`、`timestamps` 和递归 `children`。

## 值对象 schemas

包还导出以下运行时边界：

- `milanoteRichTextSchema`
- `milanoteImageMediaSchema`、`milanoteFileMediaSchema`
- `milanoteTableDataSchema`、`milanoteTableCellSchema`
- `milanoteCommentSchema`
- `milanotePositionSchema`、`milanoteLocationSchema`
- `milanoteTimestampsSchema`
- `milanoteShareUrlSchema`

Zod 默认会从规范化对象中移除未知键；上游原始响应则由内部解析器宽容读取，二者职责不同。

## HTTP 投影与完整模型

`milanoteDocumentSchema` 描述完整规范化文档，不描述任意字段投影：

| HTTP 数据                             | 可否按 `MilanoteDocument` 验证 |
| ------------------------------------- | ------------------------------ |
| `/api/detail` 默认响应                | 可以                           |
| 任一端点显式 `view=full` 且未排除字段 | 可以                           |
| `/api/search` 默认 `compact` 响应     | 不可以                         |
| `view=compact` / `view=standard`      | 不可以                         |
| 任意 `include` / `exclude` 结果       | 不保证                         |

筛选后的成功响应仍是 `{ ok: true, data: object }`，但 `data` 是 partial DTO。客户端应按
实际选择器定义自己的更小 schema，或将它作为经过 JSON 边界验证的通用对象处理，不能为了通过
完整 schema 而伪造缺失字段。

字段筛选发生在 Worker 层，并且晚于完整文档规范化与永久敏感字段过滤。Parser SDK 本身始终
返回完整 `MilanoteDocument`。
