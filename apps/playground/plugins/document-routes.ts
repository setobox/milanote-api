import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite-plus";

export function documentationMiddleware(base: string) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    const url = new URL(request.url ?? "/", "http://vite.local");
    if (url.pathname === base || url.pathname === `${base}index.html`) {
      response.writeHead(302, { Location: `${base}docs/`, "Cache-Control": "no-store" });
      response.end();
      return;
    }
    // Vite's publicDir serves files, but does not resolve directory indexes in dev.
    if (url.pathname === `${base}docs/` || url.pathname === `${base}docs`) {
      request.url = `${base}docs/index.html${url.search}`;
    }
    next();
  };
}

export function documentRoutes(base: string): Plugin {
  return {
    name: "documentation-routes",
    configureServer(server) {
      server.middlewares.use(documentationMiddleware(base));
    },
    configurePreviewServer(server) {
      server.middlewares.use(documentationMiddleware(base));
    },
  };
}
