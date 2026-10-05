import { describe, expect, it } from "vite-plus/test";
import { EXAMPLE_URL, PARSE_PATH } from "@milanote-api/api/contracts";
import { fieldViewExclusions } from "@milanote-api/api/selectors";
import {
  apiUrl,
  HISTORY_KEY,
  loadHistory,
  loadSaved,
  requestCode,
  requestParameters,
  SAVED_KEY,
  validatedBody,
} from "./model.ts";
describe("request configuration", () => {
  it("generates all three languages with the normalized URL, POST body and token placeholder", () => {
    const url = apiUrl("https://api.test", "parse");
    expect(url).toBe(`https://api.test${PARSE_PATH}`);
    const cases = [
      {
        input: { url: EXAMPLE_URL, include: ["board.title"] },
        expected: { url: EXAMPLE_URL, scope: "root", include: ["board.title"] },
        query: "?include=board.title",
      },
      ...(["standard", "compact"] as const).map((view) => ({
        input: { url: EXAMPLE_URL, scope: "tree", view },
        expected: { url: EXAMPLE_URL, scope: "tree", view, exclude: fieldViewExclusions[view] },
        query: `?${new URLSearchParams({
          scope: "tree",
          view,
          exclude: fieldViewExclusions[view].join(","),
        })}`,
      })),
    ];
    for (const { input, expected, query } of cases) {
      const raw = JSON.stringify(input);
      const body = JSON.stringify(expected);
      expect(validatedBody(raw)).toBe(body);
      expect(requestParameters(raw)).toBe(query);
      for (const language of ["curl", "javascript", "python"] as const) {
        const code = requestCode(language, url, "parse", raw, true);
        expect(code).toContain(url + query);
        expect(code).toContain(language === "curl" ? body : JSON.stringify(body));
        expect(code).toContain("POST");
        expect(code).toContain("Content-Type");
        expect(code).toContain("application/json");
        expect(code).toContain("Bearer YOUR_API_TOKEN");
      }
    }
  });
  it("blocks malformed requests and credential-bearing API URLs", () => {
    expect(() => validatedBody("{")).toThrow();
    expect(() =>
      validatedBody(JSON.stringify({ url: EXAMPLE_URL, include: ["board"], view: "full" })),
    ).toThrow();
    expect(() =>
      validatedBody(
        JSON.stringify({ url: EXAMPLE_URL, include: ["board.title"], view: "compact" }),
      ),
    ).toThrow();
    expect(() =>
      validatedBody(JSON.stringify({ url: EXAMPLE_URL, include: "board.title" })),
    ).toThrow();
    expect(() => apiUrl("https://user:password@api.test", "parse")).toThrow();
  });
  it("uses a share-link placeholder in all code examples while rejecting empty live requests", () => {
    const raw = JSON.stringify({ url: "", scope: "root", view: "full" });
    const body = JSON.stringify({ url: EXAMPLE_URL, scope: "root", view: "full" });
    const url = "https://api.test/api/boards/parse";
    expect(() => validatedBody(raw)).toThrow();
    for (const language of ["curl", "javascript", "python"] as const) {
      const code = requestCode(language, url, "parse", raw);
      expect(code).toContain(url);
      expect(code).toContain(language === "curl" ? body : JSON.stringify(body));
      expect(() => requestCode(language, url, "parse", '{"url":"invalid"}')).toThrow();
    }
  });
  it("validates persisted configuration and strips extra response fields", () => {
    localStorage.setItem(SAVED_KEY, "not-json");
    expect(loadSaved()).toEqual([]);
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: "1",
          operation: "parse",
          status: 200,
          elapsed: 10,
          at: "2026-10-04",
          response: "private",
        },
      ]),
    );
    expect(JSON.stringify(loadHistory())).not.toContain("private");
  });
});
