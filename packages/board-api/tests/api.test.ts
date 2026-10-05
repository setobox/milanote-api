import { describe, expect, it, vi } from "vite-plus/test";
import { MilanoteParserError, type BoardFetchResult } from "@milanote-api/parser";
import {
  createApp,
  EXAMPLE_URL,
  PARSE_PATH,
  openApiDocument,
  successSchema,
} from "../src/index.ts";

export const fixture: BoardFetchResult = {
  document: {
    version: 1,
    source: { provider: "milanote", boardId: "example" },
    fetchedAt: "2026-10-04T00:00:00.000Z",
    board: {
      id: "example",
      type: "BOARD",
      title: "Example",
      location: {},
      timestamps: {},
      children: [],
      defaultColorPalette: [],
    },
  },
  diagnostics: {
    scope: "root",
    complete: true,
    unloadedBoardIds: [],
    warnings: [],
    upstreamRequests: 2,
    timings: { permission: 3, boards: 8, parse: 1, total: 12 },
  },
};
const request = (body: unknown = { url: EXAMPLE_URL }) =>
  new Request(`https://api.test${PARSE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("API contract", () => {
  it("defaults to root, exposes diagnostics and never caches completed requests", async () => {
    const loader = vi.fn(async () => structuredClone(fixture));
    const app = createApp({ loader });
    const response = await app.fetch(request());
    expect(response.status).toBe(200);
    expect(successSchema.safeParse(await response.json()).success).toBe(true);
    expect(loader).toHaveBeenCalledWith(EXAMPLE_URL, expect.objectContaining({ scope: "root" }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("ETag")).toBe(false);
    expect(response.headers.get("Server-Timing")).toContain("boards;dur=8");
    expect(response.headers.get("X-Upstream-Requests")).toBe("2");
    await app.fetch(request());
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it.each([
    { url: "invalid" },
    { url: EXAMPLE_URL, scope: "all" },
    { url: EXAMPLE_URL, include: ["board"], view: "full" },
    { url: EXAMPLE_URL, include: ["board"], exclude: ["source"] },
    { url: EXAMPLE_URL, extra: true },
  ])("rejects invalid boundary input", async (input) => {
    const loader = vi.fn();
    expect((await createApp({ loader }).fetch(request(input))).status).toBe(400);
    expect(loader).not.toHaveBeenCalled();
  });
  it("projects fields and rejects forbidden selectors before loading", async () => {
    const app = createApp({ loader: async () => fixture });
    const response = await app.fetch(request({ url: EXAMPLE_URL, include: ["board.title"] }));
    expect(await response.json()).toMatchObject({ data: { board: { title: "Example" } } });
    expect(
      (await app.fetch(request({ url: EXAMPLE_URL, include: ["**.accessToken"] }))).status,
    ).toBe(400);
  });
  it.each([
    ["UPSTREAM_TIMEOUT", 504],
    ["UPSTREAM_ACCESS_DENIED", 403],
    ["BOARD_NOT_FOUND", 404],
    ["UPSTREAM_REQUEST_FAILED", 502],
  ] as const)("maps %s without leaking input", async (code, status) => {
    const response = await createApp({
      loader: async () => {
        const error = new MilanoteParserError(code);
        error.stage = "boards";
        throw error;
      },
    }).fetch(request());
    expect(response.status).toBe(status);
    const body = await response.text();
    expect(body).toContain('"stage":"boards"');
    expect(body).not.toContain("your-permission");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("validates body size, content type, invalid JSON and methods", async () => {
    const app = createApp();
    expect((await app.fetch(request({ url: "x".repeat(40_000) }))).status).toBe(413);
    expect(
      (
        await app.fetch(
          new Request(`https://api.test${PARSE_PATH}`, { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await app.fetch(
          new Request(`https://api.test${PARSE_PATH}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect((await app.fetch(new Request(`https://api.test${PARSE_PATH}`))).status).toBe(405);
    expect((await app.fetch(new Request("https://api.test/api/missing"))).status).toBe(404);
    const preflight = await app.fetch(
      new Request(`https://api.test${PARSE_PATH}`, { method: "OPTIONS" }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
  it("serves capabilities and OpenAPI metadata without caching", async () => {
    const app = createApp();
    const capabilities = await app.fetch(new Request("https://api.test/api/capabilities"));
    expect(capabilities.status).toBe(200);
    expect(await capabilities.json()).toEqual({
      version: 1,
      storage: false,
      cache: false,
      scheduling: false,
    });
    expect(capabilities.headers.get("Cache-Control")).toBe("no-store");
    const openapi = await app.fetch(new Request("https://api.test/api/openapi.json"));
    expect(openapi.status).toBe(200);
    expect(await openapi.json()).toEqual(openApiDocument);
    expect(openapi.headers.get("Cache-Control")).toBe("no-store");
  });
});
