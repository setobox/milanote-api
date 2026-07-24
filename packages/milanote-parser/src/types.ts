export type * from "./schemas.ts";

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
