// Compiles (and where sensible, runs) every Rust example in lessons/*.md.
//
//   ```rust                 must compile; runs if it has `fn main`, tests run if it has #[test]
//   ```rust,compile_fail    must NOT compile
//   ```rust,should_panic    must compile and exit with a panic
//   ```rust,ignore          skipped (fragments, or code that needs external crates)
//   ```rust,norun           must compile, is not run (e.g. waits for input)
//
// Usage: node tools/check.mjs [lesson-file-substring ...]

import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { codeBlocks, parseInfo } from "./markdown.mjs";

const root = new URL("..", import.meta.url).pathname;
const lessonsDir = join(root, "lessons");
const work = join(root, ".check");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const filters = process.argv.slice(2);
const files = readdirSync(lessonsDir)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

let passed = 0;
const failures = [];

function rustc(args) {
  return spawnSync("rustc", ["--edition", "2024", "-A", "warnings", ...args], { encoding: "utf8" });
}

for (const file of files) {
  const md = readFileSync(join(lessonsDir, file), "utf8");
  for (const [n, block] of codeBlocks(md).entries()) {
    const { lang, flags } = parseInfo(block.info);
    if (lang !== "rust" || flags.includes("ignore")) continue;
    const where = `${file}:${block.line}`;
    const base = join(work, `${file.replace(/\.md$/, "")}_${n}`);
    const src = base + ".rs";
    writeFileSync(src, block.code + "\n");

    const hasMain = /fn main\s*\(/.test(block.code);
    const hasTests = /#\[test\]/.test(block.code);
    const args = [src, "-o", base];
    if (hasTests) args.unshift("--test");
    else if (!hasMain) args.unshift("--crate-type", "lib");

    const c = rustc(args);
    if (flags.includes("compile_fail")) {
      if (c.status === 0) failures.push(`${where}: expected a compile error, but it compiled`);
      else passed++;
      continue;
    }
    if (c.status !== 0) {
      failures.push(`${where}: failed to compile\n${c.stderr.split("\n").slice(0, 25).join("\n")}`);
      continue;
    }
    if ((!hasMain && !hasTests) || flags.includes("norun")) { passed++; continue; }

    const r = spawnSync(base, [], { encoding: "utf8", input: "", timeout: 10_000 });
    const panicked = r.status !== 0;
    if (flags.includes("should_panic") && !panicked) failures.push(`${where}: expected a panic, but it exited cleanly`);
    else if (!flags.includes("should_panic") && panicked)
      failures.push(`${where}: exited with status ${r.status}\n${(r.stderr || "").slice(0, 1500)}`);
    else passed++;
  }
}

rmSync(work, { recursive: true, force: true });
console.log(`${passed} examples OK across ${files.length} lesson file(s).`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error("✗ " + f + "\n");
  process.exit(1);
}
