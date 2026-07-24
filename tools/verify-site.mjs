import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const outputRoot = join(process.cwd(), "apps", "playground", "dist", "client");
const requiredFiles = [
  "index.html",
  "404.html",
  join("playground", "index.html"),
  join("reference", "field-selectors.html"),
  join("reference", "http-api.html"),
];
const workerRoutes = new Set(["/api/detail", "/api/search"]);

for (const file of requiredFiles) {
  if (!existsSync(join(outputRoot, file))) {
    throw new Error(`Missing site artifact: ${file}`);
  }
}

function collectHtml(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectHtml(path);
    return extname(entry.name) === ".html" ? [path] : [];
  });
}

function assetExists(pathname) {
  const cleanPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (cleanPath === "") return existsSync(join(outputRoot, "index.html"));

  const candidates = [cleanPath, `${cleanPath}.html`, join(cleanPath, "index.html")];
  return candidates.some((candidate) => existsSync(join(outputRoot, candidate)));
}

const brokenLinks = [];
const interceptedFullPageLinks = [];
for (const htmlFile of collectHtml(outputRoot)) {
  const html = readFileSync(htmlFile, "utf8");
  const relativeHtmlFile = relative(outputRoot, htmlFile);
  const route = `/${relative(outputRoot, htmlFile).split(sep).join("/")}`.replace(
    /(?:index)?\.html$/,
    "",
  );

  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
    const href = match[1];
    if (href === undefined) continue;

    const target = new URL(href, `https://site.invalid${route || "/"}`);
    const requiresFullPageNavigation =
      (target.pathname === "/playground" &&
        relativeHtmlFile !== join("playground", "index.html")) ||
      workerRoutes.has(target.pathname);

    if (requiresFullPageNavigation && !/\btarget="_self"/.test(match[0])) {
      interceptedFullPageLinks.push(`${relativeHtmlFile} -> ${href}`);
    }
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (
      href === undefined ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("http:") ||
      href.startsWith("https:")
    ) {
      continue;
    }

    const target = new URL(href, `https://site.invalid${route || "/"}`);
    if (workerRoutes.has(target.pathname)) continue;
    if (!assetExists(target.pathname)) {
      brokenLinks.push(`${relative(outputRoot, htmlFile)} -> ${href}`);
    }
  }
}

if (brokenLinks.length > 0) {
  throw new Error(`Broken internal site links:\n${brokenLinks.join("\n")}`);
}

if (interceptedFullPageLinks.length > 0) {
  throw new Error(
    `VitePress would intercept runtime route links:\n${[...new Set(interceptedFullPageLinks)].join(
      "\n",
    )}`,
  );
}

console.log(
  `Verified ${collectHtml(outputRoot).length} HTML files, required routes, full-page runtime links, and internal links.`,
);
