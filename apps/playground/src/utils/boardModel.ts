import type { MilanoteNode } from "@milanote-api/parser";

type NodeType = MilanoteNode["type"];

export interface BoardCommentView {
  author?: string;
  createdAt?: string;
  id: string;
  text: string;
}

const typeLabels: Record<NodeType, string> = {
  BOARD: "Board",
  CARD: "Note",
  COLUMN: "Column",
  COMMENT_THREAD: "Comments",
  FILE: "File",
  IMAGE: "Image",
  LINK: "Link",
  SKELETON: "Unavailable",
  TABLE: "Table",
  TASK: "Task",
  TASK_LIST: "Task list",
  UNKNOWN: "Unknown",
};

const typeCodes: Record<NodeType, string> = {
  BOARD: "BRD",
  CARD: "NTE",
  COLUMN: "COL",
  COMMENT_THREAD: "CMT",
  FILE: "FIL",
  IMAGE: "IMG",
  LINK: "LNK",
  SKELETON: "—",
  TABLE: "TBL",
  TASK: "TSK",
  TASK_LIST: "LST",
  UNKNOWN: "???",
};

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported normalized node: ${String(value)}`);
}

export function getNodeChildren(node: MilanoteNode): readonly MilanoteNode[] {
  return node.children;
}

export function getNodeLabel(node: MilanoteNode): string {
  switch (node.type) {
    case "BOARD":
    case "COLUMN":
      return trimmed(node.title) ?? typeLabels[node.type];
    case "CARD":
    case "TASK":
      return trimmed(node.richText.plainText) ?? typeLabels[node.type];
    case "IMAGE":
      return trimmed(node.file?.filename) ?? typeLabels.IMAGE;
    case "FILE":
      return trimmed(node.title) ?? trimmed(node.file?.filename) ?? typeLabels.FILE;
    case "LINK":
      return (
        trimmed(node.title) ??
        trimmed(node.provider?.display) ??
        trimmed(node.provider?.name) ??
        trimmed(node.caption?.plainText) ??
        typeLabels.LINK
      );
    case "TASK_LIST":
      return trimmed(node.title) ?? typeLabels.TASK_LIST;
    case "TABLE":
      return typeLabels.TABLE;
    case "COMMENT_THREAD":
      return typeLabels.COMMENT_THREAD;
    case "SKELETON":
      return typeLabels.SKELETON;
    case "UNKNOWN":
      return trimmed(node.elementType) ?? typeLabels.UNKNOWN;
    default:
      return assertNever(node);
  }
}

export function getNodeDescription(node: MilanoteNode): string | undefined {
  switch (node.type) {
    case "LINK": {
      const caption = trimmed(node.caption?.plainText);
      return caption === getNodeLabel(node) ? undefined : caption;
    }
    case "IMAGE": {
      const width = node.image?.width;
      const height = node.image?.height;
      return width && height ? `${width} × ${height}` : undefined;
    }
    case "FILE":
      return trimmed(node.file?.mimeType) ?? trimmed(node.file?.extension);
    case "BOARD":
    case "COLUMN":
    case "CARD":
    case "TASK_LIST":
    case "TASK":
    case "TABLE":
    case "COMMENT_THREAD":
    case "SKELETON":
    case "UNKNOWN":
      return undefined;
    default:
      return assertNever(node);
  }
}

export function getNodeTypeLabel(type: NodeType): string {
  return typeLabels[type];
}

export function getNodeTypeCode(type: NodeType): string {
  return typeCodes[type];
}

export function getImageUrl(node: MilanoteNode): string | undefined {
  switch (node.type) {
    case "IMAGE":
      return safeHttpUrl(
        node.image?.hugeUrl ??
          node.image?.largeUrl ??
          node.image?.url ??
          node.image?.thumbnailUrl ??
          node.image?.originalUrl,
      );
    case "FILE":
      return safeHttpUrl(
        node.previewImage?.largeUrl ?? node.previewImage?.url ?? node.previewImage?.thumbnailUrl,
      );
    case "BOARD":
      return safeHttpUrl(node.image?.largeUrl ?? node.image?.url ?? node.image?.thumbnailUrl);
    case "COLUMN":
    case "CARD":
    case "LINK":
    case "TASK_LIST":
    case "TASK":
    case "TABLE":
    case "COMMENT_THREAD":
    case "SKELETON":
    case "UNKNOWN":
      return undefined;
    default:
      return assertNever(node);
  }
}

export function getLinkUrl(node: MilanoteNode): string | undefined {
  switch (node.type) {
    case "LINK":
      return safeHttpUrl(node.url);
    case "FILE":
    case "IMAGE":
      return safeHttpUrl(node.file?.url);
    case "BOARD":
      return safeHttpUrl(node.file?.url);
    case "COLUMN":
    case "CARD":
    case "TASK_LIST":
    case "TASK":
    case "TABLE":
    case "COMMENT_THREAD":
    case "SKELETON":
    case "UNKNOWN":
      return undefined;
    default:
      return assertNever(node);
  }
}

export function getFileName(node: MilanoteNode): string {
  if (node.type !== "FILE") {
    return typeLabels.FILE;
  }

  return trimmed(node.title) ?? trimmed(node.file?.filename) ?? "Untitled file";
}

export function getFileSize(node: MilanoteNode): string | undefined {
  const bytes = node.type === "FILE" ? node.file?.sizeBytes : undefined;
  if (bytes === undefined || bytes < 0) {
    return undefined;
  }

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
}

export function isTaskComplete(node: MilanoteNode): boolean {
  return node.type === "TASK" && node.completed === true;
}

export function getTaskDueDate(node: MilanoteNode): string | undefined {
  return node.type === "TASK" ? trimmed(node.dueDate) : undefined;
}

export function getComments(node: MilanoteNode): readonly BoardCommentView[] {
  if (node.type !== "COMMENT_THREAD") {
    return [];
  }

  return node.comments.flatMap((comment) => {
    const text = trimmed(comment.richText.plainText);
    if (!text) {
      return [];
    }

    return [
      {
        ...(comment.userId ? { author: comment.userId } : {}),
        ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
        id: comment.id,
        text,
      },
    ];
  });
}

export function getTableRows(node: MilanoteNode): readonly (readonly string[])[] {
  if (node.type !== "TABLE") {
    return [];
  }

  return node.table.rows.map((row) =>
    row.map((cell) => trimmed(cell.richText?.plainText) ?? cell.value),
  );
}

export function getUnknownKind(node: MilanoteNode): string | undefined {
  return node.type === "UNKNOWN" ? trimmed(node.elementType) : undefined;
}

export function countDescendants(node: MilanoteNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

export function formatFetchedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCompactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(date);
}
