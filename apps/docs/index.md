---
layout: home

hero:
  name: Milanote API
  text: 公开画板，可控 JSON
  tagline: 通过一个分享链接获取完整 MilanoteDocument v1，或按字段投影异构递归画板。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 字段筛选
      link: /reference/field-selectors
    - theme: alt
      text: 打开 Playground
      link: /playground
      target: _self

features:
  - title: 精简与完整双端点
    details: /api/search 默认 compact，/api/detail 默认 full；两个端点共享稳定的 HTTP 契约。
  - title: 递归字段筛选
    details: view、include 与 exclude 支持点路径、透明数组、一层 * 与任意深度 **。
  - title: Zod 4 数据边界
    details: 完整文档、递归节点、富文本、媒体、表格和评论均有运行时 schema。
  - title: Cloudflare 一体部署
    details: 文档、React Playground 与 Worker API 共享同一域名和构建产物。
---

## 适用场景

Milanote API 面向需要读取公开共享画板的原型、内部工具和数据管道。它将上游未公开且可能变化的结构，转换为版本化的 `MilanoteDocument`，再按需生成更小的 JSON 投影。

| 需求                 | 端点                                        |
| -------------------- | ------------------------------------------- |
| 列表、索引或搜索结果 | `GET /api/search`，默认 `compact`           |
| 完整画板与 Canvas    | `GET /api/detail`，默认 `full`              |
| 自定义字段           | 任一端点配合 `view`、`include` 或 `exclude` |

::: warning 从旧版迁移
旧版 `/api/search` 的完整响应行为已迁移到 `/api/detail`。`/api/search` 现在默认返回精简字段；
需要完整 `MilanoteDocument` 的调用方必须改用 `/api/detail`。
:::

::: warning 上游兼容性
Milanote 的 `/api/boards` 不是公开 API。项目会宽容读取未知字段，但上游仍可能随时发生破坏性变化。
:::
