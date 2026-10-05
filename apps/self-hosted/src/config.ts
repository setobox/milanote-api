import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { jobIdSchema, secret, validateSchedule } from "@milanote-api/collector";
import { parseRequestSchema } from "@milanote-api/api/contracts";

const envName = z.string().regex(/^[A-Z_][A-Z0-9_]*$/);
const jobSchema = z.strictObject({
  id: jobIdSchema,
  urlEnv: envName,
  scope: z.enum(["root", "tree"]).default("root"),
  view: z.enum(["full", "standard", "compact"]).optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  cron: z.string().default("* * * * *"),
  webhookUrlEnv: envName.optional(),
  webhookTokenEnv: envName.optional(),
});
export const configSchema = z
  .strictObject({
    host: z.string().min(1).default("127.0.0.1"),
    port: z.number().int().min(1).max(65535).default(8787),
    lockDirectory: z.string().min(1).default("./data/locks"),
    storage: z
      .strictObject({
        enabled: z.boolean().default(false),
        path: z.string().min(1).default("./data/snapshots.sqlite"),
        tokenEnv: envName.default("SNAPSHOT_TOKEN"),
      })
      .default({ enabled: false, path: "./data/snapshots.sqlite", tokenEnv: "SNAPSHOT_TOKEN" }),
    jobs: z.array(jobSchema).default([]),
  })
  .superRefine((config, ctx) => {
    if (new Set(config.jobs.map((job) => job.id)).size !== config.jobs.length)
      ctx.addIssue({ code: "custom", message: "任务 ID 不可重复" });
  });
export type Config = z.infer<typeof configSchema>;
export type Job = Config["jobs"][number];
export async function readConfig(path: string): Promise<Config> {
  const config = configSchema.parse(JSON.parse(await readFile(path, "utf8")));
  config.storage.path = resolve(dirname(path), config.storage.path);
  config.lockDirectory = resolve(dirname(path), config.lockDirectory);
  for (const job of config.jobs) validateSchedule(job.cron);
  return config;
}
export function jobRequest(job: Job, env: Record<string, string | undefined>) {
  return parseRequestSchema.parse({
    url: secret(env, job.urlEnv),
    scope: job.scope,
    ...(job.view ? { view: job.view } : {}),
    ...(job.include ? { include: job.include } : {}),
    ...(job.exclude ? { exclude: job.exclude } : {}),
  });
}
