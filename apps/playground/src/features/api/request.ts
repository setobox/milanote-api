export const fieldSelectorOptions = [
  { group: "文档", label: "文档版本", value: "version" },
  { group: "文档", label: "来源信息", value: "source" },
  { group: "文档", label: "来源类型", value: "source.provider" },
  { group: "文档", label: "来源画板 ID", value: "source.boardId" },
  { group: "文档", label: "抓取时间", value: "fetchedAt" },
  { group: "根画板", label: "画板 ID", value: "board.id" },
  { group: "根画板", label: "画板类型", value: "board.type" },
  { group: "根画板", label: "画板标题", value: "board.title" },
  { group: "根画板", label: "画板颜色", value: "board.color" },
  { group: "递归节点", label: "所有节点 ID", value: "board.**.id" },
  { group: "递归节点", label: "所有节点类型", value: "board.**.type" },
  { group: "递归节点", label: "所有节点标题", value: "board.**.title" },
  {
    group: "递归节点",
    label: "所有富文本纯文本",
    value: "board.**.richText.plainText",
  },
  { group: "递归节点", label: "所有位置", value: "**.location" },
  { group: "递归节点", label: "所有时间戳", value: "**.timestamps" },
  { group: "媒体", label: "全部图片数据", value: "board.**.image" },
  { group: "媒体", label: "全部文件数据", value: "board.**.file" },
  { group: "媒体", label: "文件下载地址", value: "**.file.url" },
  { group: "媒体", label: "图标 SVG 地址", value: "**.icon.svgUrl" },
  { group: "内容", label: "任务完成状态", value: "board.**.completed" },
  { group: "内容", label: "任务截止日期", value: "board.**.dueDate" },
  { group: "内容", label: "表格数据", value: "board.**.table" },
  { group: "内容", label: "评论数据", value: "board.**.comments" },
] as const;

export const defaultIncludeSelectors = [
  "version",
  "source.provider",
  "source.boardId",
  "board.**.id",
  "board.**.type",
  "board.**.title",
] as const;

export type FieldView = "compact" | "full" | "standard";

export type PlaygroundFilter =
  | {
      exclude: readonly string[];
      mode: "view";
      view: FieldView;
    }
  | {
      include: readonly string[];
      mode: "include";
    };

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export function buildBoardRequestPath(shareUrl: string, filter: PlaygroundFilter): string {
  const parameters = new URLSearchParams({ url: shareUrl });

  if (filter.mode === "include") {
    const include = uniqueSorted(filter.include);
    if (include.length === 0) {
      throw new Error("EMPTY_INCLUDE");
    }
    parameters.set("include", include.join(","));
  } else {
    if (filter.view !== "full") {
      parameters.set("view", filter.view);
    }

    const exclude = uniqueSorted(filter.exclude);
    if (exclude.length > 0) {
      parameters.set("exclude", exclude.join(","));
    }
  }

  return `/api/detail?${parameters.toString()}`;
}

export function buildAbsoluteApiUrl(requestPath: string, origin: string): string {
  return new URL(requestPath, origin).toString();
}
