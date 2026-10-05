import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ResponsePreview } from "./ResponsePreview.tsx";

describe("response previews", () => {
  it("renders nested partial boards using the returned fields", () => {
    const parsed = {
      ok: true,
      data: {
        board: {
          title: "Partial board",
          children: [{ title: "Nested card", richText: { plainText: "A note" } }],
        },
      },
    };
    render(<ResponsePreview parsed={parsed} text={JSON.stringify(parsed)} />);
    expect(screen.getByRole("heading", { name: "Partial board" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nested card" })).toBeInTheDocument();
    expect(screen.getByText("A note")).toBeInTheDocument();
  });
  it("distinguishes omitted children from a returned empty array", () => {
    const { rerender } = render(
      <ResponsePreview parsed={{ ok: true, data: { board: { title: "Root" } } }} text="" />,
    );
    expect(screen.getByText("此结果未包含子内容字段。")).toBeInTheDocument();
    rerender(
      <ResponsePreview
        parsed={{ ok: true, data: { board: { title: "Root", children: [] } } }}
        text=""
      />,
    );
    expect(screen.queryByText("此结果未包含子内容字段。")).not.toBeInTheDocument();
    expect(screen.getByText("子内容列表为空。")).toBeInTheDocument();
  });
  it("preserves a falsy JSON value at the root", () => {
    render(<ResponsePreview parsed={0} text="0" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
  it("preserves null, empty, falsy and error values in arrays", () => {
    const parsed = [null, "", false, 0, { error: { message: "Denied" } }];
    render(<ResponsePreview parsed={parsed} text={JSON.stringify(parsed)} />);
    for (const value of ["null", '""', "false", "0", "Denied"])
      expect(screen.getByText(value)).toBeInTheDocument();
  });
  it("renders non-JSON error bodies as text, never HTML", () => {
    const text = '<script>alert("unsafe")</script>Gateway offline';
    const { container } = render(<ResponsePreview parsed={undefined} text={text} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector("script")).toBeNull();
  });
});
