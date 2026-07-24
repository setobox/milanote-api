---
layout: home

hero:
  name: Milanote API
  text: 公开画板，稳定 JSON
  tagline: 通过一个分享链接获取经过 Zod 验证、适合渲染与下游处理的 MilanoteDocument v1。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 打开 Playground
      link: /playground

features:
  - title: 单一公开端点
    details: GET /api/search 接受完整分享链接，返回固定成功与错误契约。
  - title: Zod 4 数据边界
    details: 规范化文档、递归节点、富文本、媒体、表格和评论均有运行时 schema。
  - title: Cloudflare 一体部署
    details: 文档、React Playground 与 Worker API 共享同一域名和构建产物。
---

## 适用场景

Milanote API 面向需要读取公开共享画板的原型、内部工具和数据管道。它将上游未公开且可能变化的结构，转换为版本化的 `MilanoteDocument`。

::: warning 上游兼容性
Milanote 的 `/api/boards` 不是公开 API。项目会宽容读取未知字段，但上游仍可能随时发生破坏性变化。
:::
