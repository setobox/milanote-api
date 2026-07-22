import { describe, expect, test } from "vite-plus/test";
import { fetchMilanoteBoard, MilanoteParserError, type MilanoteFetch } from "../src/index.ts";

const BOARD_ID = "board_network_demo";
const PERMISSION_ID = "permission_network_demo";
const TOKEN = "token_network_demo";
const SHARE_URL = `https://app.milanote.com/${BOARD_ID}/shared-view?p=${PERMISSION_ID}`;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function inputUrl(input: Parameters<MilanoteFetch>[0]): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(input.toString());
}

function rootResponse(extraElements: Record<string, unknown> = {}): unknown {
  return {
    elements: {
      [BOARD_ID]: {
        id: BOARD_ID,
        elementType: "BOARD",
        location: { rootBoard: true },
        content: { title: "Network demo", defaultColorPalette: [] },
      },
      ...extraElements,
    },
    comments: {},
    errors: {},
    childrenReturned: { [BOARD_ID]: true },
    canvasOrder: { [BOARD_ID]: Object.keys(extraElements) },
    boardIds: [BOARD_ID],
  };
}

describe("fetchMilanoteBoard", () => {
  test("performs permission and board GETs with the required query", async () => {
    const calls: Array<{ init?: RequestInit; url: URL }> = [];
    const fetcher: MilanoteFetch = async (input, init) => {
      const url = inputUrl(input);
      calls.push({ url, init });
      return calls.length === 1 ? jsonResponse({ token: TOKEN }) : jsonResponse(rootResponse());
    };

    const document = await fetchMilanoteBoard(SHARE_URL, {
      fetch: fetcher,
      now: () => new Date("2032-01-02T03:04:05.000Z"),
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.url.origin).toBe("https://app.milanote.com");
    expect(calls[0]?.url.pathname).toBe(`/api/permissions/token/${PERMISSION_ID}`);
    expect(calls[0]?.url.searchParams.get("elementId")).toBe(BOARD_ID);

    expect(calls[1]?.url.pathname).toBe("/api/boards");
    expect(calls[1]?.url.searchParams.get("ids")).toBe(BOARD_ID);
    expect(calls[1]?.url.searchParams.get("tokens")).toBe(TOKEN);
    expect(calls[1]?.url.searchParams.get("excludeSelf")).toBe("false");
    expect(calls[1]?.url.searchParams.get("loadAncestors")).toBe("false");
    expect(calls[1]?.url.searchParams.get("canvasOrder")).toBe("true");
    expect(document.fetchedAt).toBe("2032-01-02T03:04:05.000Z");
    expect(document.board.title).toBe("Network demo");
  });

  test("loads nested boards with a bounded, deduplicated BFS", async () => {
    const nestedBoardId = "board_nested_network_demo";
    const calls: URL[] = [];
    const fetcher: MilanoteFetch = async (input) => {
      const url = inputUrl(input);
      calls.push(url);
      if (url.pathname.startsWith("/api/permissions/token/")) {
        return jsonResponse({ token: TOKEN });
      }

      const ids = url.searchParams.get("ids");
      if (ids === BOARD_ID) {
        return jsonResponse(
          rootResponse({
            [nestedBoardId]: {
              id: nestedBoardId,
              elementType: "BOARD",
              location: {
                parentId: BOARD_ID,
                section: "CANVAS",
                position: { score: 1 },
              },
              content: { title: "Nested network demo" },
            },
          }),
        );
      }

      expect(ids).toBe(nestedBoardId);
      expect(url.searchParams.get("tokens")).toBe(TOKEN);
      return jsonResponse({
        elements: {
          [nestedBoardId]: {
            id: nestedBoardId,
            elementType: "BOARD",
            location: {
              parentId: BOARD_ID,
              section: "CANVAS",
              position: { score: 1 },
            },
            content: { title: "Nested network demo" },
          },
          nested_card_demo: {
            id: "nested_card_demo",
            elementType: "CARD",
            location: {
              parentId: nestedBoardId,
              section: "CANVAS",
              position: { score: 1 },
            },
            content: {
              textContent: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Nested content" }],
                  },
                ],
              },
            },
          },
        },
        comments: {},
        errors: {},
        childrenReturned: { [nestedBoardId]: true },
        canvasOrder: { [nestedBoardId]: ["nested_card_demo"] },
        boardIds: [nestedBoardId],
      });
    };

    const document = await fetchMilanoteBoard(SHARE_URL, { fetch: fetcher });
    expect(calls).toHaveLength(3);
    const nested = document.board.children[0];
    expect(nested?.type).toBe("BOARD");
    expect(nested?.children[0]).toEqual(
      expect.objectContaining({ id: "nested_card_demo", type: "CARD" }),
    );
  });

  test("honors maxBoards and leaves unfetched nested boards as empty nodes", async () => {
    const nestedBoardId = "board_bounded_demo";
    let callCount = 0;
    const fetcher: MilanoteFetch = async (input) => {
      callCount += 1;
      const url = inputUrl(input);
      if (url.pathname.startsWith("/api/permissions/token/")) {
        return jsonResponse({ token: TOKEN });
      }
      return jsonResponse(
        rootResponse({
          [nestedBoardId]: {
            id: nestedBoardId,
            elementType: "BOARD",
            location: { parentId: BOARD_ID, position: { score: 1 } },
            content: { title: "Bounded nested demo" },
          },
        }),
      );
    };

    const document = await fetchMilanoteBoard(SHARE_URL, {
      fetch: fetcher,
      maxBoards: 1,
    });
    expect(callCount).toBe(2);
    expect(document.board.children[0]).toEqual(
      expect.objectContaining({
        id: nestedBoardId,
        type: "BOARD",
        children: [],
      }),
    );
  });

  test("maps null tokens, HTTP failures, and HTTP-200 access denial safely", async () => {
    const cases: Array<{
      expectedCode: string;
      fetcher: MilanoteFetch;
    }> = [
      {
        expectedCode: "UPSTREAM_REQUEST_FAILED",
        fetcher: async () => jsonResponse({ private: "do not expose" }, 503),
      },
      {
        expectedCode: "UPSTREAM_ACCESS_DENIED",
        fetcher: async () => jsonResponse({ token: null }),
      },
      {
        expectedCode: "UPSTREAM_ACCESS_DENIED",
        fetcher: async (input) =>
          inputUrl(input).pathname.startsWith("/api/permissions/token/")
            ? jsonResponse({ token: TOKEN })
            : jsonResponse({
                elements: {
                  [BOARD_ID]: {
                    id: BOARD_ID,
                    elementType: "SKELETON",
                    location: { rootBoard: true },
                  },
                },
                errors: {},
                childrenReturned: { [BOARD_ID]: false },
              }),
      },
    ];

    for (const testCase of cases) {
      try {
        await fetchMilanoteBoard(SHARE_URL, { fetch: testCase.fetcher });
        throw new Error("Expected fetching to fail.");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(MilanoteParserError);
        expect(error).toEqual(expect.objectContaining({ code: testCase.expectedCode }));
        expect(String(error)).not.toContain(TOKEN);
        expect(String(error)).not.toContain(PERMISSION_ID);
        expect(String(error)).not.toContain(SHARE_URL);
      }
    }
  });

  test("aborts an unbounded upstream request at the configured timeout", async () => {
    const fetcher: MilanoteFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request aborted", "AbortError")),
          { once: true },
        );
      });

    await expect(fetchMilanoteBoard(SHARE_URL, { fetch: fetcher, timeoutMs: 5 })).rejects.toEqual(
      expect.objectContaining({ code: "UPSTREAM_REQUEST_FAILED" }),
    );
  });
});
