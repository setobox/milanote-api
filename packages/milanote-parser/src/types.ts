export type MilanoteFetch = typeof globalThis.fetch;

export interface FetchMilanoteBoardOptions {
  fetch?: MilanoteFetch;
  now?: () => Date;
  maxBoards?: number;
  timeoutMs?: number;
}
