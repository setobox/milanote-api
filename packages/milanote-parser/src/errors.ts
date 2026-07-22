export type MilanoteParserErrorCode =
  | "INVALID_SHARE_URL"
  | "UPSTREAM_REQUEST_FAILED"
  | "UPSTREAM_ACCESS_DENIED"
  | "INVALID_UPSTREAM_RESPONSE"
  | "BOARD_NOT_FOUND";

const ERROR_MESSAGES: Record<MilanoteParserErrorCode, string> = {
  INVALID_SHARE_URL: "The Milanote share URL is invalid.",
  UPSTREAM_REQUEST_FAILED: "Milanote could not be reached.",
  UPSTREAM_ACCESS_DENIED: "The shared Milanote board is not accessible.",
  INVALID_UPSTREAM_RESPONSE: "Milanote returned an invalid response.",
  BOARD_NOT_FOUND: "The shared Milanote board was not found.",
};

export class MilanoteParserError extends Error {
  readonly code: MilanoteParserErrorCode;
  readonly status?: number;

  constructor(code: MilanoteParserErrorCode, options: { status?: number } = {}) {
    super(ERROR_MESSAGES[code]);
    this.name = "MilanoteParserError";
    this.code = code;
    this.status = options.status;
  }
}
