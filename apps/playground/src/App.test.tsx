import type { MilanoteDocument } from "@milanote-api/parser";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";

import { App } from "./App.tsx";

const shareUrl = "https://app.milanote.com/fixture-board/shared-view?p=permission-fixture";
const secondShareUrl = "https://app.milanote.com/another-board/shared-view?p=another-permission";

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

async function submitShareUrl(user: ReturnType<typeof userEvent.setup>, value = shareUrl) {
  const input = screen.getByRole("textbox", { name: "Milanote 分享链接" });
  await user.clear(input);
  await user.type(input, value);
  await user.click(screen.getByRole("button", { name: /解析/ }));
}

describe("App", () => {
  it("starts empty and rejects invalid links before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);

    expect(screen.getByText("输入分享链接开始解析")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();

    await submitShareUrl(user, "https://example.com/private");

    expect(screen.getByText("请输入有效的 Milanote 公开分享链接。")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encodes the submitted URL and supports Canvas, JSON, and copy states", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: documentFixture, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await submitShareUrl(user);

    expect(await screen.findByText("A fixture note")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      `/api/search?${new URLSearchParams({ url: shareUrl }).toString()}`,
      expect.objectContaining({ cache: "no-cache" }),
    );

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.getByText(/"boardId": "fixture-board"/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制 JSON" }));
    expect(await screen.findByText("JSON 已复制")).toBeInTheDocument();
  });

  it("shows a safe API error and retries the submitted link", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: "UPSTREAM_ERROR",
            message: "The board source could not be read.",
          },
          ok: false,
        },
        502,
      ),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await submitShareUrl(user);

    expect(await screen.findByText("无法载入画板")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新尝试" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("aborts the active request when a new link is submitted", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      if (firstSignal === undefined) {
        firstSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }

      return Promise.resolve(jsonResponse({ data: documentFixture, ok: true }));
    });
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await submitShareUrl(user);
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    await submitShareUrl(user, secondShareUrl);

    expect(await screen.findByText("A fixture note")).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
