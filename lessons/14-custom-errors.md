---
title: Custom Error Types
module: Handling failure
summary: Design your own error enums, implement Display and Error for them, and let ? convert between error types automatically.
minutes: 40
---

In the last lesson your fallible functions returned `Result<T, String>` or borrowed an error type from the standard library, such as `ParseIntError`. Strings are fine for quick programs, but they have a weakness: the caller can only *read* them. If the caller wants to react differently to "file not found" and "number out of range", it has to compare message text, which breaks the moment someone rewords a message.

A better approach is an **error enum**: one variant per way your code can fail, carrying whatever details are useful. Callers can `match` on it, and it can still print a friendly message. This lesson builds one step by step.

You'll see the word **trait** a few times. A trait is a named set of methods that a type can implement, such as "can be displayed" or "is an error". Traits get a full lesson later; here you only need to know how to fill in two standard ones.

## An error enum

Imagine a function that reads a setting like `"retries=3"` and checks that the number is in range. It can fail in three ways:

```rust
#[derive(Debug)]
enum ConfigError {
    MissingEquals,
    BadNumber(std::num::ParseIntError),
    OutOfRange { value: i64, max: i64 },
}

fn parse_retries(line: &str) -> Result<i64, ConfigError> {
    let Some((_, value)) = line.split_once('=') else {
        return Err(ConfigError::MissingEquals);
    };
    let n: i64 = match value.trim().parse() {
        Ok(n) => n,
        Err(e) => return Err(ConfigError::BadNumber(e)),
    };
    if n > 10 {
        return Err(ConfigError::OutOfRange { value: n, max: 10 });
    }
    Ok(n)
}

fn main() {
    for line in ["retries=3", "retries", "retries=many", "retries=50"] {
        match parse_retries(line) {
            Ok(n) => println!("ok: {n}"),
            Err(ConfigError::OutOfRange { max, .. }) => println!("too high, using {max}"),
            Err(other) => println!("error: {other:?}"),
        }
    }
}
```

```text
ok: 3
error: MissingEquals
error: BadNumber(ParseIntError { kind: InvalidDigit })
too high, using 10
```

Notice what the caller in `main` can do: it treats "out of range" specially by falling back to the maximum, and reports everything else. That decision is based on the *type* of the error, not its wording. The `BadNumber` variant also keeps the original `ParseIntError`, so no information is lost.

The output is not very friendly yet, though. `{:?}` is for programmers. Users should see a sentence.

## Implementing `Display`

`{}` formatting uses a trait called `std::fmt::Display`. Types don't get it automatically (Rust can't guess what a user-facing message should say), so you implement it yourself:

```rust
use std::fmt;

#[derive(Debug)]
enum ConfigError {
    MissingEquals,
    BadNumber(std::num::ParseIntError),
    OutOfRange { value: i64, max: i64 },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::MissingEquals => write!(f, "expected a line like key=value"),
            ConfigError::BadNumber(e) => write!(f, "the value is not a number: {e}"),
            ConfigError::OutOfRange { value, max } => {
                write!(f, "{value} is too large (the maximum is {max})")
            }
        }
    }
}

fn main() {
    let errors = [
        ConfigError::MissingEquals,
        ConfigError::OutOfRange { value: 50, max: 10 },
    ];
    for e in &errors {
        println!("error: {e}");
    }
}
```

```text
error: expected a line like key=value
error: 50 is too large (the maximum is 10)
```

The shape is always the same, so it is worth learning as a recipe:

- `impl fmt::Display for YourType` says "here is how `YourType` implements `Display`".
- The one required method is `fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result`.
- Inside, `write!(f, ...)` works like `format!`, but writes into the formatter. It returns a `fmt::Result`, which is exactly what `fmt` must return, so it can be the last expression of each arm.

:::tip Message style
The convention for error messages in Rust is lowercase, with no trailing full stop, as in `"the value is not a number"`. That way they read well when embedded in a longer message such as `"error: the value is not a number"`.
:::

## Implementing `std::error::Error`

The standard library has a trait, `std::error::Error`, that marks a type as "an error". Implementing it lets your type work with generic error-handling code, including `Box<dyn Error>` further down. It requires `Debug` and `Display`, which you already have, and all of its methods have default implementations, so often the `impl` block is empty:

```rust,ignore
impl std::error::Error for ConfigError {}
```

There is one method worth overriding. `source()` returns the lower-level error that caused this one, if any. For `BadNumber`, that is the `ParseIntError` it wraps. Error-reporting tools follow this chain to print "caused by..." lines. You'll see it in the full example below.

:::note Coming from Python
`Display` and `Debug` play the roles of `__str__` and `__repr__`: `{}` gives the message for users, `{:?}` the one for programmers. `source()` is Rust's version of `raise ConfigError(...) from e`: it exposes the lower-level error that caused this one, like Python's `__cause__`.
:::

## `From`: letting `?` convert errors

Look again at `parse_retries`. The `match` around `parse()` exists only to wrap a `ParseIntError` in `ConfigError::BadNumber`. You'd like to write `value.trim().parse()?` instead, but `?` would try to return a `ParseIntError` from a function that returns `ConfigError`.

Here is the part of `?` the previous lesson left out. When `?` meets an `Err(e)`, it actually returns `Err(From::from(e))`. `From` is a standard trait for converting one type into another. So if you tell Rust how to turn a `ParseIntError` into a `ConfigError`, `?` does the conversion for you:

```rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    MissingEquals,
    BadNumber(ParseIntError),
    OutOfRange { value: i64, max: i64 },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::MissingEquals => write!(f, "expected a line like key=value"),
            ConfigError::BadNumber(_) => write!(f, "the value is not a number"),
            ConfigError::OutOfRange { value, max } => {
                write!(f, "{value} is too large (the maximum is {max})")
            }
        }
    }
}

impl Error for ConfigError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            ConfigError::BadNumber(e) => Some(e),
            _ => None,
        }
    }
}

impl From<ParseIntError> for ConfigError {
    fn from(e: ParseIntError) -> Self {
        ConfigError::BadNumber(e)
    }
}

fn parse_retries(line: &str) -> Result<i64, ConfigError> {
    let (_, value) = line.split_once('=').ok_or(ConfigError::MissingEquals)?;
    let n: i64 = value.trim().parse()?; // ParseIntError -> ConfigError via From
    if n > 10 {
        return Err(ConfigError::OutOfRange { value: n, max: 10 });
    }
    Ok(n)
}

fn main() {
    for line in ["retries=3", "retries", "retries=many", "retries=50"] {
        match parse_retries(line) {
            Ok(n) => println!("{line}: ok, {n}"),
            Err(e) => {
                println!("{line}: {e}");
                if let Some(cause) = e.source() {
                    println!("  caused by: {cause}");
                }
            }
        }
    }
}
```

```text
retries=3: ok, 3
retries: expected a line like key=value
retries=many: the value is not a number
  caused by: invalid digit found in string
retries=50: 50 is too large (the maximum is 10)
```

`parse_retries` is now as short as the `String` version, and its errors are structured. The `source` signature looks intimidating; you can copy it as written. `dyn Error` means "some type that implements `Error`", explained in the Traits lesson, and `'static` is covered in the Lifetimes lesson.

:::note Display or source, not both
Notice that `BadNumber`'s message no longer includes the inner error, because `source()` exposes it instead. If you do both, reports that walk the chain print the same text twice. Pick one; exposing it via `source()` is the more flexible choice.
:::

## `Box<dyn Error>` for applications

Defining an enum pays off in code that others call. In an application's `main`, you often just want to stop and report *any* error, whatever its type. For that, the standard library lets you return `Box<dyn Error>`, which can hold any error type:

```rust
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let width: u32 = "12".parse()?; // ParseIntError
    let ratio: f64 = "1.5".parse()?; // ParseFloatError, a different type
    if width == 0 {
        return Err("width must not be zero".into()); // a plain message
    }
    println!("scaled width = {}", width as f64 * ratio);
    Ok(())
}
```

```text
scaled width = 18
```

This works because the standard library provides a `From` conversion from *every* error type into `Box<dyn Error>`, so `?` accepts them all. A `&str` or `String` converts too, via `.into()`, which is handy for one-off messages. `Box` puts the value on the heap; the Smart Pointers lesson explains it.

The trade-off: once an error is in a `Box<dyn Error>`, the caller can print it but can no longer easily `match` on which kind of error it was. That's usually fine at the top of a program, and not fine in a library.

## Friendly messages from main

There is one catch with returning `Result` from `main`. As the last lesson showed, Rust prints the returned error with **Debug** formatting. For the FASTA parser you'll write below, a user would see `Error: MissingHeader { line: 1 }` or `Error: Io(Os { code: 2, kind: NotFound, message: "No such file or directory" })`, not the `Display` message you wrote so carefully.

The usual fix is to move the program's work into a function, conventionally called `run`, and let `main` do nothing but report:

```rust
use std::error::Error;

const SAMPLE: &str = "GATTACA\n";

fn run() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let dna = input.trim();
    if dna.is_empty() {
        return Err("the dataset is empty".into());
    }
    println!("{} bases", dna.len());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
```

```text
7 bases
```

```console
$ cargo run -- no_such_file.txt
error: No such file or directory (os error 2)
$ echo $?
1
```

`eprintln!` works like `println!` but writes to **standard error**, the stream meant for error messages, so they don't end up mixed into output you redirect to a file. `std::process::exit(1)` ends the program immediately with status code 1. Any non-zero status tells the shell that something failed, just as returning `Err` from `main` did (`echo $?` shows the last status). By the time `main` calls it, `run` has returned and all its values have been cleaned up.

`run` can just as well return your own error type, such as `Result<(), FastaError>`; either way `{e}` uses `Display`. The SPLC solution at the end of this lesson uses this pattern.

## Crates that remove the boilerplate

Writing `Display`, `Error` and `From` impls by hand is good for understanding, but real projects usually let a crate generate them. Two are extremely popular.

**thiserror** is for libraries. You write the enum and put the messages in attributes; it generates `Display`, `Error`, `source` and `From` for you:

```rust,ignore
use thiserror::Error;

#[derive(Debug, Error)]
enum ConfigError {
    #[error("expected a line like key=value")]
    MissingEquals,
    #[error("the value is not a number")]
    BadNumber(#[from] std::num::ParseIntError),
    #[error("{value} is too large (the maximum is {max})")]
    OutOfRange { value: i64, max: i64 },
}
```

**anyhow** is for applications. Its `anyhow::Result<T>` is like `Result<T, Box<dyn Error>>` with extras, most usefully `.context(...)` to add a human explanation as an error travels up:

```rust,ignore
use anyhow::{Context, Result};

fn load_config(path: &str) -> Result<String> {
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("could not read config file {path}"))?;
    Ok(text)
}
```

You'll learn to add dependencies like these in the Cargo lesson.

## Library or application?

| You are writing... | Recommended error type | Why |
| --- | --- | --- |
| A library (a crate others depend on) | Your own error enum, implementing `Display` and `Error` (hand-written or with `thiserror`) | Callers can match on variants and decide what to do. |
| An application (a program you run) | `Box<dyn Error>` or `anyhow::Error` | You mostly report errors, so convenience wins. |
| A quick script or example | `Box<dyn Error>`, or `unwrap` and `expect` | Keep it short. |

Since your goal is to publish a crate, the error-enum approach is the one to master. It becomes part of your crate's public API, so choose variant names that will make sense to users.

:::exercise A FASTA parser with real errors
Your FASTA parser from the Structs lesson quietly assumed the input was perfect. A library parser should instead say exactly what is wrong and where. Write one that reports problems through an error enum:

```rust,ignore
#[derive(Debug)]
enum FastaError {
    Io(std::io::Error),
    MissingHeader { line: usize },
    InvalidBase { id: String, position: usize, found: char },
}
```

1. Implement `Display` with a message for each variant (`line` is 1-based; `position` is the 1-based position in that record's sequence). Implement `Error`, with `source()` returning the inner `io::Error` for `Io`.
2. Implement `From<std::io::Error> for FastaError`.
3. Write `fn parse_fasta(text: &str) -> Result<Vec<Record>, FastaError>`. Return `MissingHeader` for a sequence line that comes before any `>` line, and `InvalidBase` for any character other than `A`, `C`, `G` or `T`.
4. Write `fn read_fasta(path: &str) -> Result<Vec<Record>, FastaError>` that reads the file with `std::fs::read_to_string(path)?` and parses it. Thanks to your `From` impl, the `?` converts the I/O error for you.

Test it on a valid input, one that starts with a sequence line, one with an `X` in a sequence, and a file that doesn't exist. Two helpers make the parser tidy: `line.strip_prefix('>')` returns `Some(rest)` if the line starts with `>` and `None` otherwise, and `let ... else` on `records.last_mut()` handles the "no header yet" case.
:::solution
```rust
use std::error::Error;
use std::fmt;

#[derive(Debug)]
struct Record {
    id: String,
    seq: String,
}

#[derive(Debug)]
enum FastaError {
    Io(std::io::Error),
    MissingHeader { line: usize },
    InvalidBase { id: String, position: usize, found: char },
}

impl fmt::Display for FastaError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            FastaError::Io(_) => write!(f, "could not read the FASTA file"),
            FastaError::MissingHeader { line } => {
                write!(f, "line {line}: sequence data before the first '>' header")
            }
            FastaError::InvalidBase { id, position, found } => {
                write!(f, "record {id}: invalid base {found:?} at position {position}")
            }
        }
    }
}

impl Error for FastaError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            FastaError::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for FastaError {
    fn from(e: std::io::Error) -> Self {
        FastaError::Io(e)
    }
}

fn parse_fasta(text: &str) -> Result<Vec<Record>, FastaError> {
    let mut records: Vec<Record> = Vec::new();
    for (i, line) in text.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(id) = line.strip_prefix('>') {
            records.push(Record { id: id.to_string(), seq: String::new() });
            continue;
        }
        let Some(record) = records.last_mut() else {
            return Err(FastaError::MissingHeader { line: i + 1 });
        };
        for c in line.chars() {
            if !matches!(c, 'A' | 'C' | 'G' | 'T') {
                return Err(FastaError::InvalidBase {
                    id: record.id.clone(),
                    position: record.seq.len() + 1,
                    found: c,
                });
            }
            record.seq.push(c);
        }
    }
    Ok(records)
}

fn read_fasta(path: &str) -> Result<Vec<Record>, FastaError> {
    let text = std::fs::read_to_string(path)?; // io::Error -> FastaError via From
    parse_fasta(&text)
}

fn main() {
    let inputs = [
        ">seq1\nGATT\nACA\n>seq2\nCCGG\n",
        "GATTACA\n>seq1\nCCGG\n",
        ">seq1\nGATT\nACXA\n",
    ];
    for text in inputs {
        match parse_fasta(text) {
            Ok(records) => println!("ok: {records:?}"),
            Err(e) => println!("error: {e}"),
        }
    }

    match read_fasta("no_such_file.fasta") {
        Ok(_) => println!("unexpected success"),
        Err(e) => {
            println!("error: {e}");
            if let Some(cause) = e.source() {
                println!("  caused by: {cause}");
            }
        }
    }
}
```

```text
ok: [Record { id: "seq1", seq: "GATTACA" }, Record { id: "seq2", seq: "CCGG" }]
error: line 1: sequence data before the first '>' header
error: record seq1: invalid base 'X' at position 7
error: could not read the FASTA file
  caused by: No such file or directory (os error 2)
```

Each variant carries exactly the details needed to find the problem in a thousand-line file, and a caller could `match` on `InvalidBase` to, say, skip bad records instead of giving up. `enumerate()` numbers the lines from 0, hence `i + 1`. `record.id.clone()` is needed because the error must own its data: it may outlive `records`, which is dropped when the function returns. This parser, error type and all, is very close to the `fasta` module of `dnakit`, the crate you'll build in lesson 25.

Rosalind's files are tidy; FASTA from other sources is not, and this parser would trip over three common things. A file saved by some Windows editors starts with an invisible byte order mark (the character `'\u{feff}'`), so the first line doesn't start with `>` and you get `MissingHeader { line: 1 }`: strip it first with `text.strip_prefix('\u{feff}').unwrap_or(text)`. Headers from databases such as NCBI carry a description after the ID, as in `>NM_000546.6 Homo sapiens tumor protein p53 (TP53), mRNA`; usually you want only the first word as the ID, which `id.split_whitespace().next()` gives you, perhaps keeping the rest in a `description` field. And real sequences often contain lowercase letters (which some tools use to mark repetitive regions) and `N` for an unknown base, both rejected here as `InvalidBase`; accept them by uppercasing each character with `c.to_ascii_uppercase()` and allowing `N`, as long as the code that uses the sequences can handle an `N`.
:::

:::rosalind SPLC RNA Splicing
In plants and animals, genes are interrupted by stretches of DNA that don't code for anything, called **introns**. The coding pieces between them are **exons**. Before a protein is made, the cell cuts the introns out of the RNA copy and glues the exons together, a step called **splicing**. Only then is the RNA translated into protein.

The dataset is a FASTA file. The first record is the gene; every record after it is an intron (each occurs in the gene exactly once). Remove the introns from the gene, transcribe the result to RNA (T becomes U), translate it with the codon table, and print the protein on one line. Stop at the stop codon, as in PROT.

Use your parser from the previous exercise, and read the dataset with `read_fasta` when a file name is given, falling back to `parse_fasta(SAMPLE)` otherwise. Both return a `FastaError`, which `?` turns into a `Box<dyn Error>`. Put the work in a `run` function and print errors from `main` with `Display`, as shown earlier in this lesson, so a bad dataset gives a readable message.

Two useful methods: `records.split_first()` returns `Some((first, rest))` for a non-empty slice, and `text.replace(pattern, "")` deletes every occurrence of `pattern`. For the translation, reuse `amino_acid` from the Pattern Matching lesson, or try the compact version in the solution.

For this sample:

```text
>Rosalind_4021
ATGTACGGTCATTCAGAGCACTGACCTTGG
AAACGTTATTAA
>Rosalind_1180
GGTCATTCAG
>Rosalind_7732
CCTTGGAA
```

the output is:

```text
MYSTERY
```
:::solution
```rust
use std::error::Error;
use std::fmt;

#[derive(Debug)]
struct Record {
    id: String,
    seq: String,
}

#[derive(Debug)]
enum FastaError {
    Io(std::io::Error),
    MissingHeader { line: usize },
    InvalidBase { id: String, position: usize, found: char },
}

impl fmt::Display for FastaError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            FastaError::Io(_) => write!(f, "could not read the FASTA file"),
            FastaError::MissingHeader { line } => {
                write!(f, "line {line}: sequence data before the first '>' header")
            }
            FastaError::InvalidBase { id, position, found } => {
                write!(f, "record {id}: invalid base {found:?} at position {position}")
            }
        }
    }
}

impl Error for FastaError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            FastaError::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for FastaError {
    fn from(e: std::io::Error) -> Self {
        FastaError::Io(e)
    }
}

fn parse_fasta(text: &str) -> Result<Vec<Record>, FastaError> {
    let mut records: Vec<Record> = Vec::new();
    for (i, line) in text.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(id) = line.strip_prefix('>') {
            records.push(Record { id: id.to_string(), seq: String::new() });
            continue;
        }
        let Some(record) = records.last_mut() else {
            return Err(FastaError::MissingHeader { line: i + 1 });
        };
        for c in line.chars() {
            if !matches!(c, 'A' | 'C' | 'G' | 'T') {
                return Err(FastaError::InvalidBase {
                    id: record.id.clone(),
                    position: record.seq.len() + 1,
                    found: c,
                });
            }
            record.seq.push(c);
        }
    }
    Ok(records)
}

fn read_fasta(path: &str) -> Result<Vec<Record>, FastaError> {
    let text = std::fs::read_to_string(path)?; // io::Error -> FastaError via From
    parse_fasta(&text)
}

/// The codon table from the Pattern Matching lesson, squeezed into one string.
/// Codons are numbered in the base order U, C, A, G: UUU is 0, UUC is 1, ... GGG is 63.
const AMINO_ACIDS: &[u8; 64] =
    b"FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

fn translate(rna: &str) -> String {
    let mut protein = String::new();
    for codon in rna.as_bytes().chunks_exact(3) {
        let mut index = 0;
        for &base in codon {
            let digit = match base {
                b'U' => 0,
                b'C' => 1,
                b'A' => 2,
                _ => 3, // b'G'; the parser already rejected anything else
            };
            index = index * 4 + digit;
        }
        let amino = AMINO_ACIDS[index] as char;
        if amino == '*' {
            break; // stop codon
        }
        protein.push(amino);
    }
    protein
}

const SAMPLE: &str = "
>Rosalind_4021
ATGTACGGTCATTCAGAGCACTGACCTTGG
AAACGTTATTAA
>Rosalind_1180
GGTCATTCAG
>Rosalind_7732
CCTTGGAA
";

fn run() -> Result<(), Box<dyn Error>> {
    let records = match std::env::args().nth(1) {
        Some(path) => read_fasta(&path)?,
        None => parse_fasta(SAMPLE)?,
    };
    let Some((gene, introns)) = records.split_first() else {
        return Err("the dataset has no records".into());
    };

    let mut dna = gene.seq.clone();
    for intron in introns {
        dna = dna.replace(&intron.seq, "");
    }
    let rna = dna.replace('T', "U");
    println!("{}", translate(&rna));
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(cause) = e.source() {
            eprintln!("  caused by: {cause}");
        }
        std::process::exit(1);
    }
}
```

```text
MYSTERY
```

The compact `translate` treats each codon as a three-digit number in base 4, with U, C, A and G as the digits 0 to 3. So `UUU` is 0, `UUC` is 1 and `GGG` is 63, and that number indexes a 64-letter string where `*` marks the stop codons. It is the same table as the big `match`, just shorter to type; the `match` is easier to check by eye.

Notice how little error handling `run` needs. The parser reports bad input precisely, `?` converts every error on the way up, and an empty file becomes a clear message via `.into()` rather than a panic. `main` then prints whatever went wrong in plain words, including the cause behind a `FastaError::Io`:

```console
$ cargo run -- no_such_file.txt
error: could not read the FASTA file
  caused by: No such file or directory (os error 2)
```
:::

```quiz
? Why is an error enum usually better than `String` as a library's error type?
- Enums print faster than strings.
+ Callers can `match` on the variants and react differently to each kind of failure.
- Strings can't be returned inside a `Result`.
= With a `String`, callers can only compare message text. An enum lets them handle each case precisely, and the compiler checks they've covered them.

? What does `?` do with the error value before returning it?
- Converts it to a `String`.
- Nothing; it must already be the exact return type.
+ Calls `From::from` on it, converting it to the function's error type.
= This is why implementing `From<ParseIntError> for ConfigError` lets you use `?` on `parse()` in a function returning `Result<_, ConfigError>`.

? Which trait do you implement so that `println!("{}", err)` works?
+ `std::fmt::Display`
- `Debug`
- `From`
- `std::error::Error`
= `{}` uses `Display`. `{:?}` uses `Debug`, which you can derive. `Error` requires both, but doesn't provide either.

? When is `Box<dyn Error>` the most sensible error type?
- In a library's public functions, so callers get maximum detail.
+ In an application's `main` or other top-level code that mostly reports errors.
- Never; it is deprecated.
= `Box<dyn Error>` accepts any error type through `?`, which is very convenient, but callers can no longer easily match on the specific kind of error.
```
