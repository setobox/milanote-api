export type MilanoteFetch = typeof globalThis.fetch;

export interface FetchMilanoteBoardOptions {
  fetch?: MilanoteFetch;
  now?: () => Date;
  maxBoards?: number;
  timeoutMs?: number;
  scope?: BoardScope;
  signal?: AbortSignal;
}

export type BoardScope = "root" | "tree";
export type FetchStage = "permission" | "boards" | "parse";
export interface BoardWarning {
  code: "SUB_BOARDS_NOT_EXPANDED" | "BOARD_LIMIT_REACHED" | "SUB_BOARD_FAILED";
  boardIds: string[];
}
export interface BoardDiagnostics {
  scope: BoardScope;
  complete: boolean;
  warnings: BoardWarning[];
  unloadedBoardIds: string[];
  upstreamRequests: number;
  timings: Record<FetchStage | "total", number>;
}
