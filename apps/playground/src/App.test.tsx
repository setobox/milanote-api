import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { EXAMPLE_URL } from "@milanote-api/api/contracts";
import { fieldViewExclusions } from "@milanote-api/api/selectors";
import { App } from "./App.tsx";
import { HISTORY_KEY, SAVED_KEY } from "./features/workbench/model.ts";

// Editor internals require browser layout; test application behavior through its public adapter.
vi.mock("./features/workbench/JsonEditor.tsx", () => ({
  JsonEditor: ({
    value,
    onChange,
    label = "JSON 请求体",
    readOnly,
  }: {
    value: string;
    onChange?: (value: string) => void;
    label?: string;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label={label}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));
const payload = {
  ok: true,
  data: { board: { title: "Private fixture" } },
  meta: {
    scope: "root",
    complete: true,
    warnings: [],
    unloadedBoardIds: [],
    upstreamRequests: 2,
    timings: { permission: 2, boards: 4, parse: 1, total: 7 },
  },
};
const response = () =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", "Server-Timing": "boards;dur=4" },
  });
function fill(): void {
  fireEvent.change(screen.getByLabelText(/Milanote 分享链接/), { target: { value: EXAMPLE_URL } });
}
describe("API workbench", () => {
  it("preserves drafts and sends with the configured address and session token", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(async () => response());
    render(<App fetcher={fetcher} />);
    fill();
    await user.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("API 服务地址"), {
      target: { value: "https://configured.test" },
    });
    fireEvent.change(screen.getByLabelText("Bearer Token（可选）"), {
      target: { value: "session-token" },
    });
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "返回调试台" }));
    expect(screen.getByLabelText(/Milanote 分享链接/)).toHaveValue(EXAMPLE_URL);
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledWith(
      "https://configured.test/api/boards/parse",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
      }),
    );
    expect(JSON.stringify(localStorage)).not.toContain("session-token");
  });
  it("updates the current request from presets and derives its active mode from form and JSON", async () => {
    const user = userEvent.setup();
    render(<App />);
    fill();
    await user.click(screen.getByRole("button", { name: "完整递归" }));
    expect(screen.getByLabelText(/Milanote 分享链接/)).toHaveValue(EXAMPLE_URL);
    expect(screen.getByRole("button", { name: "完整递归" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "精简" }));
    expect(screen.getByRole("button", { name: "精简" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "完整递归" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/排除字段/)).toHaveValue(fieldViewExclusions.compact.join("\n"));
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON 请求体"), {
      target: { value: JSON.stringify({ url: EXAMPLE_URL, scope: "root", view: "standard" }) },
    });
    await user.click(screen.getByRole("tab", { name: "参数" }));
    expect(screen.getByRole("button", { name: "标准" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/排除字段/)).toHaveValue(fieldViewExclusions.standard.join("\n"));
    fireEvent.change(screen.getByLabelText(/排除字段/), { target: { value: "**.timestamps" } });
    expect(screen.getByRole("button", { name: "自定义" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(
      JSON.parse((screen.getByLabelText("JSON 请求体") as HTMLTextAreaElement).value),
    ).toMatchObject({ view: "full", exclude: ["**.timestamps"] });
  });
  it("aborts an in-flight request when its tab is closed", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    render(<App fetcher={fetcher} />);
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    await user.click(screen.getByRole("button", { name: "新建请求" }));
    await user.click(screen.getAllByRole("button", { name: "关闭 根画板" })[0]!);
    expect(signal?.aborted).toBe(true);
  });
  it("starts without requests, validates input, and sends root POST with no-store", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const user = userEvent.setup();
    render(<App apiOrigin="https://api.test" fetcher={fetcher} />);
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("检查 JSON");
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() =>
      expect(screen.getByLabelText("响应正文")).toHaveValue(JSON.stringify(payload, null, 2)),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/api/boards/parse",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ url: EXAMPLE_URL, scope: "root", view: "full" }),
      }),
    );
    expect(localStorage.getItem(HISTORY_KEY)).not.toContain("your-permission");
    expect(localStorage.getItem(HISTORY_KEY)).not.toContain("Private fixture");
    expect(localStorage.getItem(SAVED_KEY)).toBeNull();
  });
  it("synchronizes JSON and form, retaining invalid JSON without sending", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const user = userEvent.setup();
    render(<App fetcher={fetcher} />);
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON 请求体"), { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByLabelText("JSON 请求体")).toHaveValue("{");
    fireEvent.change(screen.getByLabelText("JSON 请求体"), {
      target: {
        value: JSON.stringify({ url: EXAMPLE_URL, scope: "tree", include: ["board.title"] }),
      },
    });
    await user.click(screen.getByRole("tab", { name: "参数" }));
    expect(screen.getByRole("button", { name: "完整递归" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "自定义" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("retains non-JSON errors and HTTP headers", async () => {
    const user = userEvent.setup();
    render(
      <App
        fetcher={async () =>
          new Response("Gateway offline", { status: 502, headers: { "x-trace": "test" } })
        }
      />,
    );
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByLabelText("响应正文")).toHaveValue("Gateway offline");
    await user.click(screen.getByRole("tab", { name: "响应头" }));
    expect(screen.getByText("x-trace")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
  });
  it("isolates tabs and ignores a cancelled late response", async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const user = userEvent.setup();
    render(<App fetcher={fetcher} />);
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await user.click(screen.getByRole("button", { name: "新建请求" }));
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await act(async () => {
      resolvers[1]?.(new Response('{"second":true}'));
    });
    await act(async () => {
      resolvers[0]?.(new Response('{"old":true}'));
    });
    expect(screen.getByLabelText("响应正文")).toHaveValue(
      JSON.stringify({ second: true }, null, 2),
    );
    expect(screen.getByLabelText("响应正文")).not.toHaveValue(
      JSON.stringify({ old: true }, null, 2),
    );
  });
  it("saves only on explicit action and restores saved configuration", async () => {
    const user = userEvent.setup();
    render(<App apiOrigin="https://api.test" />);
    fill();
    expect(localStorage.getItem(SAVED_KEY)).toBeNull();
    await user.click(screen.getByRole("button", { name: "保存请求" }));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "My request" } });
    await user.click(screen.getByRole("button", { name: "保存到本地" }));
    expect(localStorage.getItem(SAVED_KEY)).toContain("your-permission");
    expect(localStorage.getItem(SAVED_KEY)).not.toContain('"result"');
    await user.click(screen.getByRole("button", { name: "My request" }));
    expect(screen.getByRole("tab", { name: /My request/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("keeps simultaneous responses in their own tabs regardless of completion order", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const user = userEvent.setup();
    render(<App fetcher={() => new Promise((resolve) => resolvers.push(resolve))} />);
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "新建请求" }));
    await user.click(screen.getByRole("button", { name: "完整递归" }));
    fill();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await act(async () => {
      resolvers[1]!(new Response('{"tab":2}'));
    });
    await act(async () => {
      resolvers[0]!(new Response('{"tab":1}'));
    });
    expect(screen.getByLabelText("响应正文")).toHaveValue(JSON.stringify({ tab: 2 }, null, 2));
    await user.click(screen.getAllByRole("tab", { name: /POST根画板/ })[0]!);
    expect(screen.getByLabelText("响应正文")).toHaveValue(JSON.stringify({ tab: 1 }, null, 2));
    expect(screen.getByRole("button", { name: "根画板" })).toHaveAttribute("aria-pressed", "true");
  });
  it("retains unfinished lines while typing and silently cleans rules on blur", async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByLabelText(/排除字段/);
    await user.type(field, "**.");
    expect(field).toHaveValue("**.");
    await user.type(
      field,
      "location{Enter}**{Enter}board.unknown{Enter}**.timestamps{Enter}**.location",
    );
    expect(field).toHaveValue("**.location\n**\nboard.unknown\n**.timestamps\n**.location");
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(
      JSON.parse((screen.getByLabelText("JSON 请求体") as HTMLTextAreaElement).value).exclude,
    ).toEqual(["**.location", "**.timestamps"]);
  });
  it("mirrors cleaned parameters in the URL and body and restores the base address on replay", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(async () => response());
    render(<App apiOrigin="https://api.test" fetcher={fetcher} />);
    fill();
    await user.click(screen.getByRole("button", { name: "完整递归" }));
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("JSON 请求体"), {
      target: {
        value: JSON.stringify({
          url: EXAMPLE_URL,
          scope: "tree",
          view: "full",
          exclude: ["**", "board.nope", "**.location", "**.location"],
        }),
      },
    });
    expect(screen.getByLabelText("API 请求地址")).toHaveTextContent(
      "?scope=tree&exclude=**.location",
    );
    await user.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByLabelText("响应正文");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/api/boards/parse?scope=tree&exclude=**.location",
      expect.objectContaining({
        body: JSON.stringify({
          url: EXAMPLE_URL,
          scope: "tree",
          view: "full",
          exclude: ["**.location"],
        }),
      }),
    );
    expect(screen.getByLabelText("JSON 请求体")).toHaveValue(
      JSON.stringify(
        { url: EXAMPLE_URL, scope: "tree", view: "full", exclude: ["**.location"] },
        null,
        2,
      ),
    );
    await user.click(screen.getByRole("button", { name: /200\s*解析画板/ }));
    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByLabelText("API 服务地址")).toHaveValue("https://api.test");
  });
  it("uses multiline include rules and clears mutually exclusive exclusions", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "自定义" }));
    expect(screen.getByLabelText(/排除字段/)).not.toHaveValue("");
    await user.type(screen.getByLabelText(/保留字段/), "board.id{Enter}board.title{Enter}**");
    await user.tab();
    expect(screen.getByLabelText(/保留字段/)).toHaveValue("board.id\nboard.title");
    await user.click(screen.getByRole("button", { name: "自定义" }));
    expect(screen.getByLabelText(/保留字段/)).toHaveValue("board.id\nboard.title");
    expect(screen.getByLabelText(/排除字段/)).toHaveValue("");
    await user.click(screen.getByRole("tab", { name: "JSON" }));
    const body = JSON.parse((screen.getByLabelText("JSON 请求体") as HTMLTextAreaElement).value);
    expect(body.include).toEqual(["board.id", "board.title"]);
    expect(body).not.toHaveProperty("view");
    expect(body).not.toHaveProperty("exclude");
  });
});
