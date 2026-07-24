import { describe, expect, test } from "vite-plus/test";

import {
  milanoteDocumentSchema,
  milanoteNodeSchema,
  milanoteShareUrlSchema,
  type MilanoteDocument,
} from "../src/index.ts";

const documentFixture = {
  version: 1,
  source: {
    provider: "milanote",
    boardId: "board_schema_demo",
  },
  fetchedAt: "2031-02-03T04:05:06.000Z",
  board: {
    id: "board_schema_demo",
    type: "BOARD",
    title: "Schema demo",
    location: { rootBoard: true },
    timestamps: {},
    defaultColorPalette: [],
    children: [
      {
        id: "column_schema_demo",
        type: "COLUMN",
        title: "Ideas",
        location: { parentId: "board_schema_demo" },
        timestamps: {},
        children: [
          {
            id: "card_schema_demo",
            type: "CARD",
            richText: { blocks: [], plainText: "A validated card" },
            location: { parentId: "column_schema_demo" },
            timestamps: {},
            children: [],
          },
        ],
      },
    ],
  },
} satisfies MilanoteDocument;

describe("normalized Milanote schemas", () => {
  test("validates a recursive discriminated document", () => {
    expect(milanoteDocumentSchema.parse(documentFixture)).toEqual(documentFixture);
    expect(milanoteNodeSchema.parse(documentFixture.board.children[0])).toEqual(
      documentFixture.board.children[0],
    );
  });

  test("rejects an invalid nested normalized node", () => {
    const invalidDocument = structuredClone(documentFixture) as Record<string, unknown>;
    const board = invalidDocument.board as { children: Array<Record<string, unknown>> };
    board.children[0] = { ...board.children[0], type: "UNSUPPORTED" };

    expect(milanoteDocumentSchema.safeParse(invalidDocument).success).toBe(false);
  });

  test("validates only bounded Milanote share URLs", () => {
    expect(
      milanoteShareUrlSchema.safeParse(
        "https://app.milanote.com/board_schema_demo/shared-view?p=permission_schema_demo",
      ).success,
    ).toBe(true);
    expect(
      milanoteShareUrlSchema.safeParse(
        "https://app.milanote.com.evil.test/board_schema_demo?p=permission_schema_demo",
      ).success,
    ).toBe(false);
    expect(
      milanoteShareUrlSchema.safeParse(`https://app.milanote.com/${"x".repeat(2100)}`).success,
    ).toBe(false);
  });
});
