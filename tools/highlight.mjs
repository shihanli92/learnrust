// Tiny syntax highlighters for Rust, TOML and terminal sessions.
// Output is HTML with <span class="tok-*"> wrappers; input is raw source text.

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const span = (cls, s) => `<span class="tok-${cls}">${esc(s)}</span>`;

const RUST_KEYWORDS = new Set(
  ("as async await break const continue crate dyn else enum extern false fn for if impl in let loop " +
    "match mod move mut pub ref return self Self static struct super trait true type unsafe use where while")
    .split(" ")
);
const RUST_PRIMS = new Set(
  "i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str".split(" ")
);

const RUST_RE = new RegExp(
  [
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.source,
    /(?<string>b?r(?<hashes>#*)"[\s\S]*?"\k<hashes>|b?"(?:\\[\s\S]|[^"\\])*")/.source,
    /(?<char>b?'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|.)|[^\\'\n])')/.source,
    /(?<lifetime>'[a-zA-Z_]\w*)/.source,
    /(?<attr>#!?\[[^\]\n]*\])/.source,
    /(?<number>\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:_?(?:[iu](?:8|16|32|64|128|size)|f32|f64))?\b|\b0x[0-9a-fA-F_]+\b|\b0b[01_]+\b)/.source,
    /(?<macro>\b[a-z_]\w*!)/.source,
    /(?<ident>\b[A-Za-z_]\w*\b)/.source,
  ].join("|"),
  "g"
);

function highlightRust(code) {
  let out = "";
  let last = 0;
  let prevIdent = "";
  for (const m of code.matchAll(RUST_RE)) {
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    const g = m.groups;
    const t = m[0];
    if (g.comment) out += span(t.startsWith("///") || t.startsWith("//!") ? "doc" : "comment", t);
    else if (g.string) out += span("string", t);
    else if (g.char) out += span("string", t);
    else if (g.lifetime) out += span("lifetime", t);
    else if (g.attr) out += span("attr", t);
    else if (g.number) out += span("number", t);
    else if (g.macro) out += span("macro", t);
    else if (g.ident) {
      if (RUST_KEYWORDS.has(t)) out += span("keyword", t);
      else if (RUST_PRIMS.has(t)) out += span("type", t);
      else if (prevIdent === "fn") out += span("fn", t);
      else if (/^[A-Z]/.test(t)) out += span(/^[A-Z0-9_]+$/.test(t) && t.length > 1 ? "const" : "type", t);
      else out += esc(t);
      prevIdent = t;
      continue;
    }
    prevIdent = "";
  }
  return out + esc(code.slice(last));
}

function highlightToml(code) {
  return code
    .split("\n")
    .map((line) => {
      if (/^\s*#/.test(line)) return span("comment", line);
      if (/^\s*\[.*\]\s*$/.test(line)) return span("keyword", line);
      const m = line.match(/^(\s*[\w.-]+)(\s*=\s*)(.*)$/);
      if (m) return span("fn", m[1]) + esc(m[2]) + highlightTomlValue(m[3]);
      return esc(line);
    })
    .join("\n");
}

function highlightTomlValue(v) {
  return v.replace(/"(?:\\.|[^"\\])*"|\b\d[\d.]*\b|\btrue\b|\bfalse\b|[^"\d]+/g, (t) => {
    if (t.startsWith('"')) return span("string", t);
    if (/^\d/.test(t)) return span("number", t);
    if (t === "true" || t === "false") return span("keyword", t);
    return esc(t);
  });
}

function highlightConsole(code) {
  return code
    .split("\n")
    .map((line) => {
      if (/^\$ /.test(line)) return span("prompt", "$ ") + span("cmd", line.slice(2));
      if (/^\s*#/.test(line)) return span("comment", line);
      if (/^error(\[E\d+\])?:/.test(line)) return span("error", line);
      if (/^warning:/.test(line)) return span("warn", line);
      const cargo = line.match(/^(\s*)(Compiling|Finished|Running|Created|Creating|Updating|Downloaded|Downloading|Packaging|Verifying|Uploading|Uploaded|Published|Documenting|Generated|Checking|Doc-tests|Adding|Locking|Waiting|Packaged|Opening|Blocking)(\b.*)$/);
      if (cargo) return esc(cargo[1]) + span("ok", cargo[2]) + esc(cargo[3]);
      if (/^\s*(-->|\||\d+ \||=)/.test(line)) return span("gutter", line);
      if (/test result: ok|\.\.\. ok$/.test(line)) return span("ok", line);
      if (/FAILED|panicked/.test(line)) return span("error", line);
      return esc(line);
    })
    .join("\n");
}

export function highlight(code, lang) {
  if (lang === "rust") return highlightRust(code);
  if (lang === "toml") return highlightToml(code);
  if (lang === "console" || lang === "sh" || lang === "text") return highlightConsole(code);
  return esc(code);
}
