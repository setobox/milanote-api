import type { MilanoteDocument } from "@milanote-api/parser";
import { describe, expect, it, vi } from "vite-plus/test";

import { createApp, type BoardLoader } from "./index.ts";

const sourceSecret = "configured-secret-value";

const documentFixture = {
  version: 1,
  source: {
    provider: "milanote",
    boardId: "fixture-board",
  },
  fetchedAt: "2026-07-22T10:00:00.000Z",
  board: {
    type: "BOARD",
    id: "fixture-root",
    title: "Fixture board",
    location: {},
    timestamps: {},
    children: [],
    defaultColorPalette: [],
  },
} satisfies MilanoteDocument;

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://playground.invalid${path}`, init);
}

function loaderReturning(value: MilanoteDocument = documentFixture): BoardLoader {
  return vi.fn(async () => value);
}

describe("playground Worker", () => {
  it("reports health without requiring the board secret", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request("/api/health"), {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { configured: false, status: "ok" },
      ok: true,
    });
    expect(loader).not.toHaveBeenCalled();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers API preflight requests without loading the board", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(
      request("/api/board", { method: "OPTIONS" }),
      {},
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns a safe configuration error when the secret is missing", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request("/api/board"), {});

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "The board source is not configured.",
      },
      ok: false,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("never includes an error body for HEAD requests", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request("/api/board", { method: "HEAD" }),
      {},
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });

  it("rejects unsupported methods and advertises the allowed methods", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request("/api/board", { method: "POST" }), {
      MILANOTE_SHARE_URL: sourceSecret,
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns the parsed document with cache metadata", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request("/api/board"), {
      MILANOTE_SHARE_URL: sourceSecret,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("ETag")).toMatch(/^W\/"[a-f\d]{64}"$/);
    await expect(response.json()).resolves.toEqual({
      data: documentFixture,
      ok: true,
    });
    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith(sourceSecret);
  });

  it("returns 304 when the current entity tag is supplied", async () => {
    const loader = loaderReturning();
    const app = createApp({ loader });
    const initial = await app.fetch(request("/api/board"), {
      MILANOTE_SHARE_URL: sourceSecret,
    });
    const etag = initial.headers.get("ETag");

    expect(etag).not.toBeNull();

    const response = await app.fetch(
      request("/api/board", {
        headers: { "If-None-Match": etag ?? "" },
      }),
      { MILANOTE_SHARE_URL: sourceSecret },
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("ETag")).toBe(etag);
  });

  it("never exposes secret or upstream error details", async () => {
    const upstreamToken = "private-upstream-token";
    const loader: BoardLoader = vi.fn(async () => {
      throw Object.assign(new Error(`Failed with ${sourceSecret} and ${upstreamToken}`), {
        code: "UPSTREAM_REQUEST_FAILED",
      });
    });
    const response = await createApp({ loader }).fetch(request("/api/board"), {
      MILANOTE_SHARE_URL: sourceSecret,
    });
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("UPSTREAM_ERROR");
    expect(body).not.toContain(sourceSecret);
    expect(body).not.toContain(upstreamToken);
  });

  it("returns a unified JSON error for unknown API paths", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request("/api/missing"),
      {},
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "API endpoint not found." },
      ok: false,
    });
  });
});
