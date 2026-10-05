import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
const root = join(process.cwd(), "apps/playground/dist");
const base = process.env.PUBLIC_BASE_PATH ?? "/";
for (const file of [
  "index.html",
  "docs/index.html",
  "404.html",
  "playground/index.html",
  "reference/http-api.html",
  "reference/field-selectors.html",
]) {
  if (!existsSync(join(root, file))) throw new Error(`Missing site artifact: ${file}`);
}
function html(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? html(join(directory, entry.name))
      : extname(entry.name) === ".html"
        ? [join(directory, entry.name)]
        : [],
  );
}
const failures = [];
const files = html(root);
const anchors = new Map(
  files.map((file) => [
    file,
    new Set([...readFileSync(file, "utf8").matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])),
  ]),
);
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const route = base + relative(root, file).split(sep).join("/");
  for (const match of source.matchAll(
    /<(a|script|link|img)\b[^>]*?(?:href|src)="([^"]+)"[^>]*>/g,
  )) {
    const [tag, kind, encoded] = match;
    const href = encoded.replaceAll("&amp;", "&");
    if (/^(?:https?:|mailto:|data:|javascript:)/.test(href)) continue;
    const target = new URL(href, `https://site.invalid${route}`);
    if (!target.pathname.startsWith(base)) {
      failures.push(`${route}: outside base ${href}`);
      continue;
    }
    const path = decodeURIComponent(target.pathname.slice(base.length)).replace(/\/$/, "");
    const resolved = ["", ".html", "/index.html"]
      .map((suffix) => join(root, path + suffix))
      .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (!resolved) {
      failures.push(`${route} -> ${href}`);
    } else if (
      target.hash &&
      anchors.has(resolved) &&
      !anchors.get(resolved).has(decodeURIComponent(target.hash.slice(1)))
    ) {
      failures.push(`${route}: missing anchor ${href}`);
    }
    if (kind === "a" && /\/playground\/?$/.test(target.pathname) && !/target="_self"/.test(tag))
      failures.push(`${route}: playground navigation must use target=_self`);
  }
}
if (failures.length) throw new Error(failures.join("\n"));
console.log(`Verified ${files.length} pages, links, anchors and assets with base ${base}`);

const redirect = readFileSync(join(root, "index.html"), "utf8");
if (!redirect.includes(`content="0;url=${base}docs/"`))
  throw new Error("Root must redirect to the documentation home using the deployment base");
