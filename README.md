# learnrust

A private, self-paced Rust course that goes from `fn main()` to publishing your own crate.

It has 25 lessons in six modules. Each lesson has runnable examples, at least one exercise with a hidden solution, and a short quiz. Progress is saved in your browser.

| Module | Lessons |
| --- | --- |
| Getting started | 01 Hello, Cargo · 02 Variables · 03 Data types · 04 Functions · 05 Control flow |
| Ownership | 06 Ownership · 07 Borrowing · 08 Slices and strings |
| Modelling data | 09 Structs · 10 Enums and Option · 11 Pattern matching · 12 Collections |
| Handling failure | 13 Error handling · 14 Custom error types |
| Abstraction | 15 Generics · 16 Traits · 17 Lifetimes · 18 Closures and iterators · 19 Smart pointers |
| Building a package | 20 Modules · 21 Cargo and dependencies · 22 Testing · 23 Documentation · 24 Publishing · 25 Capstone: `wordstat` |

## Using the site

Open `dist/index.html` in any browser. It is a single self-contained file, so there is no server and no install. You need an internet connection only for the web fonts and the "Run in Playground" buttons.

To keep it private, don't publish the repository with GitHub Pages. Either open the file locally, or use the private claude.ai Artifact link that goes with this repo.

## Repository layout

```text
lessons/          one Markdown file per lesson (this is the course content)
web/              the page template, styles and the in-browser app
tools/build.mjs   builds dist/ from lessons/ and web/
tools/check.mjs   compiles and runs every Rust example in the lessons
capstone/wordstat the finished crate you build in lesson 25, to compare against
dist/             the built site (committed, so it works without building)
```

## Editing lessons

Lessons are plain Markdown with a few extras. You can add your own notes to them. After editing, run:

```console
$ node tools/build.mjs     # rebuild dist/
$ node tools/check.mjs     # make sure every Rust example still compiles
```

Both need Node 18 or newer and nothing else. `check.mjs` also needs `rustc` on your `PATH`.

The extras:

- Code fences: `rust` must compile (and runs if it has `fn main`). `rust,compile_fail` must fail to compile. `rust,should_panic` must panic. `rust,ignore` is not checked. Add `file=src/lib.rs` to caption a block with a file name.
- Callouts: `:::note Title`, `:::tip`, `:::warning`, closed by `:::`.
- Exercises: `:::exercise Title`, then the task, then `:::solution`, then the solution, closed by `:::`.
- Quizzes: a ` ```quiz ` fence. `?` starts a question, `-` is a wrong option, `+` is the right one, and `=` is the explanation. Put a blank line between questions.
