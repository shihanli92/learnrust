// Builds the course website from lessons/*.md and web/*.
//
// Outputs (both fully self-contained, no build step needed to view them):
//   dist/index.html     open directly in a browser, or host anywhere (GitHub Pages etc.)
//   dist/artifact.html  the same page without the <html>/<head> wrapper, for claude.ai Artifacts

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontMatter, render } from "./markdown.mjs";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");

const files = readdirSync(join(root, "lessons")).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
const lessons = [];
const modules = [];

for (const file of files) {
  const { meta, body } = parseFrontMatter(read(join("lessons", file)));
  for (const key of ["title", "module", "summary", "minutes"]) {
    if (!meta[key]) throw new Error(`${file}: missing front matter "${key}"`);
  }
  const ctx = { file, quizCount: 0, exerciseCount: 0, toc: [] };
  const html = render(body, ctx);
  const id = file.replace(/\.md$/, "");
  lessons.push({
    id,
    n: Number(file.slice(0, 2)),
    title: meta.title,
    module: meta.module,
    summary: meta.summary,
    minutes: meta.minutes,
    toc: ctx.toc,
    html,
  });
  let mod = modules[modules.length - 1];
  if (!mod || mod.name !== meta.module) {
    if (modules.some((m) => m.name === meta.module)) throw new Error(`${file}: module "${meta.module}" is split by another module`);
    mod = { name: meta.module, lessons: [] };
    modules.push(mod);
  }
  mod.lessons.push(id);
}

// JSON inside a <script> tag: make sure nothing can close the tag early.
const data = JSON.stringify({ modules, lessons }).replace(/</g, "\\u003c");

const page = read("web/template.html")
  .replace("/*STYLE*/", () => read("web/style.css"))
  .replace("/*DATA*/", () => data)
  .replace("/*SCRIPT*/", () => read("web/app.js"));

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
</head>
<body>
${page}
</body>
</html>
`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), standalone);
writeFileSync(join(root, "dist/artifact.html"), page);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`Built ${lessons.length} lessons in ${modules.length} modules → dist/index.html (${kb(standalone)} KB)`);
