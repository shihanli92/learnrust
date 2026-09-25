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

Here is a small, fully documented library. Read it as an example of what good docs look like; the sections below explain each part.

```rust,file=src/lib.rs
//! Convert and parse temperatures.
//!
//! The main type is [`Celsius`]. Use [`parse`] to read a temperature
//! written like `"21.5C"` or `"70F"`.
//!
//! # Examples
//!
//! ```
//! use temperature::{parse, Celsius};
//!
//! let t = parse("212F").unwrap();
//! assert_eq!(t, Celsius(100.0));
//! ```

#![warn(missing_docs)]

use std::fmt;

/// A temperature in degrees Celsius.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Celsius(pub f64);

impl Celsius {
    /// Creates a temperature from a value in kelvin.
    ///
    /// # Panics
    ///
    /// Panics if `kelvin` is negative, because nothing is colder than
    /// absolute zero.
    ///
    /// # Examples
    ///
    /// ```
    /// use temperature::Celsius;
    ///
    /// assert_eq!(Celsius::from_kelvin(273.15), Celsius(0.0));
    /// ```
    pub fn from_kelvin(kelvin: f64) -> Celsius {
        assert!(kelvin >= 0.0, "temperature below absolute zero: {kelvin} K");
        Celsius(kelvin - 273.15)
    }

    /// Converts the temperature to degrees Fahrenheit.
    pub fn to_fahrenheit(self) -> f64 {
        self.0 * 9.0 / 5.0 + 32.0
    }
}

/// The error returned by [`parse`] when the text is not a temperature.
#[derive(Debug, Clone, PartialEq)]
pub struct ParseError {
    /// The text that could not be parsed.
    pub input: String,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "not a temperature: {:?}", self.input)
    }
}

impl std::error::Error for ParseError {}

/// Parses a temperature such as `"21.5C"` or `"70F"`.
///
/// The unit letter is required and may be lower or upper case.
///
/// # Errors
///
/// Returns a [`ParseError`] if the text does not end in `C` or `F`, or if
/// the part before it is not a number.
///
/// # Examples
///
/// ```
/// use temperature::{parse, Celsius};
///
/// assert_eq!(parse("100c"), Ok(Celsius(100.0)));
/// assert!(parse("hot").is_err());
/// ```
pub fn parse(text: &str) -> Result<Celsius, ParseError> {
    let error = || ParseError { input: text.to_string() };
    let text = text.trim();
    let (number, unit) = text.split_at(text.len().saturating_sub(1));
    let value: f64 = number.trim().parse().map_err(|_| error())?;
    match unit {
        "C" | "c" => Ok(Celsius(value)),
        "F" | "f" => Ok(Celsius((value - 32.0) * 5.0 / 9.0)),
        _ => Err(error()),
    }
}
```

## Markdown and sections

Everything in a doc comment is Markdown: `*emphasis*`, `**bold**`, inline code in backticks, lists, links and code blocks all work. Two things are special.

**Links to other items.** Write an item's name in backticks inside square brackets, like [`parse`] or [`Celsius::from_kelvin`], and rustdoc turns it into a link to that item's page. These are called *intra-doc links*, and `cargo doc` warns you if one points at something that doesn't exist.

**Conventional headings.** Rust documentation uses a few standard `#` headings so readers know where to look:

| Heading | When to include it |
| --- | --- |
| `# Examples` | Almost always. One or two short, realistic uses of the item. |
| `# Errors` | For functions returning `Result`: which errors, and when. |
| `# Panics` | For functions that can panic: under what conditions. |
| `# Safety` | For `unsafe` functions: what the caller must guarantee. You won't need this one for now. |

In a doc comment, `#` starts a heading *inside* the item's docs, not a top-level page title. That is why these are written with a single `#`.

## Doc tests

Code blocks in doc comments are Rust by default, and `cargo test` compiles and runs each one as a separate little program that uses your crate from the outside. That is why the examples above start with `use temperature::...`: they see only the public API, just like a real user.

```console
$ cargo test
...
   Doc-tests temperature

running 3 tests
test src/lib.rs - parse (line 75) ... ok
test src/lib.rs - Celsius::from_kelvin (line 33) ... ok
test src/lib.rs - (line 8) ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

all doctests ran in 0.24s; merged doctests compilation took 0.24s
```

If you later change `parse` in a way that breaks the example, the doc test fails. Documentation that is checked by the compiler is documentation you can trust.

A few extra tricks for doc tests:

- A line starting with `# ` (hash and space) is compiled but **hidden** from the rendered docs. Use it for setup that would distract the reader.
- To use `?` in an example, wrap it in a hidden `fn main() -> Result<...>`, as below.
- Add a word after the opening backticks to change how a block is treated: `no_run` compiles it without running it (for code that needs the network, say), `should_panic` is for an example that is supposed to panic, and `text` is for something that is not Rust at all.

```rust,ignore
/// Parses a temperature, returning an error for bad input.
///
/// ```
/// # use temperature::{parse, ParseError};
/// # fn main() -> Result<(), ParseError> {
/// let boiling = parse("212F")?;
/// assert_eq!(boiling.0, 100.0);
/// # Ok(())
/// # }
/// ```
pub fn example_with_question_mark() {}
```

In the rendered docs, the reader sees only the two lines in the middle.

## Generating the docs

```console
$ cargo doc --open
 Documenting temperature v0.1.0 (/home/you/temperature)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.87s
     Opening /home/you/temperature/target/doc/temperature/index.html
```

This builds HTML docs for your crate and all its dependencies and opens them in your browser. Add `--no-deps` to build only your own crate. What you see is exactly what [docs.rs](https://docs.rs) will show once you publish, so it is worth clicking through your crate as if you were a new user.

The crate-level `//!` docs become the front page. Make them answer three questions: what does this crate do, what is the main type or function, and what does a minimal example look like?

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

The finished capstone project has a complete README you can use as a template.

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

Clippy is a collection of hundreds of *lints*: checks for code that compiles but could be simpler, faster, or more idiomatic. Take this program:

```rust
fn total_length(names: &Vec<String>) -> usize {
    let mut total = 0;
    for i in 0..names.len() {
        total += names[i].len();
    }
    total
}

fn main() {
    let names = vec![String::from("Ada"), String::from("Grace")];
    if names.len() == 0 {
        println!("no names");
    }
    println!("{}", total_length(&names));
}
```

It works fine and prints `8`, but Clippy has three suggestions (output shortened):

```text
warning: writing `&Vec` instead of `&[_]` involves a new object where a slice will do
 --> src/main.rs:1:24
  |
1 | fn total_length(names: &Vec<String>) -> usize {
  |                        ^^^^^^^^^^^^ help: change this to: `&[String]`

warning: the loop variable `i` is only used to index `names`
 --> src/main.rs:3:14
  |
3 |     for i in 0..names.len() {
  |              ^^^^^^^^^^^^^^
  |
help: consider using an iterator
  |
3 -     for i in 0..names.len() {
3 +     for <item> in &names {

warning: length comparison to zero
  --> src/main.rs:11:8
   |
11 |     if names.len() == 0 {
   |        ^^^^^^^^^^^^^^^^ help: using `is_empty` is clearer and more explicit: `names.is_empty()`
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
| Crates, modules, functions, methods, variables | `snake_case` | `word_count`, `from_text` |
| Types, traits, enum variants | `UpperCamelCase` | `ParseError`, `Celsius` |
| Constants and statics | `SCREAMING_SNAKE_CASE` | `MAX_WORDS` |

Beyond casing, the Rust community has settled on a few naming patterns that users will expect:

- Constructors are associated functions called `new`, or `with_...`/`from_...` for variations: `Celsius::from_kelvin`.
- Getters don't use a `get_` prefix: `account.balance()`, not `account.get_balance()`.
- Conversions follow a cost pattern: `as_...` is free and borrows (`as_str`), `to_...` does work and returns a new value (`to_fahrenheit`, `to_string`), and `into_...` consumes `self` (`into_bytes`).
- Methods returning iterators are called `iter`, `iter_mut` and `into_iter`.
- Error types end in `Error`, and implement `Debug`, `Display` and `std::error::Error`.
- Public types should implement common traits where they make sense: `Debug` (almost always), `Clone`, `PartialEq`, `Default`.

These and many more are collected in the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/). You don't need to read all of it now, but its checklist is well worth a look before you publish.

:::exercise Document a function
Add complete documentation to this function: a summary line, a `# Panics` section, and an `# Examples` section with an example that would pass as a doc test in a crate called `mathy`.

```rust
pub fn percentage(part: u32, whole: u32) -> f64 {
    assert!(whole != 0, "whole must not be zero");
    part as f64 / whole as f64 * 100.0
}
```
:::solution
```rust
/// Returns `part` as a percentage of `whole`.
///
/// # Panics
///
/// Panics if `whole` is zero.
///
/// # Examples
///
/// ```
/// use mathy::percentage;
///
/// assert_eq!(percentage(1, 4), 25.0);
/// assert_eq!(percentage(3, 3), 100.0);
/// ```
pub fn percentage(part: u32, whole: u32) -> f64 {
    assert!(whole != 0, "whole must not be zero");
    part as f64 / whole as f64 * 100.0
}
```

You could also add a second example whose opening fence is marked `should_panic`, calling `percentage(1, 0)`, to show the panic.
:::

:::exercise Make Clippy happy
Rewrite the Clippy example program from this lesson so that `cargo clippy` reports no warnings. Keep its behaviour the same.
:::solution
```rust
fn total_length(names: &[String]) -> usize {
    names.iter().map(|name| name.len()).sum()
}

fn main() {
    let names = vec![String::from("Ada"), String::from("Grace")];
    if names.is_empty() {
        println!("no names");
    }
    println!("{}", total_length(&names));
}
```

`&names` still works as an argument: a `&Vec<String>` automatically coerces to `&[String]`.
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
