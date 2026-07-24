import { describe, expect, test } from "vite-plus/test";
import { MilanoteParserError } from "../src/index.ts";
import { parseMilanoteShareUrl } from "../src/share-url.ts";

describe("parseMilanoteShareUrl", () => {
  test("extracts the first path segment and permission query", () => {
    expect(
      parseMilanoteShareUrl(
        "https://app.milanote.com/board_fictional_42/read-only?p=permission_fictional_73&view=canvas",
      ),
    ).toEqual({
      boardId: "board_fictional_42",
      permissionId: "permission_fictional_73",
    });
  });

  test.each([
    "http://app.milanote.com/board_demo/view?p=permission_demo",
    "https://milanote.com/board_demo/view?p=permission_demo",
    "https://app.milanote.com.evil.test/board_demo/view?p=permission_demo",
    "https://app.milanote.com:8443/board_demo/view?p=permission_demo",
    "https://user@app.milanote.com/board_demo/view?p=permission_demo",
    "https://app.milanote.com/view-without-permission",
    "https://app.milanote.com/board_demo/view?p=one&p=two",
    "https://app.milanote.com/board%2Fescape/view?p=permission_demo",
  ])("rejects an unsafe or ambiguous URL: %s", (input) => {
    expect(() => parseMilanoteShareUrl(input)).toThrowError(
      expect.objectContaining({
        name: "MilanoteParserError",
        code: "INVALID_SHARE_URL",
      }),
    );
  });

  test("does not include rejected input in the error", () => {
    const secret = "permission_do_not_echo";
    try {
      parseMilanoteShareUrl(`https://evil.test/board_demo?p=${secret}`);
      throw new Error("Expected parsing to fail.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MilanoteParserError);
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain("evil.test");
    }
  });
});
