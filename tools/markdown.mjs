// A small, dependency-free Markdown renderer tailored to the lesson format.
//
// Supported syntax:
//   front matter (--- key: value ---), # headings, paragraphs, - / 1. lists,
//   | pipe | tables |, ``` fenced code ```, **bold**, *italic*, `code`, [links](url)
//   :::note / :::tip / :::warning ... :::      callouts
//   :::exercise Title ... :::solution ... :::  exercises with a hidden solution
//   ```quiz                                    multiple-choice questions (see README)

import { highlight } from "./highlight.mjs";

export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

export function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:/.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

function slugify(s) {
  return s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------- code blocks

export function parseInfo(info) {
  const [lang = "", ...flags] = info.trim().split(",").map((x) => x.trim());
  return { lang, flags };
}

function renderCode(info, code, ctx) {
  const { lang, flags } = parseInfo(info);
  if (lang === "quiz") return renderQuiz(code, ctx);

  const isRust = lang === "rust";
  const badges = [];
  if (flags.includes("compile_fail")) badges.push(`<span class="badge badge-fail">Does not compile</span>`);
  if (flags.includes("should_panic"))
    badges.push(`<span class="badge badge-panic">${/#\[test\]/.test(code) ? "Test fails on purpose" : "Panics at runtime"}</span>`);
  const fileName = flags.find((f) => f.startsWith("file="));
  const label = fileName ? fileName.slice(5) : { rust: "Rust", toml: "TOML", console: "Terminal", text: "Output" }[lang] || lang;

  // Rust blocks that stand on their own become editable and runnable in the page.
  const editable = isRust && !flags.includes("ignore");
  const kind = /#\[test\]/.test(code) ? "test" : /^\s*(pub\s+)?fn main\s*\(/m.test(code) ? "bin" : "lib";
  const actions = [`<button type="button" class="code-btn" data-copy>Copy</button>`];
  if (editable) {
    actions.push(`<a class="code-btn" data-play target="_blank" rel="noopener" href="https://play.rust-lang.org/">Playground ↗</a>`);
    actions.push(`<button type="button" class="code-btn code-run" data-run>${kind === "test" ? "Run tests" : kind === "bin" ? "Run" : "Compile"}</button>`);
  }
  ctx.blockCount = (ctx.blockCount || 0) + (editable ? 1 : 0);
  const attrs = editable ? ` data-editable data-kind="${kind}" data-block="${ctx.blockCount}"` : "";
  return `<figure class="code code-${lang || "plain"}"${attrs}>
<figcaption><span class="code-label">${escapeHtml(label)}</span>${badges.join("")}<span class="code-actions">${actions.join("")}</span></figcaption>
<pre><code>${highlight(code, lang)}</code></pre>
</figure>`;
}

// ```quiz
// ? Question text
// - wrong answer
// + right answer
// = Explanation shown after answering
// (blank line between questions)
function renderQuiz(src, ctx) {
  const blocks = src.trim().split(/\n\s*\n/);
  const out = blocks.map((block) => {
    const q = { question: "", options: [], explain: "" };
    for (const line of block.split("\n")) {
      const tag = line[0];
      const rest = line.slice(1).trim();
      if (tag === "?") q.question += (q.question ? " " : "") + rest;
      else if (tag === "+" || tag === "-") q.options.push({ text: rest, correct: tag === "+" });
      else if (tag === "=") q.explain += (q.explain ? " " : "") + rest;
      else if (line.trim()) throw new Error(`Bad quiz line in ${ctx.file}: ${line}`);
    }
    if (!q.options.some((o) => o.correct)) throw new Error(`Quiz without a correct answer in ${ctx.file}: ${q.question}`);
    const n = ++ctx.quizCount;
    const opts = q.options
      .map(
        (o, i) =>
          `<li><button type="button" class="quiz-opt" data-correct="${o.correct}"><span class="quiz-key">${"ABCDEFG"[i]}</span><span>${inline(o.text)}</span></button></li>`
      )
      .join("");
    return `<div class="quiz" data-quiz>
<p class="quiz-q"><span class="quiz-n">Q${n}</span>${inline(q.question)}</p>
<ol class="quiz-opts">${opts}</ol>
<p class="quiz-explain" hidden>${inline(q.explain)}</p>
</div>`;
  });
  return `<section class="quiz-set" aria-label="Check your understanding"><h3 class="quiz-title">Check your understanding</h3>${out.join("")}</section>`;
}

// ---------------------------------------------------------------- blocks

export function render(md, ctx = { file: "?", quizCount: 0, exerciseCount: 0, toc: [] }) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const html = [];

  const isBlockStart = (l) =>
    /^(#{1,4} |```|:::|\s*[-*] |\s*\d+\. |\|)/.test(l) || l.trim() === "";

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    // Fenced code
    // A fence of N backticks closes only at a line of at least N backticks,
    // so a ```` block can show a file that itself contains ``` fences.
    const fence = line.match(/^(`{3,})([^`]*)$/);
    if (fence) {
      const close = new RegExp(`^\`{${fence[1].length},}\\s*$`);
      const buf = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++]);
      if (i >= lines.length) throw new Error(`Unclosed code fence in ${ctx.file}`);
      i++;
      html.push(renderCode(fence[2], buf.join("\n"), ctx));
      continue;
    }

    // Containers
    const cont = line.match(/^:::(\w+)\s*(.*)$/);
    if (cont) {
      const [, kind, arg] = cont;
      // collect until matching ::: (supports one nested :::solution inside :::exercise)
      const buf = [];
      let depth = 1;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (/^:::\s*$/.test(l)) {
          depth--;
          if (depth === 0) break;
        } else if (/^:::\w+/.test(l) && kind !== "exercise") {
          depth++;
        }
        buf.push(l);
        i++;
      }
      if (i >= lines.length) throw new Error(`Unclosed ::: block in ${ctx.file}`);
      i++;
      html.push(renderContainer(kind, arg, buf.join("\n"), ctx));
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,4}) (.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      const id = slugify(h[2]);
      if (level === 2) ctx.toc.push({ id, text: h[2].replace(/`/g, "") });
      html.push(`<h${level} id="${id}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Tables
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      html.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    // Lists
    const li = line.match(/^(\s*)([-*]|\d+\.) (.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.) (.*)$/);
        if (m) { items.push(m[3]); i++; continue; }
        // continuation line (indented, non-empty)
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += " " + lines[i].trim(); i++; continue; }
        break;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }

    // Paragraph
    const buf = [line];
    i++;
    while (i < lines.length && !isBlockStart(lines[i])) buf.push(lines[i++]);
    html.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return html.join("\n");
}

function renderContainer(kind, arg, body, ctx) {
  if (kind === "exercise") {
    const [task, solution] = body.split(/^:::solution\s*$/m);
    const n = ++ctx.exerciseCount;
    const sol = solution
      ? `<details class="solution"><summary>Show a solution</summary>${render(solution, ctx)}</details>`
      : "";
    // Give every exercise somewhere to type: its own starter code if it has one, else an empty program.
    const practice = /^```rust(?!,ignore)/m.test(task)
      ? ""
      : renderCode("rust,file=Your answer", "fn main() {\n    // Write your answer here, then press Run.\n}", ctx);
    return `<section class="exercise"><p class="exercise-kicker">Exercise ${n}</p><h3>${inline(arg || "Try it yourself")}</h3>${render(task, ctx)}${practice}${sol}</section>`;
  }
  if (["note", "tip", "warning"].includes(kind)) {
    const title = arg || { note: "Note", tip: "Tip", warning: "Watch out" }[kind];
    return `<aside class="callout callout-${kind}"><p class="callout-title">${inline(title)}</p>${render(body, ctx)}</aside>`;
  }
  throw new Error(`Unknown container :::${kind} in ${ctx.file}`);
}

// Extract fenced code blocks (used by the example checker).
export function codeBlocks(md) {
  const out = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(`{3,})([^`]*)$/);
    if (!m) continue;
    const close = new RegExp(`^\`{${m[1].length},}\\s*$`);
    const start = i + 1;
    const buf = [];
    i++;
    while (i < lines.length && !close.test(lines[i])) buf.push(lines[i++]);
    out.push({ info: m[2], code: buf.join("\n"), line: start });
  }
  return out;
}
