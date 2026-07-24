import { MilanoteParserError } from "./errors.ts";
import {
  isRecord,
  readBoolean,
  readNonEmptyString,
  readNumber,
  readRecord,
  readString,
  readStringArray,
  toJsonValue,
  type UnknownRecord,
} from "./guards.ts";
import { milanoteDocumentSchema } from "./schemas.ts";
import type {
  JsonValue,
  MilanoteBoardNode,
  MilanoteCardNode,
  MilanoteColumnNode,
  MilanoteComment,
  MilanoteCommentThreadNode,
  MilanoteDocument,
  MilanoteFileMedia,
  MilanoteFileNode,
  MilanoteIcon,
  MilanoteImageMedia,
  MilanoteImageNode,
  MilanoteLinkNode,
  MilanoteLocation,
  MilanoteNode,
  MilanoteNodeType,
  MilanotePosition,
  MilanoteRichText,
  MilanoteSkeletonNode,
  MilanoteTableCell,
  MilanoteTableNode,
  MilanoteTaskListNode,
  MilanoteTaskNode,
  MilanoteTimestamps,
  MilanoteUnknownNode,
} from "./schemas.ts";

interface RawElement {
  id: string;
  elementType: string;
  content?: UnknownRecord;
  location: MilanoteLocation;
  timestamps: MilanoteTimestamps;
  rawContent: unknown;
}

interface ParseContext {
  elements: Map<string, RawElement>;
  childrenByParent: Map<string, RawElement[]>;
  canvasOrder: Map<string, string[]>;
  commentsByThread: Map<string, MilanoteComment[]>;
}

interface ParseMilanoteBoardOptions {
  boardId: string;
  fetchedAt?: Date | string;
}

interface NormalizedNodeBase<Type extends MilanoteNodeType> {
  children: MilanoteNode[];
  id: string;
  location: MilanoteLocation;
  timestamps: MilanoteTimestamps;
  type: Type;
}

function toIsoTimestamp(value: unknown): string | undefined {
  const date =
    typeof value === "number" && Number.isFinite(value)
      ? new Date(value)
      : typeof value === "string" && value.trim() !== ""
        ? new Date(value)
        : undefined;

  return date !== undefined && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function parsePosition(value: unknown): MilanotePosition | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const position: MilanotePosition = {};
  const x = readNumber(value, "x");
  const y = readNumber(value, "y");
  const index = readNumber(value, "index");
  const score = readNumber(value, "score");

  if (x !== undefined) position.x = x;
  if (y !== undefined) position.y = y;
  if (index !== undefined) position.index = index;
  if (score !== undefined) position.score = score;

  return Object.keys(position).length > 0 ? position : undefined;
}

function parseLocation(value: unknown): MilanoteLocation {
  if (!isRecord(value)) {
    return {};
  }

  const location: MilanoteLocation = {};
  const parentId = readNonEmptyString(value, "parentId");
  const section = readString(value, "section");
  const rootBoard = readBoolean(value, "rootBoard");
  const position = parsePosition(value.position);

  if (parentId !== undefined) location.parentId = parentId;
  if (section !== undefined) location.section = section;
  if (rootBoard !== undefined) location.rootBoard = rootBoard;
  if (position !== undefined) location.position = position;

  return location;
}

function parseTimestamps(value: unknown): MilanoteTimestamps {
  if (!isRecord(value)) {
    return {};
  }

  const timestamps: MilanoteTimestamps = {};
  const createdAt = toIsoTimestamp(value.createdTime);
  const modifiedAt = toIsoTimestamp(value.modifiedTime);
  const significantModifiedAt = toIsoTimestamp(value.significantModified);
  const locationModifiedAt = toIsoTimestamp(value.locationSectionModifiedTime);

  if (createdAt !== undefined) timestamps.createdAt = createdAt;
  if (modifiedAt !== undefined) timestamps.modifiedAt = modifiedAt;
  if (significantModifiedAt !== undefined) {
    timestamps.significantModifiedAt = significantModifiedAt;
  }
  if (locationModifiedAt !== undefined) {
    timestamps.locationModifiedAt = locationModifiedAt;
  }

  return timestamps;
}

function parseRawElement(key: string, value: unknown): RawElement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id =
    readNonEmptyString(value, "id") ??
    readNonEmptyString(value, "_id") ??
    (key.trim() === "" ? undefined : key);
  const elementType = readNonEmptyString(value, "elementType");

  if (id === undefined || elementType === undefined) {
    return undefined;
  }

  return {
    id,
    elementType,
    content: readRecord(value, "content"),
    location: parseLocation(value.location),
    timestamps: parseTimestamps(value.meta),
    rawContent: value.content,
  };
}

function richTextBlocks(value: unknown): JsonValue[] {
  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (!isRecord(value)) {
    return value === undefined || value === null ? [] : [toJsonValue(value)];
  }

  if (Array.isArray(value.content)) {
    return value.content.map(toJsonValue);
  }

  if (Array.isArray(value.blocks)) {
    return value.blocks.map(toJsonValue);
  }

  return [toJsonValue(value)];
}

function joinPlainText(parts: string[], separator: string): string {
  return parts.filter((part) => part !== "").join(separator);
}

function extractPlainText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return joinPlainText(value.map(extractPlainText), "\n");
  }

  if (!isRecord(value)) {
    return "";
  }

  const directText = readString(value, "text");
  if (directText !== undefined) {
    return directText;
  }

  if (value.type === "hardBreak") {
    return "\n";
  }

  const content = Array.isArray(value.content) ? value.content : undefined;
  if (content !== undefined) {
    const inlineContainer =
      value.type === "paragraph" || value.type === "heading" || value.type === "listItem";
    return joinPlainText(content.map(extractPlainText), inlineContainer ? "" : "\n");
  }

  const blocks = Array.isArray(value.blocks) ? value.blocks : undefined;
  return blocks === undefined ? "" : joinPlainText(blocks.map(extractPlainText), "\n");
}

function parseRichText(value: unknown): MilanoteRichText {
  return {
    blocks: richTextBlocks(value),
    plainText: extractPlainText(value),
  };
}

function parseImage(value: unknown): MilanoteImageMedia | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const image: MilanoteImageMedia = {
    colors: readStringArray(value, "colors"),
  };
  const url =
    readString(value, "regular") ??
    readString(value, "large") ??
    readString(value, "original") ??
    readString(value, "url");
  const originalUrl = readString(value, "original");
  const thumbnailUrl = readString(value, "thumb");
  const largeUrl = readString(value, "large");
  const hugeUrl = readString(value, "huge");
  const width = readNumber(value, "width");
  const height = readNumber(value, "height");
  const primaryColor = readString(value, "primaryColor");
  const transparent = readBoolean(value, "transparent");

  if (url !== undefined) image.url = url;
  if (originalUrl !== undefined) image.originalUrl = originalUrl;
  if (thumbnailUrl !== undefined) image.thumbnailUrl = thumbnailUrl;
  if (largeUrl !== undefined) image.largeUrl = largeUrl;
  if (hugeUrl !== undefined) image.hugeUrl = hugeUrl;
  if (width !== undefined) image.width = width;
  if (height !== undefined) image.height = height;
  if (primaryColor !== undefined) image.primaryColor = primaryColor;
  if (transparent !== undefined) image.transparent = transparent;

  return image.colors.length > 0 || Object.keys(image).length > 1 ? image : undefined;
}

function parseFile(value: unknown): MilanoteFileMedia | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const file: MilanoteFileMedia = {};
  const type = readString(value, "type");
  const extension = readString(value, "ext");
  const mimeType = readString(value, "mime");
  const filename = readString(value, "filename");
  const sizeBytes = readNumber(value, "size");
  const modifiedAt = toIsoTimestamp(value.lastModified);
  const uploadedAt = toIsoTimestamp(value.uploadedTimestamp);
  const url = readString(value, "url");

  if (type !== undefined) file.type = type;
  if (extension !== undefined) file.extension = extension;
  if (mimeType !== undefined) file.mimeType = mimeType;
  if (filename !== undefined) file.filename = filename;
  if (sizeBytes !== undefined) file.sizeBytes = sizeBytes;
  if (modifiedAt !== undefined) file.modifiedAt = modifiedAt;
  if (uploadedAt !== undefined) file.uploadedAt = uploadedAt;
  if (url !== undefined) file.url = url;

  return Object.keys(file).length > 0 ? file : undefined;
}

function parseIcon(value: unknown): MilanoteIcon | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const icon: MilanoteIcon = {};
  const type = readString(value, "type");
  const id = readString(value, "id");
  const name = readString(value, "name");
  const svgUrl = readString(value, "svg");
  const pngUrl = readString(value, "png");

  if (type !== undefined) icon.type = type;
  if (id !== undefined) icon.id = id;
  if (name !== undefined) icon.name = name;
  if (svgUrl !== undefined) icon.svgUrl = svgUrl;
  if (pngUrl !== undefined) icon.pngUrl = pngUrl;

  return icon;
}

function parseComment(key: string, value: unknown): MilanoteComment | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id =
    readNonEmptyString(value, "id") ??
    readNonEmptyString(value, "_id") ??
    (key.trim() === "" ? undefined : key);
  const threadId = readNonEmptyString(value, "threadId");

  if (id === undefined || threadId === undefined) {
    return undefined;
  }

  const comment: MilanoteComment = {
    id,
    threadId,
    richText: parseRichText(value.text),
  };
  const userId = readString(value, "userId");
  const createdAt = toIsoTimestamp(value.createdAt);
  const updatedAt = toIsoTimestamp(value.updatedAt);

  if (userId !== undefined) comment.userId = userId;
  if (createdAt !== undefined) comment.createdAt = createdAt;
  if (updatedAt !== undefined) comment.updatedAt = updatedAt;

  return comment;
}

function parseComments(value: unknown): Map<string, MilanoteComment[]> {
  const commentsByThread = new Map<string, MilanoteComment[]>();
  if (!isRecord(value)) {
    return commentsByThread;
  }

  for (const [key, rawComment] of Object.entries(value)) {
    const comment = parseComment(key, rawComment);
    if (comment === undefined) continue;

    const comments = commentsByThread.get(comment.threadId) ?? [];
    comments.push(comment);
    commentsByThread.set(comment.threadId, comments);
  }

  for (const comments of commentsByThread.values()) {
    comments.sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
  }

  return commentsByThread;
}

function parseCanvasOrder(value: unknown): Map<string, string[]> {
  const canvasOrder = new Map<string, string[]>();
  if (!isRecord(value)) {
    return canvasOrder;
  }

  for (const [parentId, children] of Object.entries(value)) {
    if (Array.isArray(children)) {
      canvasOrder.set(
        parentId,
        children.filter((child): child is string => typeof child === "string"),
      );
    }
  }

  return canvasOrder;
}

function positionValue(element: RawElement, key: keyof MilanotePosition): number {
  return element.location.position?.[key] ?? Number.POSITIVE_INFINITY;
}

function sortChildren(parentId: string, context: ParseContext): RawElement[] {
  const children = [...(context.childrenByParent.get(parentId) ?? [])];
  const canvasOrder = context.canvasOrder.get(parentId) ?? [];
  const canvasIndexes = new Map(canvasOrder.map((childId, index) => [childId, index] as const));

  return children.sort((left, right) => {
    const leftCanvasIndex = canvasIndexes.get(left.id);
    const rightCanvasIndex = canvasIndexes.get(right.id);
    if (leftCanvasIndex !== undefined || rightCanvasIndex !== undefined) {
      if (leftCanvasIndex === undefined) return 1;
      if (rightCanvasIndex === undefined) return -1;
      if (leftCanvasIndex !== rightCanvasIndex) {
        return leftCanvasIndex - rightCanvasIndex;
      }
    }

    const sectionComparison = (left.location.section ?? "").localeCompare(
      right.location.section ?? "",
    );
    if (sectionComparison !== 0) return sectionComparison;

    for (const key of ["score", "index", "y", "x"] as const) {
      const difference = positionValue(left, key) - positionValue(right, key);
      if (Number.isFinite(difference) && difference !== 0) return difference;
    }

    return left.id.localeCompare(right.id);
  });
}

function baseNode<Type extends MilanoteNodeType>(
  raw: RawElement,
  type: Type,
  children: MilanoteNode[],
): NormalizedNodeBase<Type> {
  return {
    id: raw.id,
    type,
    location: raw.location,
    timestamps: raw.timestamps,
    children,
  };
}

function parseTableCell(value: unknown): MilanoteTableCell {
  if (!isRecord(value)) {
    return { value: typeof value === "string" ? value : "", textStyles: [] };
  }

  const cell: MilanoteTableCell = {
    value: readString(value, "value") ?? "",
    textStyles: readStringArray(value, "textStyle"),
  };
  const background = readString(value, "background");
  if (background !== undefined) cell.background = background;

  if (value.draftContent !== undefined) {
    cell.richText = parseRichText(value.draftContent);
    if (cell.value === "") cell.value = cell.richText.plainText;
  }

  return cell;
}

function parseTable(value: unknown): MilanoteTableNode["table"] {
  const emptyTable = { rows: [], columnWidths: [] };
  if (!isRecord(value)) {
    return emptyTable;
  }

  const rows = Array.isArray(value.data)
    ? value.data.map((row) =>
        Array.isArray(row) ? row.map(parseTableCell) : [parseTableCell(row)],
      )
    : [];
  const columnWidths = Array.isArray(value.colWidthsGU)
    ? value.colWidthsGU.filter(
        (width): width is number => typeof width === "number" && Number.isFinite(width),
      )
    : [];
  const table: MilanoteTableNode["table"] = { rows, columnWidths };
  const version = readString(value, "version");
  if (version !== undefined) table.version = version;
  return table;
}

function parseKnownNode(
  raw: RawElement,
  children: MilanoteNode[],
  commentsByThread: Map<string, MilanoteComment[]>,
): MilanoteNode {
  const content = raw.content ?? {};

  switch (raw.elementType) {
    case "BOARD": {
      const node: MilanoteBoardNode = {
        ...baseNode(raw, "BOARD", children),
        title: readString(content, "title") ?? "Untitled board",
        defaultColorPalette: readStringArray(content, "defaultColorPalette"),
      };
      const icon = parseIcon(content.icon);
      const color = readString(content, "color");
      const secondaryColor = readString(content, "secondaryColor");
      const published = readBoolean(content, "published");
      const image = parseImage(content.image);
      const file = parseFile(content.file);
      if (icon !== undefined) node.icon = icon;
      if (color !== undefined) node.color = color;
      if (secondaryColor !== undefined) node.secondaryColor = secondaryColor;
      if (published !== undefined) node.published = published;
      if (image !== undefined) node.image = image;
      if (file !== undefined) node.file = file;
      return node;
    }
    case "COLUMN": {
      const node: MilanoteColumnNode = {
        ...baseNode(raw, "COLUMN", children),
        title: readString(content, "title") ?? "",
      };
      return node;
    }
    case "CARD": {
      const node: MilanoteCardNode = {
        ...baseNode(raw, "CARD", children),
        richText: parseRichText(content.textContent),
      };
      const background = readString(content, "background");
      const transparent = readRecord(content, "transparent");
      const transparentEnabled =
        transparent === undefined
          ? readBoolean(content, "transparent")
          : readBoolean(transparent, "enabled");
      if (background !== undefined) node.background = background;
      if (transparentEnabled !== undefined) node.transparent = transparentEnabled;
      return node;
    }
    case "IMAGE": {
      const node: MilanoteImageNode = baseNode(raw, "IMAGE", children);
      const image = parseImage(content.image);
      const file = parseFile(content.file);
      if (image !== undefined) node.image = image;
      if (file !== undefined) node.file = file;
      return node;
    }
    case "FILE": {
      const node: MilanoteFileNode = baseNode(raw, "FILE", children);
      const title = readString(content, "title");
      const file = parseFile(content.file);
      const previewImage = parseImage(content.image);
      const previewReady = readBoolean(content, "previewReady");
      const displayMode = readString(content, "displayMode");
      if (title !== undefined) node.title = title;
      if (file !== undefined) node.file = file;
      if (previewImage !== undefined) node.previewImage = previewImage;
      if (previewReady !== undefined) node.previewReady = previewReady;
      if (displayMode !== undefined) node.displayMode = displayMode;
      return node;
    }
    case "LINK": {
      const node: MilanoteLinkNode = baseNode(raw, "LINK", children);
      const link = readRecord(content, "link");
      const provider = readRecord(content, "provider");
      const url =
        (link === undefined ? undefined : readString(link, "url")) ?? readString(content, "url");
      const title = link === undefined ? undefined : readString(link, "title");
      const faviconUrl = link === undefined ? undefined : readString(link, "favicon");
      const mediaType = readString(content, "mediaType");
      const showCaption = readBoolean(content, "showCaption");
      if (url !== undefined) node.url = url;
      if (title !== undefined) node.title = title;
      if (faviconUrl !== undefined) node.faviconUrl = faviconUrl;
      if (mediaType !== undefined) node.mediaType = mediaType;
      if (showCaption !== undefined) node.showCaption = showCaption;
      if (content.caption !== undefined) node.caption = parseRichText(content.caption);
      if (provider !== undefined) {
        node.provider = {};
        const providerName = readString(provider, "name");
        const providerUrl = readString(provider, "url");
        const providerDisplay = readString(provider, "display");
        if (providerName !== undefined) node.provider.name = providerName;
        if (providerUrl !== undefined) node.provider.url = providerUrl;
        if (providerDisplay !== undefined) node.provider.display = providerDisplay;
      }
      return node;
    }
    case "TASK_LIST": {
      const node: MilanoteTaskListNode = baseNode(raw, "TASK_LIST", children);
      const title = readString(content, "title");
      const showTitle = readBoolean(content, "showTitle");
      if (title !== undefined) node.title = title;
      if (showTitle !== undefined) node.showTitle = showTitle;
      return node;
    }
    case "TASK": {
      const node: MilanoteTaskNode = {
        ...baseNode(raw, "TASK", children),
        richText: parseRichText(content.textContent),
      };
      const completed = readBoolean(content, "completed") ?? readBoolean(content, "checked");
      const dueDate = readString(content, "dueDate");
      const hasDueDateTime = readBoolean(content, "hasDueDateTime");
      const reminderAt = toIsoTimestamp(content.dueReminderTimestamp);
      if (completed !== undefined) node.completed = completed;
      if (dueDate !== undefined) node.dueDate = dueDate;
      if (hasDueDateTime !== undefined) node.hasDueDateTime = hasDueDateTime;
      if (reminderAt !== undefined) node.reminderAt = reminderAt;
      return node;
    }
    case "TABLE": {
      const node: MilanoteTableNode = {
        ...baseNode(raw, "TABLE", children),
        table: parseTable(content.tableContent),
      };
      const width = readNumber(content, "width");
      if (width !== undefined) node.width = width;
      return node;
    }
    case "COMMENT_THREAD": {
      const threadId = readString(content, "threadId");
      const node: MilanoteCommentThreadNode = {
        ...baseNode(raw, "COMMENT_THREAD", children),
        comments: threadId === undefined ? [] : [...(commentsByThread.get(threadId) ?? [])],
      };
      if (threadId !== undefined) node.threadId = threadId;
      return node;
    }
    case "SKELETON": {
      const node: MilanoteSkeletonNode = {
        ...baseNode(raw, "SKELETON", children),
      };
      if (raw.location.rootBoard !== undefined) {
        node.rootBoard = raw.location.rootBoard;
      }
      return node;
    }
    default: {
      const node: MilanoteUnknownNode = {
        ...baseNode(raw, "UNKNOWN", children),
        elementType: raw.elementType,
        content: toJsonValue(raw.rawContent),
      };
      return node;
    }
  }
}

function buildNode(
  raw: RawElement,
  context: ParseContext,
  ancestors: ReadonlySet<string>,
): MilanoteNode {
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(raw.id);
  const children = sortChildren(raw.id, context)
    .filter((child) => !nextAncestors.has(child.id))
    .map((child) => buildNode(child, context, nextAncestors));

  return parseKnownNode(raw, children, context.commentsByThread);
}

function normalizeFetchedAt(value: Date | string | undefined, raw: UnknownRecord): string {
  const explicit =
    value instanceof Date
      ? toIsoTimestamp(value.getTime())
      : value === undefined
        ? undefined
        : toIsoTimestamp(value);
  return explicit ?? toIsoTimestamp(raw.fetchedTime) ?? new Date().toISOString();
}

function boardErrorCode(
  raw: UnknownRecord,
  boardId: string,
): "BOARD_NOT_FOUND" | "UPSTREAM_ACCESS_DENIED" | "INVALID_UPSTREAM_RESPONSE" | undefined {
  const errors = readRecord(raw, "errors");
  const boardError = errors?.[boardId];
  if (boardError === undefined) return undefined;

  const error = isRecord(boardError) ? readRecord(boardError, "error") : undefined;
  const code = error === undefined ? undefined : readString(error, "code")?.toUpperCase();
  if (
    code === "BOARD_NOT_FOUND" ||
    code === "NOT_FOUND" ||
    code === "DELETED" ||
    code === "BOARD_DELETED"
  ) {
    return "BOARD_NOT_FOUND";
  }
  if (code === "BOARD_ACCESS_DENIED" || code === "ACCESS_DENIED" || code === "PASSWORD_PROTECTED") {
    return "UPSTREAM_ACCESS_DENIED";
  }
  return "INVALID_UPSTREAM_RESPONSE";
}

function boardChildrenWereReturned(raw: UnknownRecord, boardId: string): boolean {
  const childrenReturned = readRecord(raw, "childrenReturned");
  return childrenReturned?.[boardId] === true;
}

export function parseMilanoteBoardResponse(
  input: unknown,
  options: ParseMilanoteBoardOptions,
): MilanoteDocument {
  if (!isRecord(input)) {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  const upstreamErrorCode = boardErrorCode(input, options.boardId);
  if (upstreamErrorCode !== undefined) throw new MilanoteParserError(upstreamErrorCode);

  if (!boardChildrenWereReturned(input, options.boardId)) {
    throw new MilanoteParserError("UPSTREAM_ACCESS_DENIED");
  }

  const rawElements = readRecord(input, "elements");
  if (rawElements === undefined) {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  const elements = new Map<string, RawElement>();
  for (const [key, value] of Object.entries(rawElements)) {
    const element = parseRawElement(key, value);
    if (element !== undefined && !elements.has(element.id)) {
      elements.set(element.id, element);
    }
  }

  const root = elements.get(options.boardId);
  if (root === undefined || root.elementType !== "BOARD") {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  const childrenByParent = new Map<string, RawElement[]>();
  for (const element of elements.values()) {
    const parentId = element.location.parentId;
    if (parentId === undefined) continue;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(element);
    childrenByParent.set(parentId, children);
  }

  const context: ParseContext = {
    elements,
    childrenByParent,
    canvasOrder: parseCanvasOrder(input.canvasOrder),
    commentsByThread: parseComments(input.comments),
  };
  const board = buildNode(root, context, new Set());

  if (board.type !== "BOARD") {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  return milanoteDocumentSchema.parse({
    version: 1,
    source: {
      provider: "milanote",
      boardId: options.boardId,
    },
    fetchedAt: normalizeFetchedAt(options.fetchedAt, input),
    board,
  });
}
