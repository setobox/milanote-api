import { jsonValueSchema, type JsonValue, type MilanoteDocument } from "@milanote-api/parser";

export const MAX_FIELD_SELECTORS = 100;
export const MAX_FIELD_SELECTOR_DEPTH = 20;

const MAX_FIELD_SELECTOR_LENGTH = 8192;
const FIELD_SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const OMIT = Symbol("omit");

const deniedFieldNames = new Set([
  "accesstoken",
  "internalid",
  "permission",
  "permissionid",
  "privatemetadata",
  "token",
  "userid",
]);

export const fieldViews = {
  compact: [
    "version",
    "source.provider",
    "source.boardId",
    "board.**.id",
    "board.**.type",
    "board.**.title",
  ],
  standard: [
    "version",
    "source",
    "fetchedAt",
    "board.id",
    "board.type",
    "board.title",
    "board.color",
    "board.children",
  ],
  full: ["**"],
} as const;

export type FieldSelectorParameter = "exclude" | "include";
export type FieldView = keyof typeof fieldViews;

export type FieldSelection =
  | {
      exclude?: readonly string[];
      include?: never;
      view: FieldView;
    }
  | {
      exclude?: never;
      include: readonly string[];
      view?: never;
    };

export class FieldSelectorError extends Error {
  readonly field: FieldSelectorParameter;

  constructor(field: FieldSelectorParameter, message: string) {
    super(message);
    this.name = "FieldSelectorError";
    this.field = field;
  }
}

interface FieldSchemaNode {
  fields: Record<string, FieldSchemaNode>;
  id: number;
}

interface CompiledSelector {
  segments: readonly string[];
}

interface SelectorState {
  positions: ReadonlySet<number>;
  selector: CompiledSelector;
}

let fieldSchemaId = 0;

function fieldSchema(fields: Record<string, FieldSchemaNode> = {}): FieldSchemaNode {
  fieldSchemaId += 1;
  return { fields, id: fieldSchemaId };
}

const valueField = fieldSchema();
const positionField = fieldSchema({
  index: valueField,
  score: valueField,
  x: valueField,
  y: valueField,
});
const locationField = fieldSchema({
  parentId: valueField,
  position: positionField,
  rootBoard: valueField,
  section: valueField,
});
const timestampsField = fieldSchema({
  createdAt: valueField,
  locationModifiedAt: valueField,
  modifiedAt: valueField,
  significantModifiedAt: valueField,
});
const richTextField = fieldSchema({
  blocks: valueField,
  plainText: valueField,
});
const imageField = fieldSchema({
  colors: valueField,
  height: valueField,
  hugeUrl: valueField,
  largeUrl: valueField,
  originalUrl: valueField,
  primaryColor: valueField,
  thumbnailUrl: valueField,
  transparent: valueField,
  url: valueField,
  width: valueField,
});
const fileField = fieldSchema({
  extension: valueField,
  filename: valueField,
  mimeType: valueField,
  modifiedAt: valueField,
  sizeBytes: valueField,
  type: valueField,
  uploadedAt: valueField,
  url: valueField,
});
const iconField = fieldSchema({
  id: valueField,
  name: valueField,
  pngUrl: valueField,
  svgUrl: valueField,
  type: valueField,
});
const linkProviderField = fieldSchema({
  display: valueField,
  name: valueField,
  url: valueField,
});
const tableCellField = fieldSchema({
  background: valueField,
  richText: richTextField,
  textStyles: valueField,
  value: valueField,
});
const tableField = fieldSchema({
  columnWidths: valueField,
  rows: tableCellField,
  version: valueField,
});
const commentField = fieldSchema({
  createdAt: valueField,
  id: valueField,
  richText: richTextField,
  threadId: valueField,
  updatedAt: valueField,
});
const sourceField = fieldSchema({
  boardId: valueField,
  provider: valueField,
});

const nodeField = fieldSchema();
Object.assign(nodeField.fields, {
  background: valueField,
  caption: richTextField,
  children: nodeField,
  color: valueField,
  comments: commentField,
  completed: valueField,
  content: valueField,
  defaultColorPalette: valueField,
  displayMode: valueField,
  dueDate: valueField,
  elementType: valueField,
  faviconUrl: valueField,
  file: fileField,
  hasDueDateTime: valueField,
  icon: iconField,
  id: valueField,
  image: imageField,
  location: locationField,
  mediaType: valueField,
  previewImage: imageField,
  previewReady: valueField,
  provider: linkProviderField,
  published: valueField,
  reminderAt: valueField,
  richText: richTextField,
  rootBoard: valueField,
  secondaryColor: valueField,
  showCaption: valueField,
  showTitle: valueField,
  table: tableField,
  threadId: valueField,
  timestamps: timestampsField,
  title: valueField,
  transparent: valueField,
  type: valueField,
  url: valueField,
  width: valueField,
});

const boardField = fieldSchema({
  children: nodeField,
  color: valueField,
  defaultColorPalette: valueField,
  file: fileField,
  icon: iconField,
  id: valueField,
  image: imageField,
  location: locationField,
  published: valueField,
  secondaryColor: valueField,
  timestamps: timestampsField,
  title: valueField,
  type: valueField,
});

const documentField = fieldSchema({
  board: boardField,
  fetchedAt: valueField,
  source: sourceField,
  version: valueField,
});

function schemaMatches(
  node: FieldSchemaNode,
  segments: readonly string[],
  index: number,
  visited: Set<string>,
): boolean {
  if (index === segments.length) {
    return true;
  }

  const visitKey = `${node.id}:${index}`;
  if (visited.has(visitKey)) {
    return false;
  }
  visited.add(visitKey);

  const segment = segments[index];
  if (segment === "**") {
    if (schemaMatches(node, segments, index + 1, visited)) {
      return true;
    }

    return Object.values(node.fields).some((child) =>
      schemaMatches(child, segments, index, visited),
    );
  }

  if (segment === "*") {
    return Object.values(node.fields).some((child) =>
      schemaMatches(child, segments, index + 1, visited),
    );
  }

  const child = segment === undefined ? undefined : node.fields[segment];
  return child ? schemaMatches(child, segments, index + 1, visited) : false;
}

function validateSelector(selector: string, field: FieldSelectorParameter): readonly string[] {
  const segments = selector.split(".");

  if (
    segments.some(
      (segment) => segment !== "*" && segment !== "**" && !FIELD_SEGMENT_PATTERN.test(segment),
    )
  ) {
    throw new FieldSelectorError(field, `Invalid ${field} field selector syntax.`);
  }

  if (segments.length > MAX_FIELD_SELECTOR_DEPTH) {
    throw new FieldSelectorError(
      field,
      `${field} field selectors cannot exceed ${MAX_FIELD_SELECTOR_DEPTH} segments.`,
    );
  }

  if (!schemaMatches(documentField, segments, 0, new Set())) {
    throw new FieldSelectorError(field, `Unknown field selector: ${selector}`);
  }

  return segments;
}

export function parseFieldSelectors(
  input: string,
  field: FieldSelectorParameter,
): readonly string[] {
  if (input.length === 0 || input.length > MAX_FIELD_SELECTOR_LENGTH) {
    throw new FieldSelectorError(
      field,
      `${field} must contain a comma-separated field selector list.`,
    );
  }

  const selectors = input.split(",").map((selector) => selector.trim());
  if (selectors.some((selector) => selector.length === 0)) {
    throw new FieldSelectorError(field, `${field} must not contain an empty field selector.`);
  }

  if (selectors.length > MAX_FIELD_SELECTORS) {
    throw new FieldSelectorError(
      field,
      `${field} cannot contain more than ${MAX_FIELD_SELECTORS} field selectors.`,
    );
  }

  const uniqueSelectors = [...new Set(selectors)];
  for (const selector of uniqueSelectors) {
    validateSelector(selector, field);
  }

  return uniqueSelectors;
}

function compileSelectors(selectors: readonly string[]): readonly CompiledSelector[] {
  return selectors.map((selector) => ({ segments: selector.split(".") }));
}

function closeGlobstars(
  selector: CompiledSelector,
  positions: ReadonlySet<number>,
): ReadonlySet<number> {
  const closed = new Set(positions);
  const queue = [...closed];

  while (queue.length > 0) {
    const position = queue.shift();
    if (
      position !== undefined &&
      selector.segments[position] === "**" &&
      !closed.has(position + 1)
    ) {
      closed.add(position + 1);
      queue.push(position + 1);
    }
  }

  return closed;
}

function initialStates(selectors: readonly CompiledSelector[]): readonly SelectorState[] {
  return selectors.map((selector) => ({
    positions: closeGlobstars(selector, new Set([0])),
    selector,
  }));
}

function advanceStates(
  states: readonly SelectorState[],
  fieldName: string,
): readonly SelectorState[] {
  return states.flatMap((state) => {
    const nextPositions = new Set<number>();

    for (const position of state.positions) {
      const segment = state.selector.segments[position];
      if (segment === "**") {
        nextPositions.add(position);
      } else if (segment === "*" || segment === fieldName) {
        nextPositions.add(position + 1);
      }
    }

    if (nextPositions.size === 0) {
      return [];
    }

    return [
      {
        positions: closeGlobstars(state.selector, nextPositions),
        selector: state.selector,
      },
    ];
  });
}

function hasCompleteSelector(states: readonly SelectorState[]): boolean {
  return states.some((state) => state.positions.has(state.selector.segments.length));
}

function statesMatchingSchema(
  states: readonly SelectorState[],
  schema: FieldSchemaNode,
): readonly SelectorState[] {
  return states.filter((state) =>
    [...state.positions].some((position) =>
      schemaMatches(schema, state.selector.segments, position, new Set()),
    ),
  );
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyJsonObject(value: JsonValue): boolean {
  return isJsonObject(value) && Object.keys(value).length === 0;
}

function omitEmptyObjects(value: JsonValue): JsonValue | typeof OMIT {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const included = omitEmptyObjects(item);
      return included === OMIT ? [] : [included];
    });
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const result: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    const included = omitEmptyObjects(child);
    if (included !== OMIT) {
      result[key] = included;
    }
  }

  return Object.keys(result).length === 0 ? OMIT : result;
}

function sanitizeValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const entries = Object.entries(value);
  const result: Record<string, JsonValue> = {};

  for (const [key, child] of entries) {
    if (deniedFieldNames.has(key.toLowerCase())) {
      continue;
    }

    const sanitized = sanitizeValue(child);
    result[key] = sanitized;
  }

  return result;
}

function includeValue(
  value: JsonValue,
  states: readonly SelectorState[],
  schema: FieldSchemaNode,
): JsonValue | typeof OMIT {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const included = includeValue(item, states, schema);
      return included === OMIT || isEmptyJsonObject(included) ? [] : [included];
    });
  }

  if (!isJsonObject(value)) {
    return OMIT;
  }

  const result: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    const childSchema = schema.fields[key];
    if (!childSchema) {
      continue;
    }

    const childStates = statesMatchingSchema(advanceStates(states, key), childSchema);
    if (childStates.length === 0) {
      continue;
    }

    if (hasCompleteSelector(childStates)) {
      const included = omitEmptyObjects(child);
      if (included !== OMIT) {
        result[key] = included;
      }
      continue;
    }

    const included = includeValue(child, childStates, childSchema);
    if (included !== OMIT && !isEmptyJsonObject(included)) {
      result[key] = included;
    }
  }

  return Object.keys(result).length === 0 ? OMIT : result;
}

function excludeValue(value: JsonValue, states: readonly SelectorState[]): JsonValue | typeof OMIT {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const excluded = excludeValue(item, states);
      return excluded === OMIT ? [] : [excluded];
    });
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const entries = Object.entries(value);
  const result: Record<string, JsonValue> = {};
  for (const [key, child] of entries) {
    const childStates = advanceStates(states, key);
    if (hasCompleteSelector(childStates)) {
      continue;
    }

    const excluded = childStates.length === 0 ? child : excludeValue(child, childStates);
    if (excluded !== OMIT) {
      result[key] = excluded;
    }
  }

  return entries.length > 0 && Object.keys(result).length === 0 ? OMIT : result;
}

function includeSelectors(value: JsonValue, selectors: readonly string[]): JsonValue {
  const included = includeValue(value, initialStates(compileSelectors(selectors)), documentField);
  return included === OMIT ? {} : included;
}

function excludeSelectors(value: JsonValue, selectors: readonly string[]): JsonValue {
  const excluded = excludeValue(value, initialStates(compileSelectors(selectors)));
  return excluded === OMIT ? {} : excluded;
}

export function selectDocumentFields(
  document: MilanoteDocument,
  selection: FieldSelection,
): JsonValue {
  const jsonDocument = jsonValueSchema.parse(document);
  const safeDocument = sanitizeValue(jsonDocument);

  const selected = selection.include
    ? includeSelectors(safeDocument, selection.include)
    : selection.view === "full"
      ? safeDocument
      : includeSelectors(safeDocument, fieldViews[selection.view]);

  return selection.exclude ? excludeSelectors(selected, selection.exclude) : selected;
}
