import { createApp } from "@milanote-api/api";

const api = createApp();

export default {
  async fetch(request: Request, env: { PUBLIC_SITE_URL?: string } = {}): Promise<Response> {
    const path = new URL(request.url).pathname;
    if ((request.method === "GET" || request.method === "HEAD") && path === "/") {
      try {
        const destination = new URL(env.PUBLIC_SITE_URL ?? "");
        if (
          destination.protocol === "https:" &&
          !destination.username &&
          !destination.password &&
          !destination.search &&
          !destination.hash
        ) {
          return new Response(null, {
            status: 302,
            headers: { Location: destination.href, "Cache-Control": "no-store" },
          });
        }
      } catch {
        // An unconfigured or invalid site URL leaves the API-only deployment unchanged.
      }
    }
    return api.fetch(request);
  },
};
