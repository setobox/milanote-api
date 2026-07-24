import type { MilanoteNode } from "@milanote-api/parser";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";

import { BoardElement } from "./BoardElement.tsx";

const richText = {
  blocks: [],
  plainText: "Item text",
};

function baseNode(id: string) {
  return {
    children: [] as MilanoteNode[],
    id,
    location: {},
    timestamps: {},
  };
}

const typeCodeNodes: MilanoteNode[] = [
  {
    ...baseNode("board"),
    type: "BOARD",
    title: "Nested board",
    defaultColorPalette: [],
  },
  {
    ...baseNode("column"),
    type: "COLUMN",
    title: "Ideas",
  },
  {
    ...baseNode("card"),
    type: "CARD",
    richText,
  },
  {
    ...baseNode("image"),
    type: "IMAGE",
  },
  {
    ...baseNode("file"),
    type: "FILE",
    title: "Project brief",
  },
  {
    ...baseNode("link"),
    type: "LINK",
    title: "Reference",
  },
  {
    ...baseNode("task-list"),
    type: "TASK_LIST",
    title: "Next steps",
  },
  {
    ...baseNode("task"),
    type: "TASK",
    richText,
  },
  {
    ...baseNode("table"),
    type: "TABLE",
    table: {
      columnWidths: [],
      rows: [],
    },
  },
  {
    ...baseNode("comments"),
    type: "COMMENT_THREAD",
    comments: [],
  },
  {
    ...baseNode("skeleton"),
    type: "SKELETON",
  },
  {
    ...baseNode("unknown"),
    type: "UNKNOWN",
    content: {},
    elementType: "AUDIO_NOTE",
  },
];

describe("BoardElement", () => {
  it("does not render technical type-code tags for any node kind", () => {
    render(
      <>
        {typeCodeNodes.map((node) => (
          <BoardElement key={node.id} node={node} />
        ))}
      </>,
    );

    for (const code of [
      "BRD",
      "COL",
      "NTE",
      "IMG",
      "FIL",
      "LNK",
      "LST",
      "TSK",
      "TBL",
      "CMT",
      "—",
      "???",
    ]) {
      expect(screen.queryByText(code)).not.toBeInTheDocument();
    }
  });

  it("reveals a column child count only on hover, focus, or focus within", async () => {
    const user = userEvent.setup();
    const column: MilanoteNode = {
      ...baseNode("column-with-child"),
      type: "COLUMN",
      title: "Research",
      children: [
        {
          ...baseNode("child-link"),
          type: "LINK",
          title: "Source",
          url: "https://example.test/source",
        },
      ],
    };

    render(<BoardElement node={column} />);

    const target = screen.getByRole("region", { name: "Column: Research" });
    const childLink = screen.getByRole("link", { name: "Source" });

    expect(target).toHaveAccessibleDescription("Items: 1");
    expect(screen.getByText("Items: 1")).toHaveClass("sr-only");
    expect(screen.queryByText("1", { selector: '[aria-hidden="true"]' })).toBeNull();

    await user.hover(target);
    expect(screen.getByText("1", { selector: '[aria-hidden="true"]' })).toBeVisible();

    await user.unhover(target);
    expect(screen.queryByText("1", { selector: '[aria-hidden="true"]' })).toBeNull();

    await user.tab();
    expect(target).toHaveFocus();
    expect(screen.getByText("1", { selector: '[aria-hidden="true"]' })).toBeVisible();

    await user.tab();
    expect(childLink).toHaveFocus();
    expect(screen.getByText("1", { selector: '[aria-hidden="true"]' })).toBeVisible();

    await user.tab();
    expect(screen.queryByText("1", { selector: '[aria-hidden="true"]' })).toBeNull();
  });

  it("keeps a zero comment count accessible and reveals it on hover or focus", async () => {
    const user = userEvent.setup();
    const commentThread: MilanoteNode = {
      ...baseNode("empty-comments"),
      type: "COMMENT_THREAD",
      comments: [],
    };

    render(<BoardElement node={commentThread} />);

    const target = screen.getByRole("complementary", { name: "Comments" });

    expect(target).toHaveAccessibleDescription("Comments: 0");
    expect(screen.getByText("Comments: 0")).toHaveClass("sr-only");
    expect(screen.queryByText("0", { selector: '[aria-hidden="true"]' })).toBeNull();

    await user.hover(target);
    expect(screen.getByText("0", { selector: '[aria-hidden="true"]' })).toBeVisible();

    await user.unhover(target);
    expect(screen.queryByText("0", { selector: '[aria-hidden="true"]' })).toBeNull();

    await user.tab();
    expect(target).toHaveFocus();
    expect(screen.getByText("0", { selector: '[aria-hidden="true"]' })).toBeVisible();
  });
});
