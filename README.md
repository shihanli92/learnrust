# learnrust

A private, self-paced Rust course that goes from `fn main()` to publishing your own crate.

It has 25 lessons in six modules. Each lesson has examples you can edit and run in the page, a short quiz, and exercises taken from [Rosalind](https://rosalind.info), the bioinformatics problem site, each chosen to practise that lesson's Rust. Progress is saved in your browser.

The problems are described in the course's own words with its own sample data. Each links to the original on Rosalind, where you download a real dataset and submit your answer for credit.

| Module | Lessons |
| --- | --- |
| Getting started | 01 Hello, Cargo · 02 Variables · 03 Data types · 04 Functions · 05 Control flow |
| Ownership | 06 Ownership · 07 Borrowing · 08 Slices and strings |
| Modelling data | 09 Structs · 10 Enums and Option · 11 Pattern matching · 12 Collections |
| Handling failure | 13 Error handling · 14 Custom error types |
| Abstraction | 15 Generics · 16 Traits · 17 Lifetimes · 18 Closures and iterators · 19 Smart pointers |
| Building a package | 20 Modules · 21 Cargo and dependencies · 22 Testing · 23 Documentation · 24 Publishing · 25 Capstone: `dnakit` |

## Using the site

Every Rust example is an editor. Change the code and press **Run** (or Ctrl+Enter), and the output appears under it. The code is compiled and run on the official [Rust Playground](https://play.rust-lang.org). Each exercise also has a box for your own answer. Your edits and progress are saved in your browser.

There are three ways to open the course:

- **Private hosted site (recommended):** [DEPLOY.md](DEPLOY.md) walks through putting it on Cloudflare Pages behind a login. It's free and takes about 10 minutes.
- **On your computer:** open `dist/index.html` in a browser. It's a single file, with no server and no install. Run needs an internet connection.
- **The claude.ai link:** everything works except in-page Run. That page can't contact other websites, so Run offers to open your code in the Playground instead.

## Repository layout

```text
lessons/          one Markdown file per lesson (this is the course content)
web/              the page template, styles and the in-browser app
tools/build.mjs   builds dist/ from lessons/ and web/
tools/check.mjs   compiles and runs every Rust example in the lessons
capstone/dnakit   the finished crate you build in lesson 25, to compare against
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
- Rosalind exercises: the same, but opened with `:::rosalind ID Title` (for example `:::rosalind HAMM Counting Point Mutations`). The page adds the link to the problem on Rosalind.
- Quizzes: a ` ```quiz ` fence. `?` starts a question, `-` is a wrong option, `+` is the right one, and `=` is the explanation. Put a blank line between questions.
