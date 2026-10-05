import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "github-actions.yml": "templates/github-actions/collect.yml",
  "worker-wrangler.jsonc": "apps/scheduled-worker/wrangler.jsonc",
  "linux-config.json": "apps/self-hosted/config.example.json",
  "milanote-api.service": "templates/linux/milanote-api.service",
  "milanote-collect.service": "templates/linux/milanote-collect.service",
  "milanote-collect.timer": "templates/linux/milanote-collect.timer",
  "crontab.example": "templates/linux/crontab.example",
};
const output = resolve(root, "apps/docs/public/templates");
await mkdir(output, { recursive: true });
for (const [name, source] of Object.entries(files))
  await copyFile(resolve(root, source), resolve(output, name));
console.log(`Exported ${Object.keys(files).length} placeholder-only deployment templates`);
