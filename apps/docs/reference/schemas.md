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
