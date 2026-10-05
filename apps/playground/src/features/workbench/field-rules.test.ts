import { describe, expect, it } from "vite-plus/test";
import { EXAMPLE_URL } from "@milanote-api/api/contracts";
import { fieldViewExclusions } from "@milanote-api/api/selectors";
import { cleanFieldRules, fieldMode, normalizeFieldRules, rulesFor } from "./field-rules.ts";

describe("workbench field rules", () => {
  it("recognizes additional JSON exclusions as custom and exposes all effective rules", () => {
    const body = { view: "standard", exclude: ["board.title"] };
    expect(fieldMode(body)).toBe("custom");
    expect(rulesFor(body, "exclude")).toEqual([...fieldViewExclusions.standard, "board.title"]);
    expect(fieldMode({ view: "standard", exclude: fieldViewExclusions.standard })).toBe("standard");
  });
  it("silently removes invalid, unknown, duplicate and wildcard-only paths", () => {
    expect(
      cleanFieldRules([
        "**",
        "*",
        "**.*",
        "board..id",
        "board.children[0].id",
        "board.nope",
        "board.id,board.title",
        "",
        42,
        " **.location ",
        "**.location",
        "board.**.title",
      ]),
    ).toEqual(["**.location", "board.**.title"]);
    expect(cleanFieldRules([`board.${"children.".repeat(21)}id`, "x".repeat(9000)])).toEqual([]);
  });
  it("normalizes field arrays and omits empty rules", () => {
    expect(
      normalizeFieldRules({ url: EXAMPLE_URL, include: ["**", "nope", "board.title"] }),
    ).toEqual({ url: EXAMPLE_URL, include: ["board.title"] });
    expect(normalizeFieldRules({ url: EXAMPLE_URL, exclude: ["**"] })).toEqual({
      url: EXAMPLE_URL,
    });
  });
  it.each(["standard", "compact"] as const)("expands %s into explicit exclusion rules", (view) => {
    expect(normalizeFieldRules({ view })).toEqual({ view, exclude: fieldViewExclusions[view] });
  });
});
