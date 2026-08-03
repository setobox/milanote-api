---
layout: home

hero:
  name: Milanote API
  text: 把公开画板变成可用的 JSON
  tagline: 输入一个分享链接，获取完整画板数据，筛选需要的字段。
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
  - title: 两种读取方式
    details: /api/search 返回适合列表使用的精简数据；/api/detail 返回完整画板。
  - title: 按字段取数据
    details: 用 view、include 或 exclude 控制返回字段，支持路径和通配符。
  - title: 数据可验证
    details: 完整画板、节点、富文本、媒体、表格和评论都有 Zod schema。
  - title: 一个部署产物
    details: 文档、Playground 和 Worker API 共享域名和构建产物。
---

## 适用场景

Milanote API 用于读取公开共享画板。它把 Milanote 返回的画板内容整理成 `MilanoteDocument`，供原型、内部工具和数据处理任务使用。

## 选哪个端点？

| 需要什么                   | 使用方式                                   |
| -------------------------- | ------------------------------------------ |
| 列表、索引或搜索结果       | `GET /api/search`，默认返回 `compact` 数据 |
| 完整画板或 Canvas 所需字段 | `GET /api/detail`，默认返回 `full` 数据    |
| 自己决定字段               | 任一端点配合`view`、`include` 或 `exclude` |

字段筛选后的数据不一定符合完整的 `MilanoteDocument`。选择规则见[字段选择器](/reference/field-selectors)，端点和迁移说明见 [HTTP API](/reference/http-api)。

Milanote 的上游接口并未公开，返回内容可能变化。上线前请评估这一风险。
