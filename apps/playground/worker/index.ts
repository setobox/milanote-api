import {
  fetchMilanoteBoard,
  MilanoteParserError,
  type MilanoteDocument,
} from "@milanote-api/parser";

export interface Env {
  MILANOTE_SHARE_URL?: string;
}

export type BoardLoader = (shareUrl: string) => Promise<MilanoteDocument>;

export interface WorkerDependencies {
  loader: BoardLoader;
}

export interface WorkerApp {
  fetch(request: Request, env: Env): Promise<Response>;
}

interface ApiError {
  code:
    | "BOARD_NOT_FOUND"
    | "CONFIGURATION_ERROR"
    | "INTERNAL_ERROR"
    | "METHOD_NOT_ALLOWED"
    | "NOT_FOUND"
    | "UPSTREAM_ERROR";
  message: string;
}

interface ErrorBody {
  error: ApiError;
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

function apiError(error: ApiError): ErrorBody {
  return { error, ok: false };
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

function stableDocumentBody(document: MilanoteDocument): string {
  return JSON.stringify(
    apiSuccess({
      board: document.board,
      source: document.source,
      version: document.version,
    }),
  );
}

function etagMatches(request: Request, etag: string): boolean {
  const candidate = request.headers.get("If-None-Match");
  if (!candidate) {
    return false;
  }

  return candidate
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag);
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
        message: "The configured board is unavailable.",
      }),
      404,
      { head },
    );
  }

  if (code === "INVALID_SHARE_URL") {
    return jsonResponse(
      apiError({
        code: "CONFIGURATION_ERROR",
        message: "The board source is not configured correctly.",
      }),
      503,
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
  env: Env,
  dependencies: WorkerDependencies,
): Promise<Response> {
  const isHead = request.method === "HEAD";
  const shareUrl = env.MILANOTE_SHARE_URL?.trim();

  if (!shareUrl) {
    return jsonResponse(
      apiError({
        code: "CONFIGURATION_ERROR",
        message: "The board source is not configured.",
      }),
      503,
      { head: isHead },
    );
  }

  try {
    const document = await dependencies.loader(shareUrl);
    const body = apiSuccess(document);
    const serialized = JSON.stringify(body);
    const etag = await createEtag(stableDocumentBody(document));
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
  env: Env,
  dependencies: WorkerDependencies = defaultDependencies,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") {
    if (request.method === "OPTIONS") {
      return preflight(["GET", "OPTIONS"]);
    }

    if (request.method !== "GET") {
      return methodNotAllowed(request, ["GET", "OPTIONS"]);
    }

    return jsonResponse(
      apiSuccess({
        configured: Boolean(env.MILANOTE_SHARE_URL?.trim()),
        status: "ok",
      }),
      200,
    );
  }

  if (pathname === "/api/board") {
    if (request.method === "OPTIONS") {
      return preflight(["GET", "HEAD", "OPTIONS"]);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed(request, ["GET", "HEAD", "OPTIONS"]);
    }

    return boardResponse(request, env, dependencies);
  }

  return notFound(request);
}

export function createApp(dependencies: Partial<WorkerDependencies> = {}): WorkerApp {
  const resolvedDependencies: WorkerDependencies = {
    loader: dependencies.loader ?? defaultDependencies.loader,
  };

  return {
    fetch: (request, env) => handleRequest(request, env, resolvedDependencies),
  };
}

export default createApp();
