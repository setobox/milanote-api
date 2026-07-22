export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MilanoteShareReference {
  boardId: string;
  permissionId: string;
}

export interface MilanoteSource {
  provider: "milanote";
  boardId: string;
}

export interface MilanoteDocument {
  version: 1;
  source: MilanoteSource;
  fetchedAt: string;
  board: MilanoteBoardNode;
}

export interface MilanotePosition {
  x?: number;
  y?: number;
  index?: number;
  score?: number;
}

export interface MilanoteLocation {
  parentId?: string;
  section?: string;
  rootBoard?: boolean;
  position?: MilanotePosition;
}

export interface MilanoteTimestamps {
  createdAt?: string;
  modifiedAt?: string;
  significantModifiedAt?: string;
  locationModifiedAt?: string;
}

export interface MilanoteRichText {
  blocks: JsonValue[];
  plainText: string;
}

export interface MilanoteImageMedia {
  url?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  largeUrl?: string;
  hugeUrl?: string;
  width?: number;
  height?: number;
  primaryColor?: string;
  colors: string[];
  transparent?: boolean;
}

export interface MilanoteFileMedia {
  type?: string;
  extension?: string;
  mimeType?: string;
  filename?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  uploadedAt?: string;
  url?: string;
}

export interface MilanoteIcon {
  type?: string;
  id?: string;
  name?: string;
  svgUrl?: string;
  pngUrl?: string;
}

export interface MilanoteLinkProvider {
  name?: string;
  url?: string;
  display?: string;
}

export interface MilanoteTableCell {
  value: string;
  richText?: MilanoteRichText;
  textStyles: string[];
  background?: string;
}

export interface MilanoteTableData {
  rows: MilanoteTableCell[][];
  columnWidths: number[];
  version?: string;
}

export interface MilanoteComment {
  id: string;
  threadId: string;
  userId?: string;
  richText: MilanoteRichText;
  createdAt?: string;
  updatedAt?: string;
}

export type MilanoteNodeType =
  | "BOARD"
  | "COLUMN"
  | "CARD"
  | "IMAGE"
  | "FILE"
  | "LINK"
  | "TASK_LIST"
  | "TASK"
  | "TABLE"
  | "COMMENT_THREAD"
  | "SKELETON"
  | "UNKNOWN";

export interface MilanoteNodeBase<Type extends MilanoteNodeType> {
  id: string;
  type: Type;
  location: MilanoteLocation;
  timestamps: MilanoteTimestamps;
  children: MilanoteNode[];
}

export interface MilanoteBoardNode extends MilanoteNodeBase<"BOARD"> {
  title: string;
  icon?: MilanoteIcon;
  color?: string;
  secondaryColor?: string;
  defaultColorPalette: string[];
  published?: boolean;
  image?: MilanoteImageMedia;
  file?: MilanoteFileMedia;
}

export interface MilanoteColumnNode extends MilanoteNodeBase<"COLUMN"> {
  title: string;
}

export interface MilanoteCardNode extends MilanoteNodeBase<"CARD"> {
  richText: MilanoteRichText;
  background?: string;
  transparent?: boolean;
}

export interface MilanoteImageNode extends MilanoteNodeBase<"IMAGE"> {
  image?: MilanoteImageMedia;
  file?: MilanoteFileMedia;
}

export interface MilanoteFileNode extends MilanoteNodeBase<"FILE"> {
  title?: string;
  file?: MilanoteFileMedia;
  previewImage?: MilanoteImageMedia;
  previewReady?: boolean;
  displayMode?: string;
}

export interface MilanoteLinkNode extends MilanoteNodeBase<"LINK"> {
  url?: string;
  title?: string;
  faviconUrl?: string;
  mediaType?: string;
  provider?: MilanoteLinkProvider;
  caption?: MilanoteRichText;
  showCaption?: boolean;
}

export interface MilanoteTaskListNode extends MilanoteNodeBase<"TASK_LIST"> {
  title?: string;
  showTitle?: boolean;
}

export interface MilanoteTaskNode extends MilanoteNodeBase<"TASK"> {
  richText: MilanoteRichText;
  completed?: boolean;
  dueDate?: string;
  hasDueDateTime?: boolean;
  reminderAt?: string;
}

export interface MilanoteTableNode extends MilanoteNodeBase<"TABLE"> {
  width?: number;
  table: MilanoteTableData;
}

export interface MilanoteCommentThreadNode extends MilanoteNodeBase<"COMMENT_THREAD"> {
  threadId?: string;
  comments: MilanoteComment[];
}

export interface MilanoteSkeletonNode extends MilanoteNodeBase<"SKELETON"> {
  rootBoard?: boolean;
}

export interface MilanoteUnknownNode extends MilanoteNodeBase<"UNKNOWN"> {
  elementType: string;
  content: JsonValue;
}

export type MilanoteNode =
  | MilanoteBoardNode
  | MilanoteColumnNode
  | MilanoteCardNode
  | MilanoteImageNode
  | MilanoteFileNode
  | MilanoteLinkNode
  | MilanoteTaskListNode
  | MilanoteTaskNode
  | MilanoteTableNode
  | MilanoteCommentThreadNode
  | MilanoteSkeletonNode
  | MilanoteUnknownNode;

export type MilanoteFetch = typeof globalThis.fetch;

export interface FetchMilanoteBoardOptions {
  fetch?: MilanoteFetch;
  now?: () => Date;
  maxBoards?: number;
  timeoutMs?: number;
}

export interface ParseMilanoteBoardOptions {
  boardId: string;
  fetchedAt?: Date | string;
}
