import { milanoteDocumentSchema, type MilanoteDocument } from "@milanote-api/parser";
import { describe, expect, it } from "vite-plus/test";

import {
  FieldSelectorError,
  MAX_FIELD_SELECTOR_DEPTH,
  MAX_FIELD_SELECTORS,
  parseFieldSelectors,
  selectDocumentFields,
} from "./field-selectors.ts";

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
            timestamps: {
              createdAt: "2026-07-21T09:00:00.000Z",
            },
            children: [],
            richText: {
              blocks: [],
              plainText: "A fixture note",
            },
          },
          {
            type: "FILE",
            id: "fixture-file",
            title: "Brief",
            location: { parentId: "fixture-column" },
            timestamps: {},
            children: [],
            file: {
              filename: "brief.pdf",
              url: "https://files.example/brief.pdf",
            },
          },
          {
            type: "COMMENT_THREAD",
            id: "fixture-comments",
            location: { parentId: "fixture-column" },
            timestamps: {},
            children: [],
            comments: [
              {
                id: "fixture-comment",
                threadId: "fixture-thread",
                userId: "private-user",
                richText: {
                  blocks: [],
                  plainText: "Looks good",
                },
              },
            ],
          },
          {
            type: "UNKNOWN",
            id: "fixture-unknown",
            location: { parentId: "fixture-column" },
            timestamps: {},
            children: [],
            elementType: "SECRET",
            content: {
              accessToken: "private-token",
              nested: {
                privateMetadata: "private-metadata",
                visible: "safe",
              },
            },
          },
        ],
      },
    ],
    defaultColorPalette: [],
  },
} satisfies MilanoteDocument;

describe("field selectors", () => {
  it("normalizes whitespace and removes duplicate selectors", () => {
    expect(parseFieldSelectors(" board.id,board.children.id, board.id ", "include")).toEqual([
      "board.id",
      "board.children.id",
    ]);
  });

  it.each([
    ["board.password", "Unknown field selector"],
    ["board.userId", "Unknown field selector"],
    ["board..id", "Invalid include field selector syntax"],
    ["board.children[0].id", "Invalid include field selector syntax"],
    [",board.id", "must not contain an empty field selector"],
  ])("rejects an invalid include selector: %s", (selector, message) => {
    expect(() => parseFieldSelectors(selector, "include")).toThrow(message);
  });

  it("enforces selector count and path depth limits", () => {
    const tooMany = Array.from({ length: MAX_FIELD_SELECTORS + 1 }, () => "board.id").join(",");
    const tooDeep = Array.from({ length: MAX_FIELD_SELECTOR_DEPTH + 1 }, () => "children").join(
      ".",
    );

    expect(() => parseFieldSelectors(tooMany, "exclude")).toThrow(
      `more than ${MAX_FIELD_SELECTORS}`,
    );
    expect(() => parseFieldSelectors(tooDeep, "include")).toThrow(
      `exceed ${MAX_FIELD_SELECTOR_DEPTH}`,
    );
  });

  it("reports which query parameter contains an invalid selector", () => {
    try {
      parseFieldSelectors("board.password", "exclude");
      throw new Error("Expected selector parsing to fail.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(FieldSelectorError);
      expect((error as FieldSelectorError).field).toBe("exclude");
    }
  });

  it("projects nested arrays and recursive children with a whitelist", () => {
    const include = parseFieldSelectors(
      "version,source.provider,board.id,board.title,board.children.id,board.children.type,board.children.title,board.children.children.id,board.children.children.type",
      "include",
    );

    expect(selectDocumentFields(documentFixture, { include })).toEqual({
      version: 1,
      source: {
        provider: "milanote",
      },
      board: {
        id: "fixture-root",
        title: "Fixture board",
        children: [
          {
            id: "fixture-column",
            type: "COLUMN",
            title: "Ideas",
            children: [
              { id: "fixture-card", type: "CARD" },
              { id: "fixture-file", type: "FILE" },
              { id: "fixture-comments", type: "COMMENT_THREAD" },
              { id: "fixture-unknown", type: "UNKNOWN" },
            ],
          },
        ],
      },
    });
  });

  it("distinguishes one-level and recursive wildcards", () => {
    const oneLevel = parseFieldSelectors("board.*.id", "include");
    const recursive = parseFieldSelectors("board.**.id", "include");

    expect(selectDocumentFields(documentFixture, { include: oneLevel })).toEqual({
      board: {
        children: [{ id: "fixture-column" }],
      },
    });
    expect(selectDocumentFields(documentFixture, { include: recursive })).toEqual({
      board: {
        id: "fixture-root",
        children: [
          {
            id: "fixture-column",
            children: [
              { id: "fixture-card", children: [] },
              { id: "fixture-file", children: [] },
              {
                id: "fixture-comments",
                children: [],
                comments: [{ id: "fixture-comment" }],
              },
              { id: "fixture-unknown", children: [] },
            ],
          },
        ],
      },
    });
  });

  it("removes blacklisted fields at every depth", () => {
    const exclude = parseFieldSelectors("fetchedAt,**.timestamps,**.file.url", "exclude");
    const result = selectDocumentFields(documentFixture, { exclude, view: "full" });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("fetchedAt");
    expect(serialized).not.toContain("timestamps");
    expect(serialized).not.toContain("https://files.example/brief.pdf");
    expect(result).toHaveProperty("board.children.0.children.1.file.filename", "brief.pdf");
  });

  it("applies permanent sensitive-field filtering before user selectors", () => {
    const full = selectDocumentFields(documentFixture, { view: "full" });
    const includeContent = selectDocumentFields(documentFixture, {
      include: parseFieldSelectors("board.**.comments,board.**.content", "include"),
    });

    for (const result of [full, includeContent]) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("private-user");
      expect(serialized).not.toContain("private-token");
      expect(serialized).not.toContain("private-metadata");
      expect(serialized).toContain("safe");
    }
  });

  it("preserves required object structure when security filtering removes every field", () => {
    const deniedOnlyDocument: MilanoteDocument = {
      ...documentFixture,
      board: {
        ...documentFixture.board,
        children: [
          {
            type: "UNKNOWN",
            id: "denied-only",
            location: {},
            timestamps: {},
            children: [],
            elementType: "SECRET",
            content: {
              accessToken: "private-token",
              userId: "private-user",
            },
          },
        ],
      },
    };

    const result = selectDocumentFields(deniedOnlyDocument, { view: "full" });

    expect(result).toHaveProperty("board.children.0.content", {});
    expect(milanoteDocumentSchema.safeParse(result).success).toBe(true);
  });

  it("uses compact, standard, and full preset views", () => {
    const compact = selectDocumentFields(documentFixture, { view: "compact" });
    const standard = selectDocumentFields(documentFixture, { view: "standard" });
    const full = selectDocumentFields(documentFixture, { view: "full" });

    expect(compact).toHaveProperty("source.boardId", "fixture-board");
    expect(compact).not.toHaveProperty("fetchedAt");
    expect(compact).not.toHaveProperty("board.location");
    expect(standard).toHaveProperty("fetchedAt");
    expect(standard).toHaveProperty("board.children.0.children.0.richText.plainText");
    expect(standard).not.toHaveProperty("board.location");
    expect(full).toHaveProperty("board.location");
    expect(full).not.toHaveProperty("board.children.0.children.2.comments.0.userId");
  });

  it("retains selected empty arrays while dropping empty projected objects", () => {
    const include = parseFieldSelectors(
      "board.location,board.**.id,board.**.children,board.**.image",
      "include",
    );
    const result = selectDocumentFields(documentFixture, { include });

    expect(result).not.toHaveProperty("board.location");
    expect(result).toHaveProperty("board.children.0.children.0.children", []);
    expect(result).not.toHaveProperty("board.children.0.children.0.image");
  });
});
