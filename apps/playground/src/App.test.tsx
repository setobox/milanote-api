import type { MilanoteDocument } from "@milanote-api/parser";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";

import { App } from "./App.tsx";

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
    children: [
      {
        type: "CARD",
        id: "fixture-card",
        location: { parentId: "fixture-root" },
        timestamps: {},
        children: [],
        richText: {
          blocks: [],
          plainText: "A fixture note",
        },
      },
    ],
    defaultColorPalette: [],
  },
} satisfies MilanoteDocument;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("App", () => {
  it("loads the configured board and switches between canvas and JSON", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: documentFixture, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);

    expect(screen.getByText("正在读取并规范化共享画板…")).toBeInTheDocument();
    expect(await screen.findByText("A fixture note")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ cache: "no-cache" }),
    );

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.getByText(/"boardId": "fixture-board"/)).toBeInTheDocument();
  });

  it("shows a safe API error and allows retrying", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: { code: "UPSTREAM_ERROR", message: "The board source could not be read." },
          ok: false,
        },
        502,
      ),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);

    expect(await screen.findByText("无法载入画板")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新尝试" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
