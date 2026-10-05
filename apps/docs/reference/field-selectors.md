# 字段筛选

字段选择作用于响应 data；meta 始终保留。服务端先移除敏感字段，再执行投影。

| 参数          | 意义                                      |
| ------------- | ----------------------------------------- |
| view=full     | 完整规范化文档，默认值                    |
| view=standard | 来源、抓取时间、根画板常用信息和 children |
| view=compact  | 版本、来源 ID、递归节点 ID / type / title |
| include       | 只保留列出的字段                          |
| exclude       | 从所选 view 排除字段                      |

include、exclude 都是 JSON 字符串数组。include 不能与 view 或 exclude 混用。exclude 可与 view 同时使用。scope 控制读取范围，和这些字段独立。

## 路径语法

使用点号分隔对象路径，`*` 匹配一级字段，`**` 匹配递归路径。数组内的每项采用相同字段路径，不写数组下标。

常见选择器：`board.title`、`board.children`、`board.**.richText.plainText`、`**.location`、`**.timestamps`、`**.file.url`。

<!-- api-example -->

```json
{
  "url": "https://app.milanote.com/your-board/shared-view?p=your-permission",
  "scope": "tree",
  "view": "full",
  "exclude": ["**.location", "**.timestamps"]
}
```

每组最多 100 项、路径深度最多 20 层；同组路径以逗号连接后的总长度不能超过 8192 字符。未知路径、错误语法、超深路径或敏感字段返回 `INVALID_FIELD_SELECTOR`。数组类型错误、空数组或包含空字符串会先在请求校验阶段返回 `INVALID_REQUEST`。

调试台表单使用换行分隔路径，发送时转换为 JSON 数组。标准、精简选项会自动填入排除规则；手动修改后按自定义规则返回。表单失焦、发送或生成代码时会静默清理无效、重复及只有通配符的规则（例如 `**`），有效的 `**.location` 等递归路径保留。直接调用 API 仍按上述规则严格校验，详见[调试台指南](../guide/playground#字段规则)。

## 敏感字段

accessToken、internalId、userId、privateMetadata、permission、permissionId、token 在任何层级都会被移除，包括 UNKNOWN.content。不能通过 include 取回这些字段。

## 返回类型

投影结果可能缺少 MilanoteDocument 必需字段，不保证通过完整 schema。调试台对完整模型使用画板布局，对精简或自定义结果按实际返回字段预览。精简视图不会跳过当前 scope 需要的上游请求。
