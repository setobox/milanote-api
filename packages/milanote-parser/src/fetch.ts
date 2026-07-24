import { MilanoteParserError } from "./errors.ts";
import { isRecord, readNonEmptyString, readString, type UnknownRecord } from "./guards.ts";
import { parseMilanoteBoardResponse } from "./parse.ts";
import type { MilanoteDocument } from "./schemas.ts";
import { parseMilanoteShareUrl } from "./share-url.ts";
import type { FetchMilanoteBoardOptions, MilanoteFetch } from "./types.ts";

const MILANOTE_ORIGIN = "https://app.milanote.com";
const BOARD_BATCH_SIZE = 50;
const DEFAULT_MAX_BOARDS = 100;
const DEFAULT_TIMEOUT_MS = 15_000;

interface MergedBoardResponse {
  elements: UnknownRecord;
  comments: UnknownRecord;
  labels: UnknownRecord;
  errors: UnknownRecord;
  childrenReturned: UnknownRecord;
  canvasOrder: UnknownRecord;
  boardIds: string[];
  fetchedTime?: unknown;
}

async function requestJson(
  fetcher: MilanoteFetch,
  url: URL,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal,
    });
  } catch {
    throw new MilanoteParserError("UPSTREAM_REQUEST_FAILED");
  }

  if (!response.ok) {
    throw new MilanoteParserError("UPSTREAM_REQUEST_FAILED", {
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }
}

function readPermissionToken(value: unknown): string {
  if (!isRecord(value)) {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  const token = readNonEmptyString(value, "token");
  if (value.token === null || value.token === undefined) {
    throw new MilanoteParserError("UPSTREAM_ACCESS_DENIED");
  }
  if (
    token === undefined ||
    token.trim() !== token ||
    token.length > 8192 ||
    hasControlCharacter(token)
  ) {
    throw new MilanoteParserError("INVALID_UPSTREAM_RESPONSE");
  }

  return token;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit < 32 || codeUnit === 127) return true;
  }
  return false;
}

function normalizeMaxBoards(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_BOARDS;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("maxBoards must be a positive safe integer.");
  }
  return value;
}

function normalizeTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("timeoutMs must be a positive safe integer.");
  }
  return value;
}

function makeBoardUrl(boardIds: string[], token: string): URL {
  const boardUrl = new URL("/api/boards", MILANOTE_ORIGIN);
  boardUrl.searchParams.set("ids", boardIds.join(","));
  boardUrl.searchParams.set("tokens", token);
  boardUrl.searchParams.set("excludeSelf", "false");
  boardUrl.searchParams.set("loadAncestors", "false");
  boardUrl.searchParams.set("canvasOrder", "true");
  return boardUrl;
}

function mergeRecord(target: UnknownRecord, source: unknown): void {
  if (!isRecord(source)) return;
  for (const [key, value] of Object.entries(source)) {
    target[key] = value;
  }
}

function mergeElements(target: UnknownRecord, source: unknown): void {
  if (!isRecord(source)) return;
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    const existingType = isRecord(existing) ? readString(existing, "elementType") : undefined;
    const incomingType = isRecord(value) ? readString(value, "elementType") : undefined;
    if (existingType === "BOARD" && incomingType === "SKELETON") continue;
    target[key] = value;
  }
}

function createMergedResponse(): MergedBoardResponse {
  return {
    elements: {},
    comments: {},
    labels: {},
    errors: {},
    childrenReturned: {},
    canvasOrder: {},
    boardIds: [],
  };
}

function mergeBoardResponse(target: MergedBoardResponse, source: unknown): void {
  if (!isRecord(source)) return;
  mergeElements(target.elements, source.elements);
  mergeRecord(target.comments, source.comments);
  mergeRecord(target.labels, source.labels);
  mergeRecord(target.errors, source.errors);
  mergeRecord(target.childrenReturned, source.childrenReturned);
  mergeRecord(target.canvasOrder, source.canvasOrder);

  if (Array.isArray(source.boardIds)) {
    for (const id of source.boardIds) {
      if (typeof id === "string" && !target.boardIds.includes(id)) {
        target.boardIds.push(id);
      }
    }
  }
  if (source.fetchedTime !== undefined) target.fetchedTime = source.fetchedTime;
}

function discoverBoardIds(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const boardIds: string[] = [];
  for (const [key, element] of Object.entries(value)) {
    if (!isRecord(element) || readString(element, "elementType") !== "BOARD") {
      continue;
    }
    const id = readNonEmptyString(element, "id") ?? readNonEmptyString(element, "_id") ?? key;
    if (id.trim() !== "" && !boardIds.includes(id)) boardIds.push(id);
  }
  return boardIds;
}

async function fetchBoardTree(
  fetcher: MilanoteFetch,
  rootBoardId: string,
  token: string,
  maxBoards: number,
  signal: AbortSignal,
): Promise<MergedBoardResponse> {
  const merged = createMergedResponse();
  const queued = new Set<string>([rootBoardId]);
  const visited = new Set<string>();
  const pending = [rootBoardId];

  while (pending.length > 0 && visited.size < maxBoards) {
    const remainingCapacity = maxBoards - visited.size;
    const batch = pending.splice(0, Math.min(BOARD_BATCH_SIZE, remainingCapacity));
    for (const id of batch) visited.add(id);

    let response: unknown;
    try {
      response = await requestJson(fetcher, makeBoardUrl(batch, token), signal);
    } catch (error: unknown) {
      if (batch.includes(rootBoardId) || signal.aborted) throw error;
      continue;
    }

    mergeBoardResponse(merged, response);

    for (const boardId of discoverBoardIds(isRecord(response) ? response.elements : undefined)) {
      if (
        !visited.has(boardId) &&
        !queued.has(boardId) &&
        visited.size + pending.length < maxBoards
      ) {
        queued.add(boardId);
        pending.push(boardId);
      }
    }
  }

  return merged;
}

export async function fetchMilanoteBoard(
  shareUrl: string,
  options: FetchMilanoteBoardOptions = {},
): Promise<MilanoteDocument> {
  const { boardId, permissionId } = parseMilanoteShareUrl(shareUrl);
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new MilanoteParserError("UPSTREAM_REQUEST_FAILED");
  }

  const maxBoards = normalizeMaxBoards(options.maxBoards);
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const permissionUrl = new URL(
      `/api/permissions/token/${encodeURIComponent(permissionId)}`,
      MILANOTE_ORIGIN,
    );
    permissionUrl.searchParams.set("elementId", boardId);
    const permissionResponse = await requestJson(fetcher, permissionUrl, controller.signal);
    const token = readPermissionToken(permissionResponse);
    const boardResponse = await fetchBoardTree(
      fetcher,
      boardId,
      token,
      maxBoards,
      controller.signal,
    );

    return parseMilanoteBoardResponse(boardResponse, {
      boardId,
      fetchedAt: options.now?.() ?? new Date(),
    });
  } finally {
    clearTimeout(timeout);
  }
}
