import { jsonValueSchema, milanoteShareUrlSchema } from "@milanote-api/parser";
import { z } from "zod";

export const PARSE_PATH = "/api/boards/parse";
export const EXAMPLE_URL = "https://app.milanote.com/your-board/shared-view?p=your-permission";
const selectors = z.array(z.string().min(1).max(8192)).min(1).max(100);
export const parseRequestSchema = z
  .strictObject({
    url: milanoteShareUrlSchema,
    scope: z.enum(["root", "tree"]).default("root"),
    view: z.enum(["full", "standard", "compact"]).optional(),
    include: selectors.optional(),
    exclude: selectors.optional(),
  })
  .refine((value) => !value.include || (!value.view && !value.exclude), {
    message: "include 不能与 view 或 exclude 同时使用。",
  });
export type ParseRequest = z.infer<typeof parseRequestSchema>;
export const diagnosticsSchema = z.object({
  scope: z.enum(["root", "tree"]),
  complete: z.boolean(),
  warnings: z.array(
    z.object({
      code: z.enum(["SUB_BOARDS_NOT_EXPANDED", "BOARD_LIMIT_REACHED", "SUB_BOARD_FAILED"]),
      boardIds: z.array(z.string()),
    }),
  ),
  unloadedBoardIds: z.array(z.string()),
  upstreamRequests: z.number().int().nonnegative(),
  timings: z.object({
    permission: z.number().nonnegative(),
    boards: z.number().nonnegative(),
    parse: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
});
export const successSchema = z.object({
  ok: z.literal(true),
  data: z.record(z.string(), jsonValueSchema),
  meta: diagnosticsSchema,
});
export type ParseSuccess = z.infer<typeof successSchema>;
export const capabilitiesSchema = z.object({
  version: z.literal(1),
  storage: z.boolean(),
  cache: z.literal(false),
  scheduling: z.literal(false),
});
export const requestPresets = [
  {
    id: "root",
    name: "根画板",
    description: "只读取当前画板，减少上游请求",
    body: { url: "", scope: "root", view: "full" },
  },
  {
    id: "tree",
    name: "完整递归",
    description: "读取嵌套子画板及其内容",
    body: { url: "", scope: "tree", view: "full" },
  },
  {
    id: "compact",
    name: "精简字段",
    description: "返回 ID、类型和标题",
    body: { url: "", scope: "root", view: "compact" },
  },
  {
    id: "custom",
    name: "自定义字段",
    description: "通过字段路径选择返回内容",
    body: { url: "", scope: "root", include: ["version", "board.id", "board.title"] },
  },
] satisfies Array<{ id: string; name: string; description: string; body: ParseRequest }>;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Milanote API",
    version: "1.0.0",
    description: "无状态实时解析。scope 控制抓取范围，view 控制返回字段。",
  },
  paths: {
    [PARSE_PATH]: {
      post: {
        operationId: "parseBoard",
        summary: "解析公开分享画板",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                ...z.toJSONSchema(parseRequestSchema, { io: "input" }),
                description:
                  "view 未指定时采用 full。include 不可与 view、exclude 混用。url 必须为公开 Milanote 分享链接。",
                allOf: [
                  { not: { required: ["include", "view"] } },
                  { not: { required: ["include", "exclude"] } },
                ],
              },
              examples: Object.fromEntries(
                requestPresets.map((preset) => [
                  preset.id,
                  { summary: preset.name, value: { ...preset.body, url: EXAMPLE_URL } },
                ]),
              ),
            },
          },
        },
        responses: {
          "200": {
            description: "成功；meta.complete 表示是否完成所选范围。响应不缓存。",
            content: { "application/json": { schema: z.toJSONSchema(successSchema) } },
          },
          "400": { description: "参数或字段选择错误" },
          "403": { description: "画板访问被拒绝" },
          "404": { description: "画板不存在" },
          "413": { description: "请求过大" },
          "415": { description: "需要 JSON 请求体" },
          "502": { description: "上游失败" },
          "504": { description: "上游超时" },
        },
      },
    },
    "/api/capabilities": {
      get: {
        summary: "实例能力",
        responses: {
          "200": {
            description: "官方实例不提供存储、缓存、调度",
            content: { "application/json": { schema: z.toJSONSchema(capabilitiesSchema) } },
          },
        },
      },
    },
    "/api/openapi.json": {
      get: { summary: "接口定义", responses: { "200": { description: "OpenAPI 3.1" } } },
    },
  },
};
