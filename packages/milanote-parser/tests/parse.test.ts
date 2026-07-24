import { describe, expect, test } from "vite-plus/test";
import { MilanoteParserError, type MilanoteDocument, type MilanoteNode } from "../src/index.ts";
import { parseMilanoteBoardResponse } from "../src/parse.ts";
import { fakeBoardResponse, ROOT_BOARD_ID } from "./fixtures/board-response.ts";

function flatten(nodes: MilanoteNode[]): MilanoteNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function findNode(document: MilanoteDocument, id: string): MilanoteNode {
  const node = flatten([document.board]).find((candidate) => candidate.id === id);
  if (node === undefined) throw new Error(`Missing test node: ${id}`);
  return node;
}

describe("parseMilanoteBoardResponse", () => {
  test("produces a stable recursive document with all supported node types", () => {
    const document = parseMilanoteBoardResponse(fakeBoardResponse, {
      boardId: ROOT_BOARD_ID,
      fetchedAt: "2031-02-03T04:05:06.000Z",
    });

    expect(document.version).toBe(1);
    expect(document.source).toEqual({
      provider: "milanote",
      boardId: ROOT_BOARD_ID,
    });
    expect(document.fetchedAt).toBe("2031-02-03T04:05:06.000Z");
    expect(document.board.title).toBe("Demo workspace");
    expect(document.board.timestamps.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(document.board.children.map((node) => node.id)).toEqual([
      "image_demo",
      "column_demo",
      "file_demo",
      "link_demo",
      "tasks_demo",
      "table_demo",
      "thread_demo",
      "nested_board_demo",
      "mystery_demo",
      "skeleton_demo",
    ]);

    expect(new Set(flatten([document.board]).map((node) => node.type))).toEqual(
      new Set([
        "BOARD",
        "COLUMN",
        "CARD",
        "IMAGE",
        "FILE",
        "LINK",
        "TASK_LIST",
        "TASK",
        "TABLE",
        "COMMENT_THREAD",
        "SKELETON",
        "UNKNOWN",
      ]),
    );
  });

  test("preserves safe rich-text blocks and derives renderer-friendly plain text", () => {
    const document = parseMilanoteBoardResponse(fakeBoardResponse, {
      boardId: ROOT_BOARD_ID,
    });
    const card = findNode(document, "card_demo");
    expect(card.type).toBe("CARD");
    if (card.type !== "CARD") throw new Error("Expected a card.");

    expect(card.richText.plainText).toBe("A clear card\nWith context");
    expect(card.richText.blocks).toHaveLength(2);
    expect(card.richText.blocks[0]).toEqual(expect.objectContaining({ type: "heading" }));

    const link = findNode(document, "link_demo");
    expect(link.type).toBe("LINK");
    if (link.type !== "LINK") throw new Error("Expected a link.");
    expect(link.caption?.plainText).toBe("Useful reference");
  });

  test("maps media, table cells, task metadata, comments, and unknown content", () => {
    const document = parseMilanoteBoardResponse(fakeBoardResponse, {
      boardId: ROOT_BOARD_ID,
    });

    const image = findNode(document, "image_demo");
    if (image.type !== "IMAGE") throw new Error("Expected an image.");
    expect(image.image).toEqual(
      expect.objectContaining({
        url: "https://cdn.example.test/photo.webp",
        width: 1200,
        height: 800,
      }),
    );
    expect(image.file?.mimeType).toBe("image/webp");

    const file = findNode(document, "file_demo");
    if (file.type !== "FILE") throw new Error("Expected a file.");
    expect(file.file).toEqual(
      expect.objectContaining({
        filename: "brief.pdf",
        sizeBytes: 4096,
      }),
    );

    const table = findNode(document, "table_demo");
    if (table.type !== "TABLE") throw new Error("Expected a table.");
    expect(table.table.columnWidths).toEqual([240, 180]);
    expect(table.table.rows[0]?.[0]).toEqual(
      expect.objectContaining({
        value: "Feature",
        textStyles: ["BOLD"],
      }),
    );
    expect(table.table.rows[0]?.[0]?.richText?.plainText).toBe("Feature");

    const taskList = findNode(document, "tasks_demo");
    if (taskList.type !== "TASK_LIST") throw new Error("Expected a task list.");
    expect(taskList.children.map((node) => node.id)).toEqual(["task_first", "task_later"]);
    const task = findNode(document, "task_first");
    if (task.type !== "TASK") throw new Error("Expected a task.");
    expect(task).toEqual(
      expect.objectContaining({
        completed: true,
        dueDate: "2030-04-05",
        reminderAt: "2030-04-01T00:42:47.000Z",
      }),
    );

    const thread = findNode(document, "thread_demo");
    if (thread.type !== "COMMENT_THREAD") {
      throw new Error("Expected a comment thread.");
    }
    expect(thread.comments.map((comment) => comment.id)).toEqual([
      "comment_first",
      "comment_later",
    ]);
    expect(thread.comments[0]?.richText.plainText).toBe("First comment");

    const unknown = findNode(document, "mystery_demo");
    if (unknown.type !== "UNKNOWN") throw new Error("Expected unknown node.");
    expect(unknown.elementType).toBe("AUDIO_NOTE");
    expect(unknown.content).toEqual({ waveform: [0.1, 0.4, 0.2] });
  });

  test("rejects HTTP-200 access failures and sanitizes upstream errors", () => {
    const accessDenied = {
      elements: {},
      errors: {},
      childrenReturned: { [ROOT_BOARD_ID]: false },
    };
    expect(() => parseMilanoteBoardResponse(accessDenied, { boardId: ROOT_BOARD_ID })).toThrowError(
      expect.objectContaining({ code: "UPSTREAM_ACCESS_DENIED" }),
    );

    const upstreamSecret = "opaque_upstream_secret";
    const errorResponse = {
      elements: {},
      errors: {
        [ROOT_BOARD_ID]: {
          error: {
            code: "BOARD_NOT_FOUND",
            message: `Do not expose ${upstreamSecret}`,
          },
        },
      },
      childrenReturned: { [ROOT_BOARD_ID]: false },
    };

    try {
      parseMilanoteBoardResponse(errorResponse, { boardId: ROOT_BOARD_ID });
      throw new Error("Expected parsing to fail.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MilanoteParserError);
      expect(error).toEqual(expect.objectContaining({ code: "BOARD_NOT_FOUND" }));
      expect(String(error)).not.toContain(upstreamSecret);
    }
  });

  test("rejects malformed top-level data and a non-board root", () => {
    expect(() => parseMilanoteBoardResponse(null, { boardId: ROOT_BOARD_ID })).toThrowError(
      expect.objectContaining({ code: "INVALID_UPSTREAM_RESPONSE" }),
    );
    expect(() =>
      parseMilanoteBoardResponse(
        {
          elements: {
            [ROOT_BOARD_ID]: {
              id: ROOT_BOARD_ID,
              elementType: "SKELETON",
              location: { rootBoard: true },
            },
          },
          childrenReturned: { [ROOT_BOARD_ID]: true },
        },
        { boardId: ROOT_BOARD_ID },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_UPSTREAM_RESPONSE" }));
  });
});
