import type { MilanoteDocument } from "@milanote-api/parser";
import { describe, expect, it, vi } from "vite-plus/test";

import { createApp, type BoardLoader } from "./index.ts";

const shareUrl = "https://app.milanote.com/fixture-board/shared-view?p=permission-secret-value";
const searchPath = `/api/search?${new URLSearchParams({ url: shareUrl }).toString()}`;

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
  it("reports health without configuration metadata", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request("/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "ok" },
      ok: true,
    });
    expect(loader).not.toHaveBeenCalled();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers API preflight requests without validating a query", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(
      request("/api/search", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(loader).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/search", "missing"],
    ["/api/search?url=one&url=two", "repeated"],
    ["/api/search?url=one&debug=true", "extra"],
    [`/api/search?url=${"x".repeat(2049)}`, "too long"],
    ["/api/search?url=%20%20", "blank"],
  ])("rejects an invalid request structure: %s (%s)", async (path) => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request(path));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: expect.any(String),
      },
      ok: false,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("rejects a non-Milanote or malformed share URL", async () => {
    const invalidUrl = "https://app.milanote.com.evil.test/fixture?p=permission";
    const path = `/api/search?${new URLSearchParams({ url: invalidUrl }).toString()}`;
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request(path));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_SHARE_URL",
        message: "The share URL is not a valid Milanote public board link.",
      },
      ok: false,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("never includes an error body for HEAD requests", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request("/api/search", { method: "HEAD" }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
  });

  it("rejects unsupported methods and advertises the allowed methods", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request(searchPath, { method: "POST" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns the parsed document with cache metadata", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request(searchPath));

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
    expect(loader).toHaveBeenCalledWith(shareUrl);
  });

  it("supports HEAD success responses without a response body", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request(searchPath, { method: "HEAD" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toMatch(/^\d+$/);
    expect(await response.text()).toBe("");
  });

  it("returns 304 when the current entity tag is supplied", async () => {
    const loader = loaderReturning();
    const app = createApp({ loader });
    const initial = await app.fetch(request(searchPath));
    const etag = initial.headers.get("ETag");

    expect(etag).not.toBeNull();

    const response = await app.fetch(
      request(searchPath, {
        headers: { "If-None-Match": etag ?? "" },
      }),
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("ETag")).toBe(etag);
  });

  it("maps missing boards without leaking the input URL", async () => {
    const loader: BoardLoader = vi.fn(async () => {
      throw Object.assign(new Error(`Missing ${shareUrl}`), {
        code: "BOARD_NOT_FOUND",
      });
    });
    const response = await createApp({ loader }).fetch(request(searchPath));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain("BOARD_NOT_FOUND");
    expect(body).not.toContain(shareUrl);
    expect(body).not.toContain("permission-secret-value");
  });

  it("never exposes the input URL or upstream error details", async () => {
    const upstreamToken = "private-upstream-token";
    const loader: BoardLoader = vi.fn(async () => {
      throw Object.assign(new Error(`Failed with ${shareUrl} and ${upstreamToken}`), {
        code: "UPSTREAM_REQUEST_FAILED",
      });
    });
    const response = await createApp({ loader }).fetch(request(searchPath));
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("UPSTREAM_ERROR");
    expect(body).not.toContain(shareUrl);
    expect(body).not.toContain("permission-secret-value");
    expect(body).not.toContain(upstreamToken);
  });

  it("returns a unified JSON error for old and unknown API paths", async () => {
    const app = createApp({ loader: loaderReturning() });

    for (const path of ["/api/board", "/api/missing"]) {
      const response = await app.fetch(request(path));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: { code: "NOT_FOUND", message: "API endpoint not found." },
        ok: false,
      });
    }
  });
});
