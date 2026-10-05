---
layout: home
hero:
  name: Milanote API
  text: 从分享链接到可用的数据
  tagline: 按需读取画板，检查真实响应，把调通的请求带进你的项目。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 打开调试台
      link: /playground/
      target: _self
features:
  - title: 按需读取
    details: 默认只读根画板，通过 scope 参数开启递归；诊断信息明确标识未展开或失败的内容。
  - title: 请求工作区
    details: 多标签、快捷模式、JSON 编辑、响应预览和可复制的请求代码。
  - title: 可验证的数据
    details: 规范化数据、公开 OpenAPI 定义与同步维护的使用文档。
---

## 选择读取方式

| 需求             | 请求参数                          |
| ---------------- | --------------------------------- |
| 查看当前画板     | scope=root，默认值                |
| 获取嵌套内容     | scope=tree                        |
| 减少响应字段     | view=compact 或 include / exclude |
| 查看完整性与耗时 | 检查 meta 与 Server-Timing        |

请求使用 POST /api/boards/parse。scope 决定抓取范围，字段精简只影响返回内容。完整说明见 [HTTP API](/reference/http-api)。

## 最小请求

向你的 API 服务发送以下 JSON，将分享链接替换为自己的公开分享链接：

<!-- api-example -->

```json
{
  "url": "https://app.milanote.com/your-board/shared-view?p=your-permission",
  "scope": "root",
  "view": "full"
}
```

可通过页首“打开调试台”发送请求，也可从[快速开始](/guide/getting-started)复制 Fetch 示例。

官方文档和调试台为静态页面，连接独立的 API。用户自己的定时采集和存储见[部署说明](/guide/deployment)。
