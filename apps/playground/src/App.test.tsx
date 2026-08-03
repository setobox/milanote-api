import type { MilanoteDocument } from "@milanote-api/parser";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  buildBoardRequestPath,
  customPresetStorageKey,
  defaultIncludeSelectors,
  withSelectorDependencies,
} from "@/features/api/request.ts";

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

const compactProjection = {
  version: 1,
  source: {
    provider: "milanote",
    boardId: "fixture-board",
  },
  board: {
    id: "fixture-root",
    type: "BOARD",
    title: "Fixture board",
    children: [
      {
        id: "fixture-card",
        type: "CARD",
      },
    ],
  },
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}

async function enterShareUrl(
  user: ReturnType<typeof userEvent.setup>,
  value = shareUrl,
): Promise<void> {
  const input = screen.getByRole("textbox", { name: "Milanote 分享链接" });
  await user.clear(input);
  await user.type(input, value);
}

async function openAdvancedFieldSettings(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /高级字段筛选/ }));
  expect(await screen.findByRole("dialog", { name: "高级字段筛选" })).toBeInTheDocument();
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function applyFilterSettings(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "应用筛选" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

async function submitShareUrl(
  user: ReturnType<typeof userEvent.setup>,
  value = shareUrl,
): Promise<void> {
  await enterShareUrl(user, value);
  await user.click(screen.getByRole("button", { name: /解析/ }));
}

describe("App", () => {
  it("starts empty and rejects invalid links before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);

    expect(screen.getByText("连接你的公开画板")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "返回预设" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "解析画板" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await openAdvancedFieldSettings(user);
    expect(screen.getByRole("button", { name: "复制草稿 API 链接" })).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");

    await submitShareUrl(user, "https://example.com/private");

    expect(screen.getByText("请输入有效的 Milanote 公开分享链接。")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads the default full detail response and supports Canvas and JSON", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: documentFixture, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await submitShareUrl(user);

    expect(await screen.findByText("A fixture note")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      buildBoardRequestPath(shareUrl, {
        exclude: [],
        mode: "view",
        view: "full",
      }),
      expect.objectContaining({ cache: "no-cache" }),
    );

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.getByText(/"boardId": "fixture-board"/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制 JSON" }));
    expect(await screen.findByText("JSON 已复制")).toBeInTheDocument();
  });

  it("copies the exact absolute API URL used by the current controls", async () => {
    const user = userEvent.setup();
    const requestPath = buildBoardRequestPath(shareUrl, {
      exclude: [],
      mode: "view",
      view: "full",
    });

    render(<App apiOrigin="https://api.example" />);
    await enterShareUrl(user);
    await openAdvancedFieldSettings(user);
    await user.click(screen.getByRole("button", { name: "复制草稿 API 链接" }));

    expect(await screen.findByText("API 链接已复制")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(`https://api.example${requestPath}`);
  });

  it("serializes preset and blacklist controls and renders partial data as JSON only", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: compactProjection, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await selectOption(user, "返回预设", "标准");
    await openAdvancedFieldSettings(user);
    await user.click(
      screen.getByRole("checkbox", {
        name: "排除所有时间戳 (**.timestamps)",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "排除文件下载地址 (**.file.url)",
      }),
    );
    await applyFilterSettings(user);
    await submitShareUrl(user);

    const requestPath = buildBoardRequestPath(shareUrl, {
      exclude: ["**.timestamps", "**.file.url"],
      mode: "view",
      view: "standard",
    });
    expect(fetcher).toHaveBeenCalledWith(
      requestPath,
      expect.objectContaining({ cache: "no-cache" }),
    );
    expect(await screen.findByText("字段投影结果")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Canvas" })).not.toBeInTheDocument();
    expect(screen.getByText(/"fixture-root"/)).toBeInTheDocument();
  });

  it("submits the default whitelist without producing an illegal query combination", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: compactProjection, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await enterShareUrl(user);
    await openAdvancedFieldSettings(user);
    await selectOption(user, "筛选方式", "仅保留选中字段");
    await applyFilterSettings(user);
    await submitShareUrl(user);

    const requestPath = buildBoardRequestPath(shareUrl, {
      include: withSelectorDependencies(defaultIncludeSelectors),
      mode: "include",
    });
    const parsedRequest = new URL(requestPath, "https://playground.invalid");

    expect(fetcher).toHaveBeenCalledWith(
      requestPath,
      expect.objectContaining({ cache: "no-cache" }),
    );
    expect(parsedRequest.searchParams.has("view")).toBe(false);
    expect(parsedRequest.searchParams.has("exclude")).toBe(false);
    expect(await screen.findByText("字段投影结果")).toBeInTheDocument();
  });

  it("prevents an empty whitelist from being submitted or copied", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const user = userEvent.setup();
    const defaultCheckboxNames = [
      "包含文档版本 (version)",
      "包含来源类型 (source.provider)",
      "包含来源画板 ID (source.boardId)",
      "包含所有节点 ID (board.**.id)",
      "包含所有节点类型 (board.**.type)",
      "包含所有节点标题 (board.**.title)",
      "包含来源信息 (source)",
    ];

    render(<App fetcher={fetcher} />);
    await openAdvancedFieldSettings(user);
    await selectOption(user, "筛选方式", "仅保留选中字段");
    for (const name of defaultCheckboxNames) {
      await user.click(screen.getByRole("checkbox", { name }));
    }

    expect(screen.getByRole("button", { name: "复制草稿 API 链接" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "应用筛选" }));

    expect(screen.getByText("白名单模式至少需要选择一个字段。")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads a custom preset from localStorage and keeps parent selectors selected", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(customPresetStorageKey, JSON.stringify(["source.provider"]));

    render(<App />);
    await selectOption(user, "返回预设", "自定义（本地保存）");

    expect(screen.getByRole("checkbox", { name: "包含来源信息 (source)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "包含来源类型 (source.provider)" })).toBeChecked();
  });

  it("keeps draft filter changes local until they are applied", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: documentFixture, ok: true }),
    );
    const user = userEvent.setup();

    render(<App fetcher={fetcher} />);
    await enterShareUrl(user);
    await openAdvancedFieldSettings(user);
    await user.click(
      screen.getByRole("checkbox", {
        name: "排除所有时间戳 (**.timestamps)",
      }),
    );
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /高级字段筛选/ })).toHaveTextContent("未设置");
    await user.click(screen.getByRole("button", { name: "解析画板" }));

    expect(fetcher).toHaveBeenCalledWith(
      buildBoardRequestPath(shareUrl, {
        exclude: [],
        mode: "view",
        view: "full",
      }),
      expect.objectContaining({ cache: "no-cache" }),
    );
  });

  it("persists a manual appearance choice and updates the document color", async () => {
    const user = userEvent.setup();
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.append(themeColor);

    const { unmount } = render(<App />);
    await user.click(screen.getByRole("button", { name: "切换为夜间模式" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("vitepress-theme-appearance")).toBe("dark");
    expect(themeColor.content).toBe("#141413");

    unmount();
    themeColor.remove();
  });

  it("shows selector errors and retries the exact submitted request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: "INVALID_FIELD_SELECTOR",
            field: "exclude",
            message: "Unknown field selector.",
          },
          ok: false,
        },
        400,
      ),
    );
    const user = userEvent.setup();
    const submittedPath = buildBoardRequestPath(shareUrl, {
      exclude: [],
      mode: "view",
      view: "full",
    });

    render(<App fetcher={fetcher} />);
    await submitShareUrl(user);

    expect(await screen.findByText("无法载入画板")).toBeInTheDocument();
    expect(screen.getByText("INVALID_FIELD_SELECTOR")).toBeInTheDocument();
    await selectOption(user, "返回预设", "精简");
    await user.click(screen.getByRole("button", { name: "重新尝试" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher.mock.calls.map(([request]) => request)).toEqual([submittedPath, submittedPath]);
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

  it("ignores a stale response when the aborted fetcher resolves late", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(() => {
      if (resolveFirst === undefined) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
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

    await act(async () => {
      resolveFirst?.(
        jsonResponse(
          {
            error: {
              code: "BOARD_NOT_FOUND",
              message: "The shared board is unavailable.",
            },
            ok: false,
          },
          404,
        ),
      );
      await Promise.resolve();
    });

    expect(screen.getByText("A fixture note")).toBeInTheDocument();
    expect(screen.queryByText("无法载入画板")).not.toBeInTheDocument();
  });
});
