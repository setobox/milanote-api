import { z } from "zod";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const MILANOTE_HOSTNAME = "app.milanote.com";

function isMilanoteShareUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const permissionValues = url.searchParams.getAll("p");
    const boardId = decodeURIComponent(pathSegments[0] ?? "");
    const permissionId = permissionValues[0] ?? "";

    return (
      url.protocol === "https:" &&
      url.hostname === MILANOTE_HOSTNAME &&
      (url.port === "" || url.port === "443") &&
      url.username === "" &&
      url.password === "" &&
      permissionValues.length === 1 &&
      IDENTIFIER_PATTERN.test(boardId) &&
      IDENTIFIER_PATTERN.test(permissionId)
    );
  } catch {
    return false;
  }
}

export const jsonPrimitiveSchema = z.union([z.boolean(), z.number(), z.string(), z.null()]);
export const jsonValueSchema = z.json();

export const milanoteShareUrlSchema = z.string().trim().min(1).max(2048).refine(isMilanoteShareUrl);

export const milanoteShareReferenceSchema = z.object({
  boardId: z.string().regex(IDENTIFIER_PATTERN),
  permissionId: z.string().regex(IDENTIFIER_PATTERN),
});

export const milanoteSourceSchema = z.object({
  provider: z.literal("milanote"),
  boardId: z.string(),
});

export const milanotePositionSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  index: z.number().optional(),
  score: z.number().optional(),
});

export const milanoteLocationSchema = z.object({
  parentId: z.string().optional(),
  section: z.string().optional(),
  rootBoard: z.boolean().optional(),
  position: milanotePositionSchema.optional(),
});

export const milanoteTimestampsSchema = z.object({
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  significantModifiedAt: z.string().optional(),
  locationModifiedAt: z.string().optional(),
});

export const milanoteRichTextSchema = z.object({
  blocks: z.array(jsonValueSchema),
  plainText: z.string(),
});

export const milanoteImageMediaSchema = z.object({
  url: z.string().optional(),
  originalUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  largeUrl: z.string().optional(),
  hugeUrl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  primaryColor: z.string().optional(),
  colors: z.array(z.string()),
  transparent: z.boolean().optional(),
});

export const milanoteFileMediaSchema = z.object({
  type: z.string().optional(),
  extension: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  sizeBytes: z.number().optional(),
  modifiedAt: z.string().optional(),
  uploadedAt: z.string().optional(),
  url: z.string().optional(),
});

export const milanoteIconSchema = z.object({
  type: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  svgUrl: z.string().optional(),
  pngUrl: z.string().optional(),
});

export const milanoteLinkProviderSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  display: z.string().optional(),
});

export const milanoteTableCellSchema = z.object({
  value: z.string(),
  richText: milanoteRichTextSchema.optional(),
  textStyles: z.array(z.string()),
  background: z.string().optional(),
});

export const milanoteTableDataSchema = z.object({
  rows: z.array(z.array(milanoteTableCellSchema)),
  columnWidths: z.array(z.number()),
  version: z.string().optional(),
});

export const milanoteCommentSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  userId: z.string().optional(),
  richText: milanoteRichTextSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const milanoteNodeTypeSchema = z.enum([
  "BOARD",
  "COLUMN",
  "CARD",
  "IMAGE",
  "FILE",
  "LINK",
  "TASK_LIST",
  "TASK",
  "TABLE",
  "COMMENT_THREAD",
  "SKELETON",
  "UNKNOWN",
]);

const nodeBaseShape = {
  id: z.string(),
  location: milanoteLocationSchema,
  timestamps: milanoteTimestampsSchema,
};

const milanoteBoardNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("BOARD"),
  title: z.string(),
  icon: milanoteIconSchema.optional(),
  color: z.string().optional(),
  secondaryColor: z.string().optional(),
  defaultColorPalette: z.array(z.string()),
  published: z.boolean().optional(),
  image: milanoteImageMediaSchema.optional(),
  file: milanoteFileMediaSchema.optional(),
});

const milanoteColumnNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("COLUMN"),
  title: z.string(),
});

const milanoteCardNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("CARD"),
  richText: milanoteRichTextSchema,
  background: z.string().optional(),
  transparent: z.boolean().optional(),
});

const milanoteImageNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("IMAGE"),
  image: milanoteImageMediaSchema.optional(),
  file: milanoteFileMediaSchema.optional(),
});

const milanoteFileNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("FILE"),
  title: z.string().optional(),
  file: milanoteFileMediaSchema.optional(),
  previewImage: milanoteImageMediaSchema.optional(),
  previewReady: z.boolean().optional(),
  displayMode: z.string().optional(),
});

const milanoteLinkNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("LINK"),
  url: z.string().optional(),
  title: z.string().optional(),
  faviconUrl: z.string().optional(),
  mediaType: z.string().optional(),
  provider: milanoteLinkProviderSchema.optional(),
  caption: milanoteRichTextSchema.optional(),
  showCaption: z.boolean().optional(),
});

const milanoteTaskListNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("TASK_LIST"),
  title: z.string().optional(),
  showTitle: z.boolean().optional(),
});

const milanoteTaskNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("TASK"),
  richText: milanoteRichTextSchema,
  completed: z.boolean().optional(),
  dueDate: z.string().optional(),
  hasDueDateTime: z.boolean().optional(),
  reminderAt: z.string().optional(),
});

const milanoteTableNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("TABLE"),
  width: z.number().optional(),
  table: milanoteTableDataSchema,
});

const milanoteCommentThreadNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("COMMENT_THREAD"),
  threadId: z.string().optional(),
  comments: z.array(milanoteCommentSchema),
});

const milanoteSkeletonNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("SKELETON"),
  rootBoard: z.boolean().optional(),
});

const milanoteUnknownNodeDataSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("UNKNOWN"),
  elementType: z.string(),
  content: jsonValueSchema,
});

interface RecursiveNode {
  children: MilanoteNode[];
}

export interface MilanoteBoardNode
  extends z.infer<typeof milanoteBoardNodeDataSchema>, RecursiveNode {}
export interface MilanoteColumnNode
  extends z.infer<typeof milanoteColumnNodeDataSchema>, RecursiveNode {}
export interface MilanoteCardNode
  extends z.infer<typeof milanoteCardNodeDataSchema>, RecursiveNode {}
export interface MilanoteImageNode
  extends z.infer<typeof milanoteImageNodeDataSchema>, RecursiveNode {}
export interface MilanoteFileNode
  extends z.infer<typeof milanoteFileNodeDataSchema>, RecursiveNode {}
export interface MilanoteLinkNode
  extends z.infer<typeof milanoteLinkNodeDataSchema>, RecursiveNode {}
export interface MilanoteTaskListNode
  extends z.infer<typeof milanoteTaskListNodeDataSchema>, RecursiveNode {}
export interface MilanoteTaskNode
  extends z.infer<typeof milanoteTaskNodeDataSchema>, RecursiveNode {}
export interface MilanoteTableNode
  extends z.infer<typeof milanoteTableNodeDataSchema>, RecursiveNode {}
export interface MilanoteCommentThreadNode
  extends z.infer<typeof milanoteCommentThreadNodeDataSchema>, RecursiveNode {}
export interface MilanoteSkeletonNode
  extends z.infer<typeof milanoteSkeletonNodeDataSchema>, RecursiveNode {}
export interface MilanoteUnknownNode
  extends z.infer<typeof milanoteUnknownNodeDataSchema>, RecursiveNode {}

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

export const milanoteNodeSchema: z.ZodType<MilanoteNode> = z.lazy(() =>
  z.union([
    milanoteBoardNodeSchema,
    milanoteColumnNodeSchema,
    milanoteCardNodeSchema,
    milanoteImageNodeSchema,
    milanoteFileNodeSchema,
    milanoteLinkNodeSchema,
    milanoteTaskListNodeSchema,
    milanoteTaskNodeSchema,
    milanoteTableNodeSchema,
    milanoteCommentThreadNodeSchema,
    milanoteSkeletonNodeSchema,
    milanoteUnknownNodeSchema,
  ]),
);

const childrenShape = {
  children: z.array(milanoteNodeSchema),
};

export const milanoteBoardNodeSchema: z.ZodType<MilanoteBoardNode> =
  milanoteBoardNodeDataSchema.extend(childrenShape);
export const milanoteColumnNodeSchema: z.ZodType<MilanoteColumnNode> =
  milanoteColumnNodeDataSchema.extend(childrenShape);
export const milanoteCardNodeSchema: z.ZodType<MilanoteCardNode> =
  milanoteCardNodeDataSchema.extend(childrenShape);
export const milanoteImageNodeSchema: z.ZodType<MilanoteImageNode> =
  milanoteImageNodeDataSchema.extend(childrenShape);
export const milanoteFileNodeSchema: z.ZodType<MilanoteFileNode> =
  milanoteFileNodeDataSchema.extend(childrenShape);
export const milanoteLinkNodeSchema: z.ZodType<MilanoteLinkNode> =
  milanoteLinkNodeDataSchema.extend(childrenShape);
export const milanoteTaskListNodeSchema: z.ZodType<MilanoteTaskListNode> =
  milanoteTaskListNodeDataSchema.extend(childrenShape);
export const milanoteTaskNodeSchema: z.ZodType<MilanoteTaskNode> =
  milanoteTaskNodeDataSchema.extend(childrenShape);
export const milanoteTableNodeSchema: z.ZodType<MilanoteTableNode> =
  milanoteTableNodeDataSchema.extend(childrenShape);
export const milanoteCommentThreadNodeSchema: z.ZodType<MilanoteCommentThreadNode> =
  milanoteCommentThreadNodeDataSchema.extend(childrenShape);
export const milanoteSkeletonNodeSchema: z.ZodType<MilanoteSkeletonNode> =
  milanoteSkeletonNodeDataSchema.extend(childrenShape);
export const milanoteUnknownNodeSchema: z.ZodType<MilanoteUnknownNode> =
  milanoteUnknownNodeDataSchema.extend(childrenShape);

export const milanoteNodeBaseSchema = z.object({
  ...nodeBaseShape,
  type: milanoteNodeTypeSchema,
  children: z.array(milanoteNodeSchema),
});

export const milanoteDocumentSchema = z.object({
  version: z.literal(1),
  source: milanoteSourceSchema,
  fetchedAt: z.string(),
  board: milanoteBoardNodeSchema,
});

export type JsonPrimitive = z.infer<typeof jsonPrimitiveSchema>;
export type JsonValue = z.infer<typeof jsonValueSchema>;
export type MilanoteShareReference = z.infer<typeof milanoteShareReferenceSchema>;
export type MilanoteSource = z.infer<typeof milanoteSourceSchema>;
export type MilanotePosition = z.infer<typeof milanotePositionSchema>;
export type MilanoteLocation = z.infer<typeof milanoteLocationSchema>;
export type MilanoteTimestamps = z.infer<typeof milanoteTimestampsSchema>;
export type MilanoteRichText = z.infer<typeof milanoteRichTextSchema>;
export type MilanoteImageMedia = z.infer<typeof milanoteImageMediaSchema>;
export type MilanoteFileMedia = z.infer<typeof milanoteFileMediaSchema>;
export type MilanoteIcon = z.infer<typeof milanoteIconSchema>;
export type MilanoteLinkProvider = z.infer<typeof milanoteLinkProviderSchema>;
export type MilanoteTableCell = z.infer<typeof milanoteTableCellSchema>;
export type MilanoteTableData = z.infer<typeof milanoteTableDataSchema>;
export type MilanoteComment = z.infer<typeof milanoteCommentSchema>;
export type MilanoteNodeType = z.infer<typeof milanoteNodeTypeSchema>;
export type MilanoteNodeBase<Type extends MilanoteNodeType> = Omit<
  z.infer<typeof milanoteNodeBaseSchema>,
  "type"
> & {
  type: Type;
};
export type MilanoteDocument = z.infer<typeof milanoteDocumentSchema>;
