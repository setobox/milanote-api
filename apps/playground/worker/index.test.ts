import type { MilanoteDocument } from "@milanote-api/parser";
import { describe, expect, it, vi } from "vite-plus/test";

import { createApp, type BoardLoader } from "./index.ts";

const shareUrl = "https://app.milanote.com/fixture-board/shared-view?p=permission-secret-value";

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
    timestamps: {
      modifiedAt: "2026-07-22T09:00:00.000Z",
    },
    children: [
      {
        type: "COLUMN",
        id: "fixture-column",
        title: "Ideas",
        location: { parentId: "fixture-root" },
        timestamps: {},
        children: [
          {
            type: "CARD",
            id: "fixture-card",
            location: { parentId: "fixture-column" },
            timestamps: {},
            children: [],
            richText: {
              blocks: [],
              plainText: "A fixture note",
            },
          },
        ],
      },
    ],
    defaultColorPalette: [],
  },
} satisfies MilanoteDocument;

const compactFixture = {
  version: 1,
  source: {
    provider: "milanote",
    boardId: "fixture-board",
  },
  board: {
    type: "BOARD",
    id: "fixture-root",
    title: "Fixture board",
    children: [
      {
        type: "COLUMN",
        id: "fixture-column",
        title: "Ideas",
        children: [
          {
            type: "CARD",
            id: "fixture-card",
            children: [],
          },
        ],
      },
    ],
  },
};

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://playground.invalid${path}`, init);
}

function apiPath(endpoint: "detail" | "search", parameters: Record<string, string> = {}): string {
  return `/api/${endpoint}?${new URLSearchParams({
    url: shareUrl,
    ...parameters,
  }).toString()}`;
}

function loaderReturning(value: MilanoteDocument = documentFixture): BoardLoader {
  return vi.fn(async () => value);
}

describe("playground Worker", () => {
  it.each(["search", "detail"] as const)(
    "answers %s API preflight requests without validating a query",
    async (endpoint) => {
      const loader = loaderReturning();
      const response = await createApp({ loader }).fetch(
        request(`/api/${endpoint}`, { method: "OPTIONS" }),
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(loader).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/api/search", "missing url"],
    ["/api/search?url=one&url=two", "repeated url"],
    [apiPath("search", { debug: "true" }), "unknown parameter"],
    [`${apiPath("search")}&view=full&view=compact`, "repeated view"],
    [`${apiPath("search")}&include=version&include=board.id`, "repeated include"],
    [`${apiPath("search")}&exclude=fetchedAt&exclude=source`, "repeated exclude"],
    [apiPath("search", { view: "summary" }), "unknown view"],
    [apiPath("detail", { include: "board.id", exclude: "fetchedAt" }), "include with exclude"],
    [apiPath("detail", { view: "standard", include: "board.id" }), "view with include"],
    [`/api/detail?url=${"x".repeat(2049)}`, "url too long"],
    ["/api/detail?url=%20%20", "blank url"],
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

  it.each([
    ["include", "board.password"],
    ["include", "**.userId"],
    ["exclude", "board..id"],
    ["exclude", "board.children[0].id"],
  ] as const)("rejects an invalid %s field selector", async (field, selector) => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(
      request(apiPath("detail", { [field]: selector })),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_FIELD_SELECTOR",
        field,
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

  it("trims the share URL before validation and loading", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(
      request(apiPath("detail", { url: `  ${shareUrl}  ` })),
    );

    expect(response.status).toBe(200);
    expect(loader).toHaveBeenCalledWith(shareUrl);
  });

  it("never includes an error body for HEAD requests", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request("/api/search", { method: "HEAD" }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
  });

  it.each(["search", "detail"] as const)(
    "rejects unsupported methods for %s and advertises allowed methods",
    async (endpoint) => {
      const loader = loaderReturning();
      const response = await createApp({ loader }).fetch(
        request(apiPath(endpoint), { method: "POST" }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
      expect(loader).not.toHaveBeenCalled();
    },
  );

  it("moves the complete default response to /api/detail", async () => {
    const loader = loaderReturning();
    const response = await createApp({ loader }).fetch(request(apiPath("detail")));

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

  it.each(["search", "detail"] as const)(
    "permanently removes sensitive fields from %s responses",
    async (endpoint) => {
      const sensitiveDocument: MilanoteDocument = {
        ...documentFixture,
        board: {
          ...documentFixture.board,
          children: [
            {
              type: "UNKNOWN",
              id: "sensitive-node",
              location: {},
              timestamps: {},
              children: [],
              elementType: "PRIVATE",
              content: {
                accessToken: "private-access-token",
                nested: {
                  privateMetadata: "private-metadata",
                  userId: "private-user",
                  visible: "safe",
                },
              },
            },
          ],
        },
      };
      const response = await createApp({
        loader: loaderReturning(sensitiveDocument),
      }).fetch(request(apiPath(endpoint, { view: "full" })));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('"visible":"safe"');
      expect(body).not.toContain("private-access-token");
      expect(body).not.toContain("private-metadata");
      expect(body).not.toContain("private-user");
      expect(body).not.toContain('"userId"');
    },
  );

  it("returns the compact preset from /api/search by default", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request(apiPath("search")),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: compactFixture,
      ok: true,
    });
  });

  it("allows an explicit view to replace the endpoint default", async () => {
    const searchFull = await createApp({ loader: loaderReturning() }).fetch(
      request(apiPath("search", { view: "full" })),
    );
    const detailCompact = await createApp({ loader: loaderReturning() }).fetch(
      request(apiPath("detail", { view: "compact" })),
    );

    await expect(searchFull.json()).resolves.toEqual({
      data: documentFixture,
      ok: true,
    });
    await expect(detailCompact.json()).resolves.toEqual({
      data: compactFixture,
      ok: true,
    });
  });

  it("supports include as a whitelist that replaces the default view", async () => {
    const response = await createApp({ loader: loaderReturning() }).fetch(
      request(
        apiPath("search", {
          include: "version,board.id,board.title,board.children.id",
        }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        version: 1,
        board: {
          id: "fixture-root",
          title: "Fixture board",
          children: [{ id: "fixture-column" }],
        },
      },
      ok: true,
    });
  });

  it("supports exclude alone and together with a preset view", async () => {
    const fullResponse = await createApp({ loader: loaderReturning() }).fetch(
      request(apiPath("detail", { exclude: "fetchedAt,**.timestamps" })),
    );
    const standardResponse = await createApp({ loader: loaderReturning() }).fetch(
      request(
        apiPath("detail", {
          view: "standard",
          exclude: "**.timestamps",
        }),
      ),
    );

    const fullBody = JSON.stringify(await fullResponse.json());
    const standardBody = (await standardResponse.json()) as {
      data: Record<string, unknown>;
    };
    expect(fullBody).not.toContain("fetchedAt");
    expect(fullBody).not.toContain("timestamps");
    expect(standardBody.data).toHaveProperty(
      "board.children.0.children.0.richText.plainText",
      "A fixture note",
    );
    expect(standardBody.data).not.toHaveProperty("board.location");
    expect(JSON.stringify(standardBody)).not.toContain("timestamps");
  });

  it("uses the final projected representation for entity tags", async () => {
    const app = createApp({ loader: loaderReturning() });
    const detail = await app.fetch(request(apiPath("detail")));
    const searchFull = await app.fetch(request(apiPath("search", { view: "full" })));
    const searchCompact = await app.fetch(request(apiPath("search")));

    expect(searchFull.headers.get("ETag")).toBe(detail.headers.get("ETag"));
    expect(searchCompact.headers.get("ETag")).not.toBe(detail.headers.get("ETag"));
  });

  it("supports HEAD success responses using the projected body length", async () => {
    const app = createApp({ loader: loaderReturning() });
    const path = apiPath("search", { include: "version,board.id" });
    const getResponse = await app.fetch(request(path));
    const serialized = await getResponse.text();
    const headResponse = await app.fetch(request(path, { method: "HEAD" }));

    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("Content-Length")).toBe(
      new TextEncoder().encode(serialized).byteLength.toString(),
    );
    expect(await headResponse.text()).toBe("");
  });

  it("returns 304 when the current projected entity tag is supplied", async () => {
    const loader = loaderReturning();
    const app = createApp({ loader });
    const path = apiPath("search");
    const initial = await app.fetch(request(path));
    const etag = initial.headers.get("ETag");

    expect(etag).not.toBeNull();

    const response = await app.fetch(
      request(path, {
        headers: { "If-None-Match": etag ?? "" },
      }),
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("ETag")).toBe(etag);
  });

  it("uses weak comparison for If-None-Match", async () => {
    const app = createApp({ loader: loaderReturning() });
    const path = apiPath("search");
    const initial = await app.fetch(request(path));
    const etag = initial.headers.get("ETag");

    expect(etag).toMatch(/^W\//);

    const response = await app.fetch(
      request(path, {
        headers: { "If-None-Match": etag?.replace(/^W\//, "") ?? "" },
      }),
    );

    expect(response.status).toBe(304);
  });

  it("maps missing boards without leaking the input URL", async () => {
    const loader: BoardLoader = vi.fn(async () => {
      throw Object.assign(new Error(`Missing ${shareUrl}`), {
        code: "BOARD_NOT_FOUND",
      });
    });
    const response = await createApp({ loader }).fetch(request(apiPath("detail")));
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
    const response = await createApp({ loader }).fetch(request(apiPath("search")));
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("UPSTREAM_ERROR");
    expect(body).not.toContain(shareUrl);
    expect(body).not.toContain("permission-secret-value");
    expect(body).not.toContain(upstreamToken);
  });

  it("maps an invalid loader result to a sanitized internal error", async () => {
    const loader = vi.fn(async () => ({ version: 2 })) as unknown as BoardLoader;
    const response = await createApp({ loader }).fetch(request(apiPath("detail")));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("INTERNAL_ERROR");
    expect(body).not.toContain("version");
  });

  it("returns a unified JSON error for old and unknown API paths", async () => {
    const app = createApp({ loader: loaderReturning() });

    for (const path of ["/api/board", "/api/health", "/api/missing"]) {
      const response = await app.fetch(request(path));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: { code: "NOT_FOUND", message: "API endpoint not found." },
        ok: false,
      });
    }
  });
});
