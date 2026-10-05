import { timingSafeEqual, createHash } from "node:crypto";
import Fastify from "fastify";
import { createApp, type BoardLoader } from "@milanote-api/api";
import type { SnapshotStore } from "./store.ts";

export function buildServer(
  options: { store?: SnapshotStore; token?: string; loader?: BoardLoader } = {},
) {
  if (options.store && !options.token) throw new Error("快照接口需要配置 Bearer Token");
  const server = Fastify({ logger: false, bodyLimit: 32_768 });
  server.removeAllContentTypeParsers();
  server.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) =>
    done(null, body),
  );
  const api = createApp({ loader: options.loader, storage: !!options.store });
  server.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode === 413 ? 413 : 400;
    void reply
      .code(status)
      .header("Cache-Control", "no-store")
      .send({
        ok: false,
        error: {
          code: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
          message: "请求无效。",
          stage: "request",
        },
      });
  });
  if (options.store)
    server.get<{ Params: { jobId: string } }>("/api/snapshots/:jobId", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const hash = (input: string) => createHash("sha256").update(input).digest();
      if (
        !timingSafeEqual(hash(request.headers.authorization ?? ""), hash(`Bearer ${options.token}`))
      )
        return reply
          .code(401)
          .header("WWW-Authenticate", "Bearer")
          .send({ ok: false, error: { code: "UNAUTHORIZED" } });
      const snapshot = options.store!.read(request.params.jobId);
      return snapshot
        ? reply.send(snapshot)
        : reply.code(404).send({ ok: false, error: { code: "SNAPSHOT_NOT_FOUND" } });
    });
  server.all("/api/*", async (request, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const controller = new AbortController();
    request.raw.once("aborted", () => controller.abort());
    const body = Buffer.isBuffer(request.body) ? new Uint8Array(request.body) : undefined;
    const response = await api.fetch(
      new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers,
        signal: controller.signal,
        ...(request.method !== "GET" && request.method !== "HEAD" && body ? { body } : {}),
      }),
    );
    for (const [key, value] of response.headers) reply.header(key, value);
    return reply
      .code(response.status)
      .send(response.status === 204 ? undefined : await response.text());
  });
  return server;
}
