import { describe, expect, it } from "vite-plus/test";
import worker from "./index.ts";

describe("site entry", () => {
  const env = { PUBLIC_SITE_URL: "https://example.com/milanote-api/docs/" };

  it("redirects the browser entry without forwarding query data", async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await worker.fetch(
        new Request("https://api.example.com/?url=private-board", { method }),
        env,
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(env.PUBLIC_SITE_URL);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).toBe("");
    }
  });

  it("keeps unknown paths and invalid site configuration within the API", async () => {
    for (const url of [
      undefined,
      "invalid",
      "http://example.com/",
      "https://user:pass@example.com/",
      "https://example.com/?token=private",
    ]) {
      const response = await worker.fetch(new Request("https://api.example.com/"), {
        PUBLIC_SITE_URL: url,
      });
      expect(response.status).toBe(404);
      expect(response.headers.has("Location")).toBe(false);
    }
    const response = await worker.fetch(new Request("https://api.example.com/unknown"), env);
    expect(response.status).toBe(404);
  });

  it("continues handling API requests when a site destination is configured", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/api/boards/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect(response.headers.has("Location")).toBe(false);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });
});
