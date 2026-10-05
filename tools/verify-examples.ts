import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  parseRequestSchema,
  requestPresets,
  EXAMPLE_URL,
  openApiDocument,
  PARSE_PATH,
  successSchema,
} from "../packages/board-api/src/contracts.ts";
import { parseFieldSelectors } from "../packages/board-api/src/field-selectors.ts";

function verifyRequest(input: unknown): void {
  const request = parseRequestSchema.parse(input);
  for (const key of ["include", "exclude"] as const) {
    if (request[key]) parseFieldSelectors(request[key].join(","), key);
  }
}
function markdown(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.name.startsWith(".")
      ? []
      : entry.isDirectory()
        ? markdown(join(directory, entry.name))
        : entry.name.endsWith(".md")
          ? [join(directory, entry.name)]
          : [],
  );
}
let count = 0;
let snippets = 0;
let responses = 0;
for (const file of [...markdown("apps/docs"), "README.md", "packages/milanote-parser/README.md"]) {
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(/```json[ \t]*\r?\n([\s\S]*?)```/g)) {
    // JSON snippets must be copyable objects/values, not fragments with missing braces.
    JSON.parse(match[1] ?? "");
  }
  for (const match of body.matchAll(
    /```(?:typescript|javascript|ts|js)[ \t]*\r?\n([\s\S]*?)```/g,
  )) {
    const checked = ts.transpileModule(match[1] ?? "", {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    });
    if (
      checked.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    )
      throw new Error(`Invalid code example: ${file}`);
    snippets++;
  }
  for (const match of body.matchAll(/<!-- api-example -->\s*```json\s*([\s\S]*?)```/g)) {
    verifyRequest(JSON.parse(match[1] ?? ""));
    count++;
  }
  for (const match of body.matchAll(/<!-- api-response -->\s*```json\s*([\s\S]*?)```/g)) {
    successSchema.parse(JSON.parse(match[1] ?? ""));
    responses++;
  }
  if (/\/api\/(?:search|detail)\b/.test(body)) throw new Error(`Obsolete API reference: ${file}`);
}
for (const preset of requestPresets) verifyRequest({ ...preset.body, url: EXAMPLE_URL });
for (const example of Object.values(
  openApiDocument.paths[PARSE_PATH].post.requestBody.content["application/json"].examples,
))
  verifyRequest(example.value);
if (count < 4 || responses < 1) throw new Error("Document contract examples are missing.");
console.log(
  `Verified ${count} document requests, ${responses} responses, ${snippets} code snippets, presets, and OpenAPI examples.`,
);
