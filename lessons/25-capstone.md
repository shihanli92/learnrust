---
title: Capstone: Build wordstat
module: Building a package
summary: Put the whole course together by building, testing, documenting and packaging a real library crate with a small command-line tool.
minutes: 90
---

Time to build something real. In this project you will write `wordstat`, a library crate that computes statistics about text (line, word and character counts, the most frequent words, the average word length) plus a small command-line tool that uses it. Along the way you will use almost everything from the course: structs and enums, collections, a custom error type, closures and iterators, modules, tests, doc comments and Cargo metadata. At the end, the crate is ready to publish.

Work through the steps in order and type the code yourself rather than copying it. Run `cargo test` often. A finished reference implementation lives in the course repository in the `capstone/wordstat/` folder, and the code on this page is identical to it, so you can compare your version whenever you get stuck.

## What you will build

Given a file called `poem.txt`:

```text,file=poem.txt
Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.
Twinkle, twinkle, little star,
How I wonder what you are!
```

the finished tool prints:

```console
$ wordstat --top 3 poem.txt
lines:  6
words:  32
chars:  171
unique: 20
average word length: 4.03
most frequent:
     4  twinkle
     2  are
     2  how
```

It also reads standard input when you don't name a file, and reports problems in plain words:

```console
$ echo "The cat sat on the mat." | wordstat
lines:  1
words:  6
chars:  24
unique: 5
average word length: 2.83
most frequent:
     2  the
     1  cat
     1  mat
     1  on
     1  sat
$ wordstat missing.txt
wordstat: cannot read missing.txt: No such file or directory (os error 2)
$ wordstat --top
wordstat: --top needs a number
usage: wordstat [--top N] [FILE]
```

## Step 1: Create the package

Start with a library package. You will add the binary's `src/main.rs` to it in step 7.

```console
$ cargo new --lib wordstat
    Creating library `wordstat` package
$ cd wordstat
```

By the end of the project, the package will look like this:

```text
wordstat/
├── Cargo.toml
├── LICENSE-APACHE
├── LICENSE-MIT
├── README.md
├── src/
│   ├── lib.rs        # crate root: docs, modules, re-exports
│   ├── error.rs      # the Error type
│   ├── stats.rs      # Stats: all the counting
│   ├── config.rs     # command-line argument parsing
│   └── main.rs       # the thin command-line tool
└── tests/
    └── api.rs        # integration tests
```

This is the library-plus-binary layout from the modules lesson. All the logic lives in the library, where it is easy to test and reusable by other programs. `main.rs` only reads input, calls the library and prints.

Why is argument parsing in the library rather than in `main.rs`? Because it has rules worth testing (what if `--top` has no number?), and unit tests are easiest in a library. A crate that is mainly a library might keep it in the binary instead; for a small tool, this split keeps things simple.

## Step 2: The crate root

Replace the contents of `src/lib.rs`:

```rust,ignore,file=src/lib.rs
//! Simple statistics for plain text.
//!
//! `wordstat` counts lines, words and characters, and tells you which words
//! appear most often. It ships as a library you can call from your own code
//! and as a small command-line tool of the same name.
//!
//! # Examples
//!
//! ```
//! use wordstat::Stats;
//!
//! let stats = Stats::from_text("The cat sat on the mat.");
//! assert_eq!(stats.words, 6);
//! assert_eq!(stats.top_words(1), vec![("the", 2)]);
//! ```

#![warn(missing_docs)]

mod config;
mod error;
mod stats;

pub use config::Config;
pub use error::Error;
pub use stats::Stats;
```

The file does three jobs:

- The `//!` comment is the front page of the documentation, with an example that runs as a doc test.
- `#![warn(missing_docs)]` makes the compiler remind you about every public item you forget to document.
- The three `mod` lines declare private modules, and the `pub use` lines re-export the important types. Users write `wordstat::Stats`, not `wordstat::stats::Stats`, and you are free to reorganise the files later without breaking anyone.

The code won't compile until the three module files exist, so create them next.

## Step 3: The error type

Two things can go wrong in `wordstat`: the command-line arguments can be invalid, and a file can fail to load. Create `src/error.rs`:

```rust,ignore,file=src/error.rs
use std::fmt;
use std::io;

/// Everything that can go wrong in wordstat.
#[derive(Debug)]
pub enum Error {
    /// The command-line arguments were not valid. The message says why.
    Usage(String),
    /// A file could not be read.
    Io {
        /// The file we tried to read.
        path: String,
        /// The underlying I/O error.
        source: io::Error,
    },
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Usage(message) => {
                write!(f, "{message}\nusage: wordstat [--top N] [FILE]")
            }
            Error::Io { path, source } => write!(f, "cannot read {path}: {source}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Usage(_) => None,
            Error::Io { source, .. } => Some(source),
        }
    }
}
```

This follows the custom error lesson:

- An enum with one variant per kind of failure. `Io` keeps the file name *and* the original `io::Error`, so the message can say which file failed and why.
- `Display` writes a message meant for people. For usage errors, it adds a usage line to help the user fix their command.
- Implementing `std::error::Error` makes it a proper error type. `source` exposes the underlying I/O error for tools that print error chains.

The type is called `Error`, which is the usual name for a crate's main error type. Users see it as `wordstat::Error`, just as the standard library has `std::io::Error` and `std::fmt::Error`. Inside this file, `std::error::Error` (the trait) is always written out in full so the two don't get mixed up.

## Step 4: Counting words

Now the heart of the library. Create `src/stats.rs` with this code; the tests for it come in the next step:

```rust,ignore,file=src/stats.rs
use std::collections::HashMap;

/// Statistics about a piece of text.
///
/// Create one with [`Stats::from_text`], then read the public fields or call
/// the methods.
#[derive(Debug, Clone, PartialEq)]
pub struct Stats {
    /// Number of lines.
    pub lines: usize,
    /// Number of words (see [`Stats::from_text`] for what counts as a word).
    pub words: usize,
    /// Number of characters, counting each Unicode `char` once.
    pub chars: usize,
    counts: HashMap<String, usize>,
}

impl Stats {
    /// Computes statistics for `text`.
    ///
    /// Words are separated by whitespace. Punctuation at the start or end of a
    /// word is ignored and case does not matter, so `"The"`, `"the,"` and
    /// `"THE"` are all the word `"the"`. A token with no letters or digits in
    /// it, such as `"--"`, is not a word.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("One fish,\ntwo fish.");
    /// assert_eq!(stats.lines, 2);
    /// assert_eq!(stats.words, 4);
    /// assert_eq!(stats.chars, 19);
    /// ```
    pub fn from_text(text: &str) -> Stats {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for word in text.split_whitespace().filter_map(normalize) {
            *counts.entry(word).or_insert(0) += 1;
        }
        Stats {
            lines: text.lines().count(),
            words: counts.values().sum(),
            chars: text.chars().count(),
            counts,
        }
    }

    /// Number of different words.
    pub fn unique_words(&self) -> usize {
        self.counts.len()
    }

    /// How many times `word` appears. Case and surrounding punctuation are
    /// ignored, just like in [`Stats::from_text`].
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("Spam, spam, SPAM and eggs");
    /// assert_eq!(stats.count("spam"), 3);
    /// assert_eq!(stats.count("ham"), 0);
    /// ```
    pub fn count(&self, word: &str) -> usize {
        normalize(word)
            .and_then(|w| self.counts.get(&w).copied())
            .unwrap_or(0)
    }

    /// Returns up to `n` of the most frequent words with their counts, most
    /// frequent first. Words with the same count are sorted alphabetically,
    /// so the result is always the same for the same text.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("b a b c a b");
    /// assert_eq!(stats.top_words(2), vec![("b", 3), ("a", 2)]);
    /// ```
    pub fn top_words(&self, n: usize) -> Vec<(&str, usize)> {
        let mut pairs: Vec<(&str, usize)> = self
            .counts
            .iter()
            .map(|(word, &count)| (word.as_str(), count))
            .collect();
        pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        pairs.truncate(n);
        pairs
    }

    /// Average word length in characters, or `None` if there are no words.
    pub fn average_word_length(&self) -> Option<f64> {
        if self.words == 0 {
            return None;
        }
        let total: usize = self
            .counts
            .iter()
            .map(|(word, count)| word.chars().count() * count)
            .sum();
        Some(total as f64 / self.words as f64)
    }
}

/// Lowercases a token and strips punctuation from both ends.
/// Returns `None` if nothing is left.
fn normalize(token: &str) -> Option<String> {
    let trimmed = token.trim_matches(|c: char| !c.is_alphanumeric());
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_lowercase())
    }
}
```

Some decisions worth understanding:

- **What is a word?** `split_whitespace` splits on any whitespace. `normalize` then trims punctuation from both ends with `trim_matches` and a closure, so `"star,"` becomes `"star"`, but `"don't"` keeps its apostrophe. It also lowercases, so `"Twinkle"` and `"twinkle"` count as the same word. Tokens with nothing left, such as `"--"`, are dropped by `filter_map`, which both filters and maps in one step because `normalize` returns an `Option`.
- **Counting** uses the `HashMap` entry API from the collections lesson: `*counts.entry(word).or_insert(0) += 1` inserts a zero the first time a word is seen, then increments. The total number of words is simply the sum of all the counts.
- **Characters, not bytes.** `text.chars().count()` counts Unicode characters, so `"héllo"` has 5 characters even though it takes 6 bytes. `text.len()` would give the byte count.
- **Public fields, private map.** `lines`, `words` and `chars` are plain numbers, so making them public fields is simple and harmless. The map is private: users go through `count`, `unique_words` and `top_words`, so you could later replace the `HashMap` with something else without a breaking change. It also means nobody outside the crate can build a `Stats` with a struct literal, so the fields always agree with each other.
- **Deterministic results.** A `HashMap` iterates in an unpredictable order. `top_words` sorts by count (highest first) and then alphabetically with `then`, so the same text always gives the same answer. Without that, your tests would pass or fail at random.
- **Borrowed results.** `top_words` returns `Vec<(&str, usize)>`, borrowing the words from `self` instead of cloning each `String`. Lifetime elision ties the result to `&self` automatically.
- **Honest types.** `average_word_length` returns `Option<f64>` because an empty text has no average. Dividing by zero would give `NaN`, which is much easier to miss than a `None`.

## Step 5: Unit tests

Add a tests module to the bottom of `src/stats.rs`:

```rust,ignore,file=src/stats.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_has_no_words() {
        let stats = Stats::from_text("");
        assert_eq!(stats.lines, 0);
        assert_eq!(stats.words, 0);
        assert_eq!(stats.chars, 0);
        assert!(stats.top_words(3).is_empty());
        assert_eq!(stats.average_word_length(), None);
    }

    #[test]
    fn normalize_strips_punctuation_and_case() {
        assert_eq!(normalize("Hello,"), Some("hello".to_string()));
        assert_eq!(normalize("\"don't\""), Some("don't".to_string()));
        assert_eq!(normalize("--"), None);
    }

    #[test]
    fn counts_lines_words_and_chars() {
        let stats = Stats::from_text("héllo world\nhello -- again\n");
        assert_eq!(stats.lines, 2);
        assert_eq!(stats.words, 4);
        assert_eq!(stats.chars, 27);
        assert_eq!(stats.unique_words(), 4);
    }

    #[test]
    fn top_words_breaks_ties_alphabetically() {
        let stats = Stats::from_text("pear apple pear fig apple");
        assert_eq!(
            stats.top_words(10),
            vec![("apple", 2), ("pear", 2), ("fig", 1)]
        );
    }

    #[test]
    fn average_word_length_uses_every_occurrence() {
        let stats = Stats::from_text("a bbb bbb");
        assert_eq!(stats.average_word_length(), Some(7.0 / 3.0));
    }
}
```

Because the tests module is a child of `stats`, `use super::*;` gives it access to the private `normalize` function too. Each test checks one behaviour, and its name says which. The edge cases are the valuable ones: empty text, punctuation-only tokens, non-ASCII characters (`héllo`), and ties.

## Step 6: Parsing arguments

The tool accepts an optional `--top N` and an optional file name, in any order. Create `src/config.rs`:

```rust,ignore,file=src/config.rs
use crate::Error;

/// Options for one run of the `wordstat` command-line tool.
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// The file to read, or `None` to read standard input.
    pub path: Option<String>,
    /// How many of the most frequent words to show.
    pub top: usize,
}

impl Config {
    /// The number of top words shown when `--top` is not given.
    pub const DEFAULT_TOP: usize = 5;

    /// Builds a `Config` from command-line arguments, not including the
    /// program name.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Usage`] if an option is unknown, if `--top` is not
    /// followed by a number, or if more than one file is given.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Config;
    ///
    /// let args = ["--top", "3", "notes.txt"].map(String::from);
    /// let config = Config::from_args(args).unwrap();
    /// assert_eq!(config.top, 3);
    /// assert_eq!(config.path.as_deref(), Some("notes.txt"));
    /// ```
    pub fn from_args<I>(args: I) -> Result<Config, Error>
    where
        I: IntoIterator<Item = String>,
    {
        let mut path = None;
        let mut top = Config::DEFAULT_TOP;
        let mut args = args.into_iter();

        while let Some(arg) = args.next() {
            if arg == "--top" {
                let value = args
                    .next()
                    .ok_or_else(|| Error::Usage("--top needs a number".to_string()))?;
                top = value
                    .parse()
                    .map_err(|_| Error::Usage(format!("not a number: {value}")))?;
            } else if arg.starts_with('-') {
                return Err(Error::Usage(format!("unknown option: {arg}")));
            } else if path.is_none() {
                path = Some(arg);
            } else {
                return Err(Error::Usage("give at most one file".to_string()));
            }
        }

        Ok(Config { path, top })
    }
}
```

`from_args` accepts any `IntoIterator<Item = String>` instead of reading `std::env::args()` itself. In `main.rs` you pass the real arguments, and in tests you pass a hand-made list. That small generic makes the function easy to test.

Inside, `while let Some(arg) = args.next()` is used instead of a `for` loop because the `--top` branch needs to pull the *next* argument out of the same iterator. `ok_or_else` turns a missing value into an error, `map_err` replaces the parse error with a friendlier one, and `?` returns early in both cases.

`DEFAULT_TOP` is an associated constant, so the default lives in one place and the tests can refer to it by name.

Now its tests, at the bottom of the same file:

```rust,ignore,file=src/config.rs
#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn defaults_when_no_arguments() {
        let config = Config::from_args(args(&[])).unwrap();
        assert_eq!(config.path, None);
        assert_eq!(config.top, Config::DEFAULT_TOP);
    }

    #[test]
    fn reads_top_and_path_in_any_order() {
        let config = Config::from_args(args(&["poem.txt", "--top", "2"])).unwrap();
        assert_eq!(config.path.as_deref(), Some("poem.txt"));
        assert_eq!(config.top, 2);
    }

    #[test]
    fn rejects_bad_arguments() {
        for bad in [
            args(&["--top"]),
            args(&["--top", "many"]),
            args(&["--verbose"]),
            args(&["a.txt", "b.txt"]),
        ] {
            let result = Config::from_args(bad);
            assert!(matches!(result, Err(Error::Usage(_))), "{result:?}");
        }
    }
}
```

`rejects_bad_arguments` loops over several bad inputs and uses the `matches!` macro, which returns `true` if a value matches a pattern. The extra `"{result:?}"` argument is the custom failure message, so if the test fails you see which input got through.

Run the tests now:

```console
$ cargo test
   Compiling wordstat v0.1.0 (/home/you/wordstat)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.29s
     Running unittests src/lib.rs (target/debug/deps/wordstat-dd9273e6652ab610)

running 8 tests
test config::tests::defaults_when_no_arguments ... ok
test config::tests::reads_top_and_path_in_any_order ... ok
test config::tests::rejects_bad_arguments ... ok
test stats::tests::counts_lines_words_and_chars ... ok
test stats::tests::average_word_length_uses_every_occurrence ... ok
test stats::tests::normalize_strips_punctuation_and_case ... ok
test stats::tests::empty_text_has_no_words ... ok
test stats::tests::top_words_breaks_ties_alphabetically ... ok

test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
...
```

You'll also see the doc tests from `lib.rs`, `stats.rs` and `config.rs` run at the end.

## Step 7: The command-line tool

Create `src/main.rs`:

```rust,ignore,file=src/main.rs
use std::fs;
use std::io::{self, Read};
use std::process;

use wordstat::{Config, Error, Stats};

fn main() {
    if let Err(err) = run() {
        eprintln!("wordstat: {err}");
        process::exit(1);
    }
}

fn run() -> Result<(), Error> {
    let config = Config::from_args(std::env::args().skip(1))?;
    let text = read_input(config.path.as_deref())?;
    let stats = Stats::from_text(&text);
    print_report(&stats, config.top);
    Ok(())
}

/// Reads the whole file, or all of standard input if there is no path.
fn read_input(path: Option<&str>) -> Result<String, Error> {
    match path {
        Some(path) => fs::read_to_string(path).map_err(|source| Error::Io {
            path: path.to_string(),
            source,
        }),
        None => {
            let mut text = String::new();
            io::stdin()
                .read_to_string(&mut text)
                .map_err(|source| Error::Io {
                    path: "standard input".to_string(),
                    source,
                })?;
            Ok(text)
        }
    }
}

fn print_report(stats: &Stats, top: usize) {
    println!("lines:  {}", stats.lines);
    println!("words:  {}", stats.words);
    println!("chars:  {}", stats.chars);
    println!("unique: {}", stats.unique_words());
    if let Some(average) = stats.average_word_length() {
        println!("average word length: {average:.2}");
    }

    let top_words = stats.top_words(top);
    if !top_words.is_empty() {
        println!("most frequent:");
        for (word, count) in top_words {
            println!("{count:>6}  {word}");
        }
    }
}
```

The binary is deliberately thin:

- `main` calls `run` and handles its error in one place: print a message to standard error with `eprintln!` and exit with status 1, the conventional signal that something failed. Returning `Result` from `main` would also work, but it prints the `Debug` form of the error, which is less friendly than our `Display` message.
- `run` reads like a summary of the program: parse the arguments, read the input, compute the statistics, print them. The `?` operators need no error conversions, because every function here already returns `wordstat::Error`.
- `read_input` wraps I/O failures in `Error::Io` with `map_err`, attaching the file name. `config.path.as_deref()` turns an `&Option<String>` into an `Option<&str>`.
- `print_report` uses format specifiers: `{average:.2}` rounds to two decimal places, and `{count:>6}` right-aligns the count in six columns so the words line up.

Notice the `use wordstat::{Config, Error, Stats};` line: the binary uses the library by its crate name, exactly as any other project would.

Try it. The `--` separates Cargo's own options from the arguments for your program:

```console
$ cargo run -- --top 3 poem.txt
$ echo "The cat sat on the mat." | cargo run
```

## Step 8: An integration test

Unit tests check the pieces from the inside. Add a test that uses the library purely through its public API, as a user would. Create `tests/api.rs`:

```rust,ignore,file=tests/api.rs
use wordstat::{Config, Stats};

const POEM: &str = "\
Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.
Twinkle, twinkle, little star,
How I wonder what you are!
";

#[test]
fn stats_for_a_whole_poem() {
    let stats = Stats::from_text(POEM);
    assert_eq!(stats.lines, 6);
    assert_eq!(stats.words, 32);
    assert_eq!(stats.count("TWINKLE"), 4);
    assert_eq!(
        stats.top_words(3),
        vec![("twinkle", 4), ("are", 2), ("how", 2)]
    );
}

#[test]
fn config_controls_how_many_words_are_listed() {
    let args = ["--top", "1"].map(String::from);
    let config = Config::from_args(args).unwrap();
    let stats = Stats::from_text(POEM);
    assert_eq!(stats.top_words(config.top), vec![("twinkle", 4)]);
}
```

The `"\` at the start of `POEM` is a string continuation: a backslash at the end of a line skips the newline and any leading whitespace on the next line, so the text starts cleanly at "Twinkle".

## Step 9: Documentation and polish

You have been writing doc comments all along, so the documentation is nearly done. Build it and read it as a stranger would:

```console
$ cargo doc --open
```

Check that the front page explains the crate, that every public item has a summary, and that the intra-doc links such as [`Stats::from_text`] work. Then polish:

```console
$ cargo fmt
$ cargo clippy -- -D warnings
$ cargo test
```

All three should finish without complaints. The reference implementation passes them.

Next, write `README.md` in the package root. It is what people see on crates.io and on GitHub:

````markdown,file=README.md
# wordstat

Count lines, words and characters in text, and find the most frequent words.
`wordstat` is both a small Rust library and a command-line tool.

## Command-line tool

Install it with Cargo:

```console
$ cargo install wordstat
```

Then point it at a file, or pipe text into it:

```console
$ wordstat --top 3 notes.txt
$ cat notes.txt | wordstat
```

## Library

Add it to your project with `cargo add wordstat`, then:

```rust
use wordstat::Stats;

let stats = Stats::from_text("The cat sat on the mat.");
assert_eq!(stats.words, 6);
assert_eq!(stats.top_words(1), vec![("the", 2)]);
```

A word is a run of non-whitespace characters, compared without regard to
case and with punctuation at either end removed.

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or
[MIT license](LICENSE-MIT) at your option.
````

Finally, add the license files `LICENSE-MIT` and `LICENSE-APACHE`. Copy the standard texts, for example from the reference implementation, and put your name in the MIT copyright line.

## Step 10: Package metadata

Fill in `Cargo.toml` with everything crates.io needs:

```toml,file=Cargo.toml
[package]
name = "wordstat"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "Count lines, words and characters in text and find the most frequent words."
license = "MIT OR Apache-2.0"
repository = "https://github.com/your-name/wordstat"
readme = "README.md"
keywords = ["text", "words", "statistics", "word-count", "cli"]
categories = ["text-processing", "command-line-utilities"]

[dependencies]
```

`[dependencies]` is empty: `wordstat` uses only the standard library, which means fast builds and nothing for users to audit. Replace `your-name` in `repository` with your own GitHub account once you have pushed the code.

Check what would be uploaded:

```console
$ cargo package --list
.cargo_vcs_info.json
Cargo.lock
Cargo.toml
Cargo.toml.orig
LICENSE-APACHE
LICENSE-MIT
README.md
src/config.rs
src/error.rs
src/lib.rs
src/main.rs
src/stats.rs
tests/api.rs
```

## Step 11: Publish it, or keep it private

You now have a complete, publishable crate. You have two options.

**Publish it.** The name `wordstat` might well be taken by the time you read this, perhaps by another learner. Pick a free name, for example `wordstat-yourname`, and change `name` in `Cargo.toml`. The library's crate name changes with it, so update the `use wordstat::...` lines in `main.rs`, `tests/api.rs` and the doc comments (`wordstat-yourname` becomes `wordstat_yourname` in code). Then follow the publishing lesson:

```console
$ cargo test
$ git add . && git commit -m "Release 0.1.0"
$ cargo publish --dry-run
$ cargo publish
```

A few minutes later, your documentation appears on docs.rs, and anyone can install your tool with `cargo install wordstat-yourname`.

**Keep it private.** If you would rather not publish, add `publish = false` to `[package]` so it can't happen by accident. You can still use the library from your other projects by path or from Git:

```toml
[dependencies]
wordstat = { path = "../wordstat" }
# or, once it is on GitHub:
# wordstat = { git = "https://github.com/your-name/wordstat" }
```

and you can install the command-line tool from your own folder with `cargo install --path .`.

## Compare with the reference

The course repository contains the finished project in `capstone/wordstat/`. Its source files are identical to the code on this page, and it passes `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check` and `cargo doc`. If your version behaves differently, run both on the same input and compare, or diff the files. Small differences in wording or style are fine; the tests are the real judge.

:::exercise Find the longest word
Add a method `longest_word(&self) -> Option<&str>` to `Stats` that returns the longest word (in characters), or `None` for an empty text. If several words are equally long, return the one that comes first alphabetically, so the result is deterministic. Document it with an example, and add a unit test.
:::solution
Add this method inside `impl Stats` in `src/stats.rs`:

```rust,ignore,file=src/stats.rs
    /// Returns the longest word, or `None` if there are no words. If several
    /// words are equally long, the one that comes first alphabetically wins.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("a tiny elephant");
    /// assert_eq!(stats.longest_word(), Some("elephant"));
    /// ```
    pub fn longest_word(&self) -> Option<&str> {
        self.counts
            .keys()
            .map(|word| word.as_str())
            .max_by(|a, b| a.chars().count().cmp(&b.chars().count()).then(b.cmp(a)))
    }
```

And this test inside the `tests` module:

```rust,ignore,file=src/stats.rs
    #[test]
    fn longest_word_breaks_ties_alphabetically() {
        let stats = Stats::from_text("pear fig plum kiwi");
        assert_eq!(stats.longest_word(), Some("kiwi"));
        assert_eq!(Stats::from_text("").longest_word(), None);
    }
```

`max_by` keeps the element its comparison function calls the greatest. Comparing lengths first and then `b.cmp(a)` (reversed) makes the alphabetically *first* word win a tie in length.
:::

:::exercise Break it on purpose
Tests are only useful if they fail when the code is wrong. Make each of these changes one at a time, run `cargo test --no-fail-fast`, note which tests fail, and then undo the change. (Plain `cargo test` stops after the first group of tests with a failure; `--no-fail-fast` runs them all.)

1. In `top_words`, remove `.then(a.0.cmp(b.0))`.
2. In `normalize`, replace `trimmed.to_lowercase()` with `trimmed.to_string()`.
3. In `from_text`, count characters with `text.len()` instead of `text.chars().count()`.
:::solution
1. `top_words_breaks_ties_alphabetically` and the integration test `stats_for_a_whole_poem` fail, but not necessarily on every run. Without the tie-breaker, words with equal counts come out in the `HashMap`'s random order. (The `top_words` doc test uses counts that are all different, so it keeps passing.) A test that fails only sometimes is called *flaky*, and hunting one down is exactly the kind of bug the tie-breaker prevents.
2. `normalize_strips_punctuation_and_case` fails, and so do the doc tests on the crate root and on `count`, plus both integration tests, since `"The"` and `"the"` are now different words.
3. `counts_lines_words_and_chars` fails: `"héllo"` is 6 bytes but 5 characters, so the count comes out as 28 instead of 27. This is why the test includes a non-ASCII character.
:::

## Stretch goals

Once the reference version works, make it yours. Some ideas, roughly from easiest to hardest:

- Add a `--min-length N` option that ignores words shorter than `N` characters.
- Ignore common *stop words* such as "the", "a" and "and", with a flag to turn it on.
- Accept several files and print a report for each, followed by a total.
- Implement `Display` for `Stats` so the report format lives in the library and other programs can reuse it.
- Replace the hand-written argument parsing with the popular `clap` crate (use its `derive` feature).
- Add a `--json` flag, using `serde` and `serde_json` behind an optional `json` feature of your crate.
- Run it on a whole book from [Project Gutenberg](https://www.gutenberg.org) and compare the speed of `cargo run` and `cargo run --release`.
- Publish version `0.2.0` with your improvements, and decide whether any of your changes are breaking.

```quiz
? Why does the project have both `src/lib.rs` and `src/main.rs`?
- Cargo requires both for a package that will be published.
+ The logic lives in a reusable, testable library; the binary is a thin wrapper around it.
- `main.rs` holds the tests and `lib.rs` holds the code.
- So the crate can be compiled with two different editions.
= With a library crate, other programs can use the code and integration tests can import it. The binary just connects it to the command line.

? `Stats` has public `lines`, `words` and `chars` fields but a private `counts` field. What does the private field achieve?
- It makes `Stats` faster.
- It hides the words from `Debug` output.
+ The storage can change later without a breaking change, and outside code can't build an inconsistent `Stats`.
- It lets `Stats` be `Copy`.
= Private fields are a promise you haven't made. Users go through methods, so the internals stay yours to change.

? Why does `top_words` sort equal counts alphabetically?
+ `HashMap` iteration order is unpredictable, so without a tie-breaker results and tests would vary from run to run.
- Alphabetical order is required by crates.io.
- Sorting alphabetically is faster than sorting by count.
- `sort_by` does not compile without a second key.
= Deterministic output makes the tool predictable and the tests reliable.

? `Config::from_args` takes `I: IntoIterator<Item = String>` rather than calling `std::env::args()` itself. Why?
- `std::env::args()` can't be used in a library.
+ Tests can pass in a hand-made list of arguments, while `main` passes the real ones.
- It makes the function run in parallel.
- Generic functions don't need tests.
= Taking the input as a parameter instead of reaching for global state makes the function easy to test.
```
