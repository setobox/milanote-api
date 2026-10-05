import { createServer } from "node:http";
import { describe, expect, it } from "vite-plus/test";
import { documentationMiddleware } from "./document-routes.ts";

describe("documentation routes", () => {
  it.each(["/", "/milanote-api/"])(
    "redirects the root and serves the documentation directory at %s",
    async (base) => {
      const middleware = documentationMiddleware(base);
      const server = createServer((request, response) =>
        middleware(request, response, () => response.end(request.url)),
      );
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address");
      const origin = `http://127.0.0.1:${address.port}`;
      try {
        for (const path of [base, `${base}index.html`]) {
          const root = await fetch(origin + path, { redirect: "manual" });
          expect(root.status).toBe(302);
          expect(root.headers.get("location")).toBe(`${base}docs/`);
        }
        const followed = await fetch(origin + base);
        expect(await followed.text()).toBe(`${base}docs/index.html`);
        const docs = await fetch(`${origin}${base}docs/?q=test`);
        expect(await docs.text()).toBe(`${base}docs/index.html?q=test`);
        const app = await fetch(`${origin}${base}playground/`);
        expect(await app.text()).toBe(`${base}playground/`);
        const api = await fetch(`${origin}/api/boards/parse`, { method: "POST" });
        expect(await api.text()).toBe("/api/boards/parse");
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
