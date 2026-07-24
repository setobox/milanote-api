import {
  fetchMilanoteBoard,
  MilanoteParserError,
  milanoteDocumentSchema,
  milanoteShareUrlSchema,
  type MilanoteDocument,
} from "@milanote-api/parser";

import {
  boardApiErrorSchema,
  boardApiProjectionSuccessSchema,
  type BoardApiError,
} from "../src/types/api.ts";
import {
  FieldSelectorError,
  parseFieldSelectors,
  selectDocumentFields,
  type FieldSelection,
  type FieldView,
} from "./field-selectors.ts";

export type BoardLoader = (shareUrl: string) => Promise<MilanoteDocument>;

export interface WorkerDependencies {
  loader: BoardLoader;
}

export interface WorkerApp {
  fetch(request: Request): Promise<Response>;
}

interface ErrorBody {
  error: BoardApiError;
  ok: false;
}

interface SuccessBody<T> {
  data: T;
  ok: true;
}

const BOARD_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const NO_STORE = "no-store";

const defaultDependencies: WorkerDependencies = {
  loader: (shareUrl) => fetchMilanoteBoard(shareUrl),
};

function baseHeaders(cacheControl: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "ETag",
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
}

function apiSuccess<T>(data: T): SuccessBody<T> {
  return { data, ok: true };
}

function apiError(error: BoardApiError): ErrorBody {
  return { error: boardApiErrorSchema.parse(error), ok: false };
}

function jsonResponse(
  body: ErrorBody | SuccessBody<unknown>,
  status: number,
  options: {
    cacheControl?: string;
    head?: boolean;
    headers?: HeadersInit;
  } = {},
): Response {
  const serialized = JSON.stringify(body);
  const headers = baseHeaders(options.cacheControl ?? NO_STORE);

  if (options.headers) {
    const extraHeaders = new Headers(options.headers);
    for (const [name, value] of extraHeaders) {
      headers.set(name, value);
    }
  }

  if (options.head) {
    headers.set("Content-Length", new TextEncoder().encode(serialized).byteLength.toString());
  }

  return new Response(options.head ? null : serialized, { headers, status });
}

async function createEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const value = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `W/"${value}"`;
}

function etagMatches(request: Request, etag: string): boolean {
  const candidate = request.headers.get("If-None-Match");
  if (!candidate) {
    return false;
  }

  const weakValue = etag.replace(/^W\//, "");
  return candidate
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value.replace(/^W\//, "") === weakValue);
}

function methodNotAllowed(request: Request, allowed: readonly string[]): Response {
  return jsonResponse(
    apiError({
      code: "METHOD_NOT_ALLOWED",
      message: `Method ${request.method} is not allowed for this endpoint.`,
    }),
    405,
    {
      head: request.method === "HEAD",
      headers: { Allow: allowed.join(", ") },
    },
  );
}

function preflight(allowed: readonly string[]): Response {
  const headers = baseHeaders(NO_STORE);
  headers.delete("Content-Type");
  headers.set("Access-Control-Allow-Headers", "Content-Type, If-None-Match");
  headers.set("Access-Control-Allow-Methods", allowed.join(", "));
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Allow", allowed.join(", "));
  return new Response(null, { headers, status: 204 });
}

function notFound(request: Request): Response {
  return jsonResponse(apiError({ code: "NOT_FOUND", message: "API endpoint not found." }), 404, {
    head: request.method === "HEAD",
  });
}

function isParserErrorCode(value: unknown): value is MilanoteParserError["code"] {
  return (
    value === "INVALID_SHARE_URL" ||
    value === "INVALID_UPSTREAM_RESPONSE" ||
    value === "UPSTREAM_REQUEST_FAILED" ||
    value === "UPSTREAM_ACCESS_DENIED" ||
    value === "BOARD_NOT_FOUND"
  );
}

function parserErrorCode(error: unknown): MilanoteParserError["code"] | undefined {
  if (error instanceof MilanoteParserError) {
    return error.code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    isParserErrorCode(error.code)
  ) {
    return error.code;
  }

  return undefined;
}

function sanitizedFailure(error: unknown, head: boolean): Response {
  const code = parserErrorCode(error);

  if (code === "BOARD_NOT_FOUND") {
    return jsonResponse(
      apiError({
        code: "BOARD_NOT_FOUND",
        message: "The shared board is unavailable.",
      }),
      404,
      { head },
    );
  }

  if (code === "INVALID_SHARE_URL") {
    return jsonResponse(
      apiError({
        code: "INVALID_SHARE_URL",
        message: "The share URL is not a valid Milanote public board link.",
      }),
      400,
      { head },
    );
  }

  if (
    code === "INVALID_UPSTREAM_RESPONSE" ||
    code === "UPSTREAM_REQUEST_FAILED" ||
    code === "UPSTREAM_ACCESS_DENIED"
  ) {
    return jsonResponse(
      apiError({
        code: "UPSTREAM_ERROR",
        message: "The board source could not be read right now.",
      }),
      502,
      { head },
    );
  }

  return jsonResponse(
    apiError({
      code: "INTERNAL_ERROR",
      message: "The board could not be loaded.",
    }),
    500,
    { head },
  );
}

async function boardResponse(
  request: Request,
  dependencies: WorkerDependencies,
  defaultView: FieldView,
): Promise<Response> {
  const isHead = request.method === "HEAD";
  const requestUrl = new URL(request.url);
  const queryEntries = Array.from(requestUrl.searchParams);
  const allowedQueryParameters = new Set(["exclude", "include", "url", "view"]);
  const hasUnknownParameter = queryEntries.some(([name]) => !allowedQueryParameters.has(name));
  const urlValues = requestUrl.searchParams.getAll("url");
  const viewValues = requestUrl.searchParams.getAll("view");
  const includeValues = requestUrl.searchParams.getAll("include");
  const excludeValues = requestUrl.searchParams.getAll("exclude");

  if (
    hasUnknownParameter ||
    urlValues.length !== 1 ||
    viewValues.length > 1 ||
    includeValues.length > 1 ||
    excludeValues.length > 1
  ) {
    return jsonResponse(
      apiError({
        code: "INVALID_REQUEST",
        message:
          "Provide one url parameter and each supported field-selection parameter at most once.",
      }),
      400,
      { head: isHead },
    );
  }

  const shareUrl = urlValues[0]?.trim() ?? "";
  if (shareUrl.length === 0 || shareUrl.length > 2048) {
    return jsonResponse(
      apiError({
        code: "INVALID_REQUEST",
        message: "The url query parameter must contain at most 2048 characters.",
      }),
      400,
      { head: isHead },
    );
  }

  const validatedShareUrl = milanoteShareUrlSchema.safeParse(shareUrl);
  if (!validatedShareUrl.success) {
    return jsonResponse(
      apiError({
        code: "INVALID_SHARE_URL",
        message: "The share URL is not a valid Milanote public board link.",
      }),
      400,
      { head: isHead },
    );
  }

  const viewValue = viewValues[0];
  const view =
    viewValue === undefined
      ? defaultView
      : viewValue === "compact" || viewValue === "standard" || viewValue === "full"
        ? viewValue
        : undefined;

  if (
    !view ||
    (includeValues.length === 1 && excludeValues.length === 1) ||
    (viewValues.length === 1 && includeValues.length === 1)
  ) {
    return jsonResponse(
      apiError({
        code: "INVALID_REQUEST",
        message: "Use include alone, exclude alone, view alone, or view together with exclude.",
      }),
      400,
      { head: isHead },
    );
  }

  let selection: FieldSelection;
  try {
    if (includeValues[0] !== undefined) {
      selection = {
        include: parseFieldSelectors(includeValues[0], "include"),
      };
    } else {
      selection = {
        ...(excludeValues[0] === undefined
          ? {}
          : { exclude: parseFieldSelectors(excludeValues[0], "exclude") }),
        view,
      };
    }
  } catch (error: unknown) {
    if (error instanceof FieldSelectorError) {
      return jsonResponse(
        apiError({
          code: "INVALID_FIELD_SELECTOR",
          field: error.field,
          message: error.message,
        }),
        400,
        { head: isHead },
      );
    }
    throw error;
  }

  try {
    const document = milanoteDocumentSchema.parse(
      await dependencies.loader(validatedShareUrl.data),
    );
    const data = selectDocumentFields(document, selection);
    const body = boardApiProjectionSuccessSchema.parse(apiSuccess(data));
    const serialized = JSON.stringify(body);
    const etag = await createEtag(serialized);
    const headers = baseHeaders(BOARD_CACHE_CONTROL);
    headers.set("ETag", etag);

    if (etagMatches(request, etag)) {
      headers.delete("Content-Type");
      return new Response(null, { headers, status: 304 });
    }

    if (isHead) {
      headers.set("Content-Length", new TextEncoder().encode(serialized).byteLength.toString());
      return new Response(null, { headers, status: 200 });
    }

    return new Response(serialized, { headers, status: 200 });
  } catch (error: unknown) {
    return sanitizedFailure(error, isHead);
  }
}

export async function handleRequest(
  request: Request,
  dependencies: WorkerDependencies = defaultDependencies,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  const defaultView =
    pathname === "/api/search" ? "compact" : pathname === "/api/detail" ? "full" : undefined;

  if (defaultView) {
    if (request.method === "OPTIONS") {
      return preflight(["GET", "HEAD", "OPTIONS"]);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed(request, ["GET", "HEAD", "OPTIONS"]);
    }

    return boardResponse(request, dependencies, defaultView);
  }

  return notFound(request);
}

export function createApp(dependencies: Partial<WorkerDependencies> = {}): WorkerApp {
  const resolvedDependencies: WorkerDependencies = {
    loader: dependencies.loader ?? defaultDependencies.loader,
  };

  return {
    fetch: (request) => handleRequest(request, resolvedDependencies),
  };
}

export default createApp();
