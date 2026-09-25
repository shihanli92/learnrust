---
title: Documentation and Polish
module: Building a package
summary: Write doc comments with examples that double as tests, generate HTML docs, and polish your crate with rustfmt, Clippy and Rust's naming conventions.
minutes: 35
---

A crate is only as useful as its documentation. When someone finds your library on crates.io, the first thing they read is its docs page, and if they can't work out how to use it in a minute or two, they move on.

Rust makes good documentation unusually easy. Doc comments live next to the code, are written in Markdown, and turn into a searchable website with one command. Best of all, the examples in them are compiled and run as tests, so they can't quietly go stale. This lesson covers that, plus the two tools that make your code look and feel like idiomatic Rust: `rustfmt` and Clippy.

## Doc comments

Rust has two kinds of documentation comments:

| Comment | Documents | Typical place |
| --- | --- | --- |
| `///` | the item that comes *after* it | above a function, struct, enum, field, method or module |
| `//!` | the item it is *inside* | the top of `lib.rs` (the whole crate) or a module file |

Ordinary `//` comments are for people reading the source. Doc comments are for people *using* your code, and they end up in the generated docs. The first paragraph of a doc comment is the summary that appears in lists and search results, so make it one short sentence.

Here is a small, fully documented library of DNA helpers called `seqtools`, in the style of the `dnakit` crate you will build in the capstone. Read it as an example of what good docs look like; the sections below explain each part.

```rust,file=src/lib.rs
//! Small helpers for working with DNA sequences.
//!
//! Use [`reverse_complement`] to get the partner strand of a DNA sequence,
//! [`gc_content`] to measure how much of it is `G` or `C`, and [`hamming`]
//! to count the differences between two sequences.
//!
//! # Examples
//!
//! ```
//! use seqtools::{gc_content, reverse_complement};
//!
//! assert_eq!(reverse_complement("AACG"), Ok(String::from("CGTT")));
//! assert_eq!(gc_content("AACG"), 50.0);
//! ```

#![warn(missing_docs)]

use std::fmt;

/// The error returned by [`reverse_complement`] for a character that is
/// not a DNA base.
#[derive(Debug, Clone, PartialEq)]
pub struct InvalidBase {
    /// The character that was found.
    pub found: char,
    /// Where it was found, counting from 1.
    pub position: usize,
}

impl fmt::Display for InvalidBase {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let InvalidBase { found, position } = self;
        write!(f, "invalid base {found:?} at position {position}")
    }
}

impl std::error::Error for InvalidBase {}

/// Returns the reverse complement of a DNA sequence.
///
/// The two strands of a DNA molecule pair `A` with `T` and `C` with `G`,
/// and run in opposite directions. So the partner strand, read in its own
/// direction, is the sequence backwards with every base swapped for its
/// partner.
///
/// # Errors
///
/// Returns an [`InvalidBase`] error if `dna` contains anything other than
/// the uppercase letters `A`, `C`, `G` and `T`.
///
/// # Examples
///
/// ```
/// use seqtools::reverse_complement;
///
/// assert_eq!(reverse_complement("GATTACA"), Ok(String::from("TGTAATC")));
/// assert!(reverse_complement("GATXACA").is_err());
/// ```
pub fn reverse_complement(dna: &str) -> Result<String, InvalidBase> {
    let mut partner = Vec::with_capacity(dna.len());
    for (index, base) in dna.chars().enumerate() {
        let paired = match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            found => {
                return Err(InvalidBase {
                    found,
                    position: index + 1,
                });
            }
        };
        partner.push(paired);
    }
    Ok(partner.iter().rev().collect())
}

/// Returns the percentage (0 to 100) of characters in `dna` that are `G`
/// or `C`.
///
/// An empty sequence has a GC content of 0.
///
/// # Examples
///
/// ```
/// use seqtools::gc_content;
///
/// assert_eq!(gc_content("GGCA"), 75.0);
/// assert_eq!(gc_content(""), 0.0);
/// ```
pub fn gc_content(dna: &str) -> f64 {
    if dna.is_empty() {
        return 0.0;
    }
    let gc = dna.chars().filter(|&b| b == 'G' || b == 'C').count();
    gc as f64 * 100.0 / dna.chars().count() as f64
}

/// Counts the positions at which two sequences differ (their Hamming
/// distance).
///
/// # Panics
///
/// Panics if the sequences have different lengths, because the distance is
/// only defined for sequences of equal length.
///
/// # Examples
///
/// ```
/// use seqtools::hamming;
///
/// assert_eq!(hamming("GATTACA", "GACTATA"), 2);
/// ```
pub fn hamming(a: &str, b: &str) -> usize {
    assert_eq!(a.len(), b.len(), "sequences must have the same length");
    a.chars().zip(b.chars()).filter(|(x, y)| x != y).count()
}
```

## Markdown and sections

Everything in a doc comment is Markdown: `*emphasis*`, `**bold**`, inline code in backticks, lists, links and code blocks all work. Two things are special.

**Links to other items.** Write an item's name in backticks inside square brackets, like [`reverse_complement`] or [`InvalidBase`], and rustdoc turns it into a link to that item's page. These are called *intra-doc links*, and `cargo doc` warns you if one points at something that doesn't exist.

**Conventional headings.** Rust documentation uses a few standard `#` headings so readers know where to look:

| Heading | When to include it |
| --- | --- |
| `# Examples` | Almost always. One or two short, realistic uses of the item. |
| `# Errors` | For functions returning `Result`: which errors, and when. |
| `# Panics` | For functions that can panic: under what conditions. |
| `# Safety` | For `unsafe` functions: what the caller must guarantee. You won't need this one for now. |

In a doc comment, `#` starts a heading *inside* the item's docs, not a top-level page title. That is why these are written with a single `#`.

## Doc tests

Code blocks in doc comments are Rust by default, and `cargo test` compiles and runs each one as a separate little program that uses your crate from the outside. That is why the examples above start with `use seqtools::...`: they see only the public API, just like a real user.

```console
$ cargo test
...
   Doc-tests seqtools

running 4 tests
test src/lib.rs - (line 9) ... ok
test src/lib.rs - hamming (line 110) ... ok
test src/lib.rs - gc_content (line 86) ... ok
test src/lib.rs - reverse_complement (line 53) ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

all doctests ran in 0.27s; merged doctests compilation took 0.26s
```

If you later change `reverse_complement` in a way that breaks the example (say, you forget to reverse), the doc test fails. Documentation that is checked by the compiler is documentation you can trust.

A few extra tricks for doc tests:

- A line starting with `# ` (hash and space) is compiled but **hidden** from the rendered docs. Use it for setup that would distract the reader.
- To use `?` in an example, wrap it in a hidden `fn main() -> Result<...>`, as below.
- Add a word after the opening backticks to change how a block is treated: `no_run` compiles it without running it (for code that needs the network, say), `should_panic` is for an example that is supposed to panic, and `text` is for something that is not Rust at all.

```rust,ignore
/// Returns the reverse complement of a DNA sequence.
///
/// ```
/// # use seqtools::{reverse_complement, InvalidBase};
/// # fn main() -> Result<(), InvalidBase> {
/// let partner = reverse_complement("GATTACA")?;
/// assert_eq!(partner, "TGTAATC");
/// # Ok(())
/// # }
/// ```
pub fn reverse_complement(dna: &str) -> Result<String, InvalidBase> {
    // ...
}
```

In the rendered docs, the reader sees only the two lines in the middle.

## Generating the docs

```console
$ cargo doc --open
 Documenting seqtools v0.1.0 (/home/you/seqtools)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.87s
     Opening /home/you/seqtools/target/doc/seqtools/index.html
```

This builds HTML docs for your crate and all its dependencies and opens them in your browser. Add `--no-deps` to build only your own crate. What you see is exactly what [docs.rs](https://docs.rs) will show once you publish, so it is worth clicking through your crate as if you were a new user.

The crate-level `//!` docs become the front page. Make them answer three questions: what does this crate do, what are the main types or functions, and what does a minimal example look like? The `seqtools` front page above does all three in a dozen lines.

## Making sure nothing is missing

Add this line to the top of `lib.rs`, after the `//!` comments:

```rust
#![warn(missing_docs)]
```

`#![...]`, with the `!`, is an *inner attribute*: it applies to the whole crate. With it, the compiler warns about every public item that has no doc comment. Private items aren't checked, because users never see them.

## The README

Your package should also have a `README.md` in its root. It is what people see on GitHub and on your crate's crates.io page. It usually overlaps with the crate-level docs, but is aimed at someone deciding whether to use the crate:

- One or two sentences on what the crate does.
- How to add it (`cargo add your-crate`) or install it, if it is a tool.
- A short example.
- The license.

The finished capstone project, `dnakit`, has a complete README you can use as a template.

:::note Nesting code fences
In Markdown, a code block can be fenced with three *or more* backticks, and it only ends at a fence at least as long as the one that opened it. So a README that needs to show Markdown containing code blocks can use four backticks on the outside.
:::

## cargo fmt

`rustfmt` formats your code according to the official Rust style. Run it on the whole package with:

```console
$ cargo fmt
```

It rewrites your files in place: indentation, line breaks, spacing, the order of `use` lines, and so on. Almost every Rust project uses it with the default settings, which means all Rust code looks familiar, and nobody argues about brace placement in code review. Run it often; many editors can run it on every save. `cargo fmt --check` changes nothing but fails if any file isn't formatted, which is useful in automated checks.

## cargo clippy

Clippy is a collection of hundreds of *lints*: checks for code that compiles but could be simpler, faster, or more idiomatic. A *read* is a short piece of DNA as it comes out of a sequencing machine. Take this program, which adds up the lengths of some reads:

```rust
fn total_length(reads: &Vec<String>) -> usize {
    let mut total = 0;
    for i in 0..reads.len() {
        total += reads[i].len();
    }
    total
}

fn main() {
    let reads = vec![String::from("ACGT"), String::from("GGCATT")];
    if reads.len() == 0 {
        println!("no reads");
    }
    println!("{}", total_length(&reads));
}
```

It works fine and prints `10`, but Clippy has three suggestions (output shortened):

```text
warning: writing `&Vec` instead of `&[_]` involves a new object where a slice will do
 --> src/main.rs:1:24
  |
1 | fn total_length(reads: &Vec<String>) -> usize {
  |                        ^^^^^^^^^^^^ help: change this to: `&[String]`

warning: the loop variable `i` is only used to index `reads`
 --> src/main.rs:3:14
  |
3 |     for i in 0..reads.len() {
  |              ^^^^^^^^^^^^^^
  |
help: consider using an iterator
  |
3 -     for i in 0..reads.len() {
3 +     for <item> in &reads {

warning: length comparison to zero
  --> src/main.rs:11:8
   |
11 |     if reads.len() == 0 {
   |        ^^^^^^^^^^^^^^^^ help: using `is_empty` is clearer and more explicit: `reads.is_empty()`
```

Each warning also links to a page explaining *why*. For example, taking `&[String]` instead of `&Vec<String>` makes the function accept arrays and slices too, not just vectors. Clippy is one of the best ways to learn idiomatic Rust, so read its explanations rather than silencing it.

Some tips:

- `cargo clippy --fix` applies the suggestions it is sure about automatically.
- `cargo clippy -- -D warnings` turns every warning into an error. Projects use this in continuous integration so no warning is ever merged.
- If you disagree with a lint in one place, allow it there with an attribute such as `#[allow(clippy::needless_range_loop)]`, ideally with a comment saying why.

## Naming and API conventions

Consistent names make a library feel familiar before anyone has read its docs. The compiler already warns about the basic casing rules:

| Kind of item | Convention | Example |
| --- | --- | --- |
| Crates, modules, functions, methods, variables | `snake_case` | `gc_content`, `reverse_complement` |
| Types, traits, enum variants | `UpperCamelCase` | `InvalidBase`, `BaseCounts` |
| Constants and statics | `SCREAMING_SNAKE_CASE` | `STOP_CODONS` |

Beyond casing, the Rust community has settled on a few naming patterns that users will expect:

- Constructors are associated functions called `new`, or `with_...`/`from_...` for variations: `Dna::new`, `Dna::from_rna`.
- Getters don't use a `get_` prefix: `record.seq()`, not `record.get_seq()`.
- Conversions follow a cost pattern: `as_...` is free and borrows (`as_str`), `to_...` does work and returns a new value (`to_uppercase`, `to_string`), and `into_...` consumes `self` (`into_bytes`).
- Methods returning iterators are called `iter`, `iter_mut` and `into_iter`.
- Error types end in `Error`, and implement `Debug`, `Display` and `std::error::Error`.
- Public types should implement common traits where they make sense: `Debug` (almost always), `Clone`, `PartialEq`, `Default`.

These and many more are collected in the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/). You don't need to read all of it now, but its checklist is well worth a look before you publish.

:::rosalind DNA Counting DNA Nucleotides, documented
DNA is built from four kinds of *nucleotides*, named after their bases: adenine (`A`), cytosine (`C`), guanine (`G`) and thymine (`T`). Counting how often each occurs is the first thing you do with a new sequence. The dataset is one DNA string of up to 1000 bases; the answer is four numbers separated by spaces: the counts of `A`, `C`, `G` and `T`, in that order.

Write `pub fn count_bases(dna: &str) -> [usize; 4]` as if it were part of the `seqtools` library, with complete documentation: a one-line summary, a `# Panics` section (it should panic on any character that isn't one of the four bases), and an `# Examples` section with an example that would pass as a doc test. Then use it in `main` to solve the problem, reading the dataset with the file-or-sample pattern. For the sample `CATGATTACCAG` the output is:

```text
4 3 2 3
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "CATGATTACCAG\n";

/// Counts the `A`, `C`, `G` and `T` bases in a DNA sequence, in that order.
///
/// # Panics
///
/// Panics if `dna` contains any other character, including lowercase
/// letters and whitespace.
///
/// # Examples
///
/// ```
/// use seqtools::count_bases;
///
/// assert_eq!(count_bases("GATTACA"), [3, 1, 1, 2]);
/// ```
pub fn count_bases(dna: &str) -> [usize; 4] {
    let mut counts = [0; 4];
    for base in dna.chars() {
        let index = match base {
            'A' => 0,
            'C' => 1,
            'G' => 2,
            'T' => 3,
            other => panic!("not a DNA base: {other:?}"),
        };
        counts[index] += 1;
    }
    counts
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let [a, c, g, t] = count_bases(input.trim());
    println!("{a} {c} {g} {t}");
    Ok(())
}
```

```text
4 3 2 3
```

`let [a, c, g, t] = count_bases(...)` destructures the array into four variables, so the `println!` reads naturally. This file compiles as a program, so the doc test inside it isn't run here; move `count_bases` into a library's `lib.rs` and `cargo test` will run the example. You could also add a second example whose opening fence is marked `should_panic`, calling `count_bases("acgt")`, to show the panic.
:::

:::exercise Make Clippy happy
Rewrite the Clippy example program from this lesson (the one that adds up the lengths of reads) so that `cargo clippy` reports no warnings. Keep its behaviour the same.
:::solution
```rust
fn total_length(reads: &[String]) -> usize {
    reads.iter().map(|read| read.len()).sum()
}

fn main() {
    let reads = vec![String::from("ACGT"), String::from("GGCATT")];
    if reads.is_empty() {
        println!("no reads");
    }
    println!("{}", total_length(&reads));
}
```

`&reads` still works as an argument: a `&Vec<String>` automatically coerces to `&[String]`.
:::

```quiz
? Where do you put documentation for the crate as a whole?
- In a `///` comment above `fn main`.
+ In `//!` comments at the top of `src/lib.rs`.
- In `Cargo.toml` under `[docs]`.
- Only in `README.md`.
= `//!` documents the item it is inside. At the top of `lib.rs`, that is the crate itself, and it becomes the front page of the generated docs.

? What happens to a code block inside a `///` doc comment when you run `cargo test`?
- Nothing; it is only displayed.
- It is checked for formatting by `rustfmt`.
- It is run only if the block is marked `test`.
+ It is compiled and run as a doc test against your crate's public API.
= Doc tests keep examples honest: if the API changes and the example breaks, the test fails.

? Which method name follows Rust's conventions for a cheap, borrowing conversion to `&str`?
- `to_str`
- `get_str`
+ `as_str`
- `into_str`
= `as_` means a free conversion that borrows. `to_` does some work and `into_` consumes the value.

? What does `cargo clippy -- -D warnings` do?
- Deletes all warnings from your code.
+ Runs Clippy and treats every warning as an error.
- Disables all warnings.
- Documents every warning in the generated docs.
= `-D warnings` denies warnings, so the command fails if any lint fires. That is handy in automated checks.
```
