import { describe, expect, it } from "vite-plus/test";

import { parseFieldSelectors } from "../../../worker/field-selectors.ts";
import {
  buildAbsoluteApiUrl,
  buildBoardRequestPath,
  fieldSelectorOptions,
  type PlaygroundFilter,
} from "./request.ts";

const shareUrl = "https://app.milanote.com/fixture-board/shared-view?p=permission-fixture";

describe("Playground API request builder", () => {
  it("builds the default full detail request without a redundant view", () => {
    expect(
      buildBoardRequestPath(shareUrl, {
        exclude: [],
        mode: "view",
        view: "full",
      }),
    ).toBe(`/api/detail?${new URLSearchParams({ url: shareUrl }).toString()}`);
  });

  it.each(["compact", "standard"] as const)("serializes the %s preset view", (view) => {
    const path = buildBoardRequestPath(shareUrl, {
      exclude: [],
      mode: "view",
      view,
    });
    const url = new URL(path, "https://playground.example");

    expect(url.pathname).toBe("/api/detail");
    expect(url.searchParams.get("url")).toBe(shareUrl);
    expect(url.searchParams.get("view")).toBe(view);
  });

  it("serializes a preset with a stable, deduplicated blacklist", () => {
    const path = buildBoardRequestPath(shareUrl, {
      exclude: ["**.timestamps", "**.file.url", "**.timestamps"],
      mode: "view",
      view: "standard",
    });
    const url = new URL(path, "https://playground.example");

    expect(url.searchParams.get("view")).toBe("standard");
    expect(url.searchParams.get("exclude")).toBe("**.file.url,**.timestamps");
  });

  it("serializes a stable, deduplicated whitelist", () => {
    const path = buildBoardRequestPath(shareUrl, {
      include: ["board.title", "version", "board.title"],
      mode: "include",
    });
    const url = new URL(path, "https://playground.example");

    expect(url.searchParams.get("include")).toBe("board.title,version");
    expect(url.searchParams.has("view")).toBe(false);
    expect(url.searchParams.has("exclude")).toBe(false);
  });

  it("rejects an empty whitelist", () => {
    expect(() => buildBoardRequestPath(shareUrl, { include: [], mode: "include" })).toThrow(
      "EMPTY_INCLUDE",
    );
  });

  it("encodes the share URL once and preserves its permission parameter", () => {
    const path = buildBoardRequestPath(shareUrl, {
      exclude: [],
      mode: "view",
      view: "full",
    });
    const url = new URL(path, "https://playground.example");

    expect(url.searchParams.get("url")).toBe(shareUrl);
    expect(new URL(url.searchParams.get("url") ?? "").searchParams.get("p")).toBe(
      "permission-fixture",
    );
  });

  it("creates the absolute URL copied by the Playground", () => {
    const filter: PlaygroundFilter = {
      exclude: ["fetchedAt"],
      mode: "view",
      view: "full",
    };
    const path = buildBoardRequestPath(shareUrl, filter);

    expect(buildAbsoluteApiUrl(path, "https://api.example")).toBe(`https://api.example${path}`);
  });

  it("only offers selectors accepted by the Worker", () => {
    for (const option of fieldSelectorOptions) {
      expect(() => parseFieldSelectors(option.value, "include")).not.toThrow();
      expect(() => parseFieldSelectors(option.value, "exclude")).not.toThrow();
    }
  });
});
