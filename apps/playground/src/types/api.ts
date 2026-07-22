import type { MilanoteDocument } from "@milanote-api/parser";

export interface BoardApiError {
  code: string;
  message: string;
}

export interface BoardApiFailure {
  error: BoardApiError;
  ok: false;
}

export interface BoardApiSuccess {
  data: MilanoteDocument;
  ok: true;
}

export type BoardApiResponse = BoardApiFailure | BoardApiSuccess;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDocument(value: unknown): value is MilanoteDocument {
  if (!isRecord(value) || value.version !== 1 || typeof value.fetchedAt !== "string") {
    return false;
  }

  if (!isRecord(value.source) || value.source.provider !== "milanote") {
    return false;
  }

  return (
    isRecord(value.board) &&
    value.board.type === "BOARD" &&
    typeof value.board.id === "string" &&
    Array.isArray(value.board.children)
  );
}

export function isBoardApiResponse(value: unknown): value is BoardApiResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return isDocument(value.data);
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}
