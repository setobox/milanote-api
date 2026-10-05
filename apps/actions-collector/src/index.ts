import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { parseRequestSchema } from "@milanote-api/api/contracts";
import { apiLoader, collect, secret, validateSchedule } from "@milanote-api/collector";

export async function runActions(
  env: Record<string, string | undefined>,
  outputDirectory: string,
  fetchImpl: typeof fetch = fetch,
) {
  validateSchedule(env.COLLECT_CRON ?? "*/5 * * * *", 5);
  const storage = z.enum(["true", "false"]).parse(env.STORAGE_ENABLED ?? "false") === "true";
  const request = parseRequestSchema.parse({
    url: secret(env, "BOARD_URL"),
    scope: env.BOARD_SCOPE ?? "root",
  });
  return collect({
    jobId: "default",
    request,
    load: apiLoader(secret(env, "API_BASE_URL"), env.API_TOKEN, fetchImpl),
    fetchImpl,
    ...(env.WEBHOOK_URL ? { webhook: { url: env.WEBHOOK_URL, token: env.WEBHOOK_TOKEN } } : {}),
    ...(storage
      ? {
          store: async (snapshot) => {
            await mkdir(outputDirectory, { recursive: true });
            const temporary = join(outputDirectory, `${snapshot.runId}.tmp`);
            await writeFile(temporary, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
            await rename(temporary, join(outputDirectory, "latest.json"));
          },
        }
      : {}),
  });
}
