---
title: Cargo and Dependencies
module: Building a package
summary: Read and write Cargo.toml, add crates from crates.io, understand version requirements and Cargo.lock, and use features, profiles and workspaces.
minutes: 30
---

You have been using Cargo since the first lesson to build and run code. Cargo is also Rust's package manager: it downloads other people's crates, picks compatible versions, and builds everything in the right order. Using a well-tested crate for a solved problem (reading FASTA files, JSON, command-line parsing) is normal and encouraged in Rust.

This lesson looks at Cargo from the point of view of someone about to write a crate: what goes in `Cargo.toml`, how dependencies and versions work, and which commands help you along the way.

## Anatomy of Cargo.toml

`Cargo.toml` is the package's **manifest**, written in TOML: `[section]` headers followed by `key = value` lines. A new library looks like this:

```console
$ cargo new --lib seqtools
    Creating library `seqtools` package
```

```toml
[package]
name = "seqtools"
version = "0.1.0"
edition = "2024"

[dependencies]
```

| Key | Meaning |
| --- | --- |
| `name` | The package name. It is also the default crate name, with `-` replaced by `_`. |
| `version` | Your package's own version, in `MAJOR.MINOR.PATCH` form. |
| `edition` | Which *edition* of the language to use. Editions (2015, 2018, 2021, 2024) let Rust make small breaking changes without breaking old code: each crate opts in, and crates of different editions work together fine. Use the newest for new code. |
| `[dependencies]` | The crates your code uses, and which versions are acceptable. |

`cargo new --lib` creates `src/lib.rs` instead of `src/main.rs`. Without `--lib` you get a binary package. As you saw in the previous lesson, you can add the other file later to have both.

There are many more `[package]` keys, such as `description`, `license` and `repository`. They matter when you publish, so they are covered in the publishing lesson.

## Adding a dependency

The quickest way to add a dependency is `cargo add`, which finds the latest version on [crates.io](https://crates.io) and edits `Cargo.toml` for you. Bioinformatics in Rust has a well-known crate for this: [rust-bio](https://rust-bio.github.io), published as `bio`. It reads FASTA and other file formats, and has hundreds of sequence algorithms.

```console
$ cargo new gc-finder
$ cd gc-finder
$ cargo add bio
    Updating crates.io index
      Adding bio v4.0.1 to dependencies
             Features:
             - generic-simd
             - pest
             - pest_derive
             - phylogeny
             - runtime-dispatch-simd
```

Your version numbers will probably be newer. `Cargo.toml` now contains:

```toml
[dependencies]
bio = "4.0.1"
```

The crate is now available in your code under its name. Here it reads FASTA records, joining wrapped lines for you:

```rust,ignore,file=src/main.rs
use bio::io::fasta;

const DATA: &str = ">seq1 wrapped over two lines
ACGTTGCA
GGCC
>seq2
ATATATAT
";

fn main() {
    let reader = fasta::Reader::new(DATA.as_bytes());
    for result in reader.records() {
        let record = result.expect("invalid FASTA");
        println!("{}: {} bases", record.id(), record.seq().len());
    }
}
```

```console
$ cargo run
   Compiling proc-macro2 v1.0.107
   Compiling unicode-ident v1.0.26
   Compiling libm v0.2.16
   ...
   Compiling bio v4.0.1
   Compiling gc-finder v0.1.0 (/home/you/gc-finder)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 32.96s
     Running `target/debug/gc-finder`
seq1: 12 bases
seq2: 8 bases
```

`fasta::Reader::new` accepts anything that can be read from, and a byte slice (`DATA.as_bytes()`) is the simplest such thing. Each record comes out as a `Result`, because a real file could be broken halfway through. `record.seq()` returns the sequence as a byte slice, `&[u8]`, rather than a `&str`: DNA is plain ASCII, and bytes are faster to work with.

The first build downloads and compiles `bio` and the crates *it* depends on, over ninety of them, which is why it takes half a minute. After that they are cached, so later builds only recompile your own code. You can remove a dependency with `cargo remove bio`.

:::tip Finding good crates
Search [crates.io](https://crates.io) for crates and check download counts, recent releases and the linked repository. Every crate published there gets its documentation built automatically on [docs.rs](https://docs.rs), for example `https://docs.rs/bio`. Read the docs before you add a dependency: a clear API and good examples are a sign of a well-maintained crate.
:::

## Version requirements

`bio = "4.0.1"` does *not* mean "exactly 4.0.1". It is a **version requirement** that says "any version compatible with 4.0.1", which here means anything from 4.0.1 up to, but not including, 5.0.0. Compatibility follows [Semantic Versioning](https://semver.org) (semver): the first non-zero number in the version is the one that signals breaking changes.

| Requirement | Allows | Notes |
| --- | --- | --- |
| `"1.2.3"` or `"^1.2.3"` | `>=1.2.3, <2.0.0` | the default, called a caret requirement |
| `"0.10.3"` | `>=0.10.3, <0.11.0` | for `0.x`, the minor number is the breaking one |
| `"~1.2.3"` | `>=1.2.3, <1.3.0` | tilde: only patch updates |
| `"=1.2.3"` | exactly `1.2.3` | rarely a good idea in a library |
| `"*"` | any version | not allowed for crates published on crates.io |
| `">=1.2, <1.5"` | a custom range | comparison operators can be combined |

The default caret requirement is almost always what you want. It lets you pick up bug fixes automatically while protecting you from breaking changes. The next few lessons will look at semver from the other side, when you decide the version numbers of your own crate.

## Cargo.lock

When Cargo resolves your requirements, it writes the exact versions it picked into `Cargo.lock`:

```text
[[package]]
name = "bio"
version = "4.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "..."
```

You never edit this file by hand. Its job is to make builds **reproducible**: as long as the lock file doesn't change, everyone who builds the project (you next month, a teammate, a CI server) gets exactly the same dependency versions, even if newer compatible versions have been released in the meantime.

- For applications, always commit `Cargo.lock` to version control.
- For libraries, the current recommendation is to commit it too. It only affects your own builds and tests: when someone depends on your library, *their* `Cargo.lock` decides the versions, and yours is ignored.

To move to newer compatible versions deliberately, run `cargo update` (everything) or `cargo update bio` (one crate). It changes `Cargo.lock`, not `Cargo.toml`.

## Features

Many crates have optional parts called **features** that you switch on when you need them. This keeps compile times and binary sizes down for everyone who doesn't. In `cargo add` output, `+` marks the features that will be enabled (the defaults plus any you ask for) and `-` the ones that stay off. All of `bio`'s features are optional: `phylogeny`, for example, adds a reader for evolutionary trees, and you only pay for compiling it if you switch it on.

```console
$ cargo add serde --features derive
    Updating crates.io index
      Adding serde v1.0.229 to dependencies
             Features:
             + derive
             + serde_derive
             + std
             - alloc
             - rc
             - unstable
    ...
```

Asking for `derive` also switched on `serde_derive`, the optional dependency that the feature needs. (The lines left out at the end are Cargo updating `Cargo.lock`.)

```toml
[dependencies]
serde = { version = "1.0.229", features = ["derive"] }
bio = { version = "4.0.1", features = ["phylogeny"] }
regex = { version = "1", default-features = false, features = ["std"] }
```

The last line shows how to switch off a crate's **default features** and pick only the ones you need, which is common in libraries that want to stay lightweight.

Your own crate can offer features too. A typical use is an **optional dependency** that users only pay for if they ask for it:

```toml
[dependencies]
serde = { version = "1", features = ["derive"], optional = true }

[features]
default = []
serde = ["dep:serde"]
```

Inside the crate, code that needs serde is marked `#[cfg(feature = "serde")]` so it only compiles when the feature is on. Users would enable it with `cargo add seqtools --features serde`. You won't need features for your first crate, but you will see them in every larger crate's docs.

## Dev-dependencies

Some crates are only needed for tests, examples and benchmarks. Put them under `[dev-dependencies]` (or use `cargo add --dev`):

```toml
[dev-dependencies]
pretty_assertions = "1"
```

Dev-dependencies are not built when someone else depends on your crate, so they don't slow down or bloat your users' builds.

## Build profiles

A **profile** is a set of compiler settings. You have used both built-in ones already:

| Profile | Used by | Optimised | Debug checks |
| --- | --- | --- | --- |
| `dev` | `cargo build`, `cargo run`, `cargo test` | no, so it compiles quickly | yes, including integer overflow panics |
| `release` | `cargo build --release`, `cargo run --release` | yes, so it runs quickly | overflow checks off |

You can tweak them in `Cargo.toml`, though the defaults are good:

```toml
[profile.dev]
opt-level = 1   # a little optimisation, for code that is too slow in debug builds

[profile.release]
lto = true      # link-time optimisation: slower builds, sometimes faster programs
```

Always measure speed with a release build. Debug builds can be 10 to 100 times slower, which you will notice as soon as you feed a program a whole genome instead of a Rosalind dataset.

## Workspaces, briefly

When a project grows into several related packages (say a library, a command-line tool and a web server that share code), you can group them in a **workspace**. A root `Cargo.toml` lists the members:

```toml
[workspace]
members = ["core", "cli"]
resolver = "3"
```

All members share one `Cargo.lock` and one `target/` directory, so shared dependencies are built only once, and `cargo test` at the root tests everything. One package can depend on another in the workspace by path, for example `core = { path = "../core" }` in `cli/Cargo.toml`. For a single crate you don't need a workspace at all.

## Commands worth knowing

| Command | What it does |
| --- | --- |
| `cargo add name` / `cargo remove name` | Add or remove a dependency. |
| `cargo tree` | Show the full dependency tree, including dependencies of dependencies. |
| `cargo update` | Update `Cargo.lock` to the newest compatible versions. |
| `cargo doc --open` | Build docs for your crate *and all its dependencies* and open them in a browser. Works offline. |
| `cargo search name` | Search crates.io from the terminal. |
| `cargo install name` | Install a binary crate (a tool) from crates.io into `~/.cargo/bin`. |
| `cargo clean` | Delete `target/`, forcing a full rebuild. |

`cargo tree` is especially useful when you want to know why a crate you never added is in your build. With `-i` (for *invert*) it shows who depends on a given crate. You never asked for `memchr`, so where does it come from?

```console
$ cargo tree -i memchr
memchr v2.8.3
├── aho-corasick v1.1.5
│   ├── regex v1.13.1
│   │   ├── bio v4.0.1
│   │   │   └── gc-finder v0.1.0 (/home/you/gc-finder)
│   │   └── bio-types v1.0.4
│   │       └── bio v4.0.1 (*)
│   └── regex-automata v0.4.18
│       └── regex v1.13.1 (*)
├── csv-core v0.1.13
│   └── csv v1.4.0
│       └── bio v4.0.1 (*)
├── regex v1.13.1 (*)
└── regex-automata v0.4.18 (*)
```

Read it from the bottom of each branch up: `bio` uses `regex` and `csv`, and they use `memchr`. The `(*)` marks a crate whose subtree was already shown.

:::note Every dependency is code you trust
A dependency runs with the same permissions as your own code. Prefer popular, maintained crates, keep the list short, and don't add a crate for something you can write in ten lines. `bio` is excellent when you need its algorithms, but it brings in over ninety crates. The `dnakit` crate you will build in the capstone needs only a FASTA reader and a few sequence functions, so it writes them itself and has no dependencies at all.
:::

:::exercise Read the requirements
A colleague's sequencing pipeline has this `[dependencies]` section (the crate names are made up). For each line, write down which versions Cargo may choose.

```toml
[dependencies]
fastq-lite = "2.4"
seq-align = "0.3.1"
codon-table = "~1.7.2"
primer-design = "=0.9.0"
phylo-tree = "0.0.4"
```
:::solution
- `fastq-lite = "2.4"`: `>=2.4.0, <3.0.0`.
- `seq-align = "0.3.1"`: `>=0.3.1, <0.4.0`, because for `0.x` versions the minor number is the breaking one.
- `codon-table = "~1.7.2"`: `>=1.7.2, <1.8.0`.
- `primer-design = "=0.9.0"`: exactly `0.9.0`.
- `phylo-tree = "0.0.4"`: exactly `0.0.4` (`>=0.0.4, <0.0.5`). For `0.0.x`, every release counts as potentially breaking.
:::

:::rosalind GC Computing GC Content with rust-bio
GC content is the percentage of bases in a DNA string that are `G` or `C`. It varies between species, so it helps identify where an unknown piece of DNA came from. The dataset is a FASTA file with up to 10 records; the answer is the ID of the record with the highest GC content on one line, and its GC content as a percentage on the next, such as `53.125000`. Rosalind accepts an error of up to 0.001.

Solve it in the `gc-finder` package from this lesson, letting `bio` do the work: `bio::io::fasta::Reader` for the file, and `bio::seq_analysis::gc::gc_content`, which takes a byte slice and returns the GC content as a fraction between 0 and 1. Read the dataset file named on the command line, falling back to a built-in sample. For this sample:

```text
>Rosalind_0001
CCTGCGGAAGATCGGCACTAGA
ATCCCACTAAT
>Rosalind_0002
GCCGCCCAGGGCAACGAATTATGGGCG
```

the output is:

```text
Rosalind_0002
66.666669
```
:::solution
```rust,ignore,file=src/main.rs
use std::error::Error;

use bio::io::fasta;
use bio::seq_analysis::gc::gc_content;

const SAMPLE: &str = ">Rosalind_0001
CCTGCGGAAGATCGGCACTAGA
ATCCCACTAAT
>Rosalind_0002
GCCGCCCAGGGCAACGAATTATGGGCG
";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };

    let mut best: Option<(String, f64)> = None;
    for result in fasta::Reader::new(input.as_bytes()).records() {
        let record = result?;
        let gc = gc_content(record.seq()) as f64 * 100.0;
        match best {
            Some((_, top)) if top >= gc => {}
            _ => best = Some((record.id().to_string(), gc)),
        }
    }

    let (id, gc) = best.ok_or("no records in the dataset")?;
    println!("{id}\n{gc:.6}");
    Ok(())
}
```

This needs the `bio` crate, so it can't run in the course's checker or the Playground. Run it with `cargo run -- rosalind_gc.txt` in your own project.

The exact answer for the sample is 66.666667: `gc_content` returns an `f32`, which keeps only about seven significant digits, so the last digits are slightly off. That is well within Rosalind's tolerance. The `match` keeps the best record so far and replaces it only when a record has a strictly higher GC content. Matching on `best` doesn't move the `String` out, because the pattern only copies the `f64`.
:::

:::rosalind REVC Complementing a Strand of DNA with rust-bio
The two strands of DNA pair `A` with `T` and `C` with `G`, and run in opposite directions. The *reverse complement* of a DNA string is its partner strand read in its own direction: reverse the string and swap every base for its partner. The dataset is one DNA string; print its reverse complement on one line.

Use `bio::alphabets::dna::revcomp`, which takes the bases as bytes and returns a `Vec<u8>`. Turn the result back into a `String` with `String::from_utf8`. For the sample `TTGACCATGCA`, the output is:

```text
TGCATGGTCAA
```
:::solution
```rust,ignore,file=src/main.rs
use std::error::Error;

use bio::alphabets::dna;

const SAMPLE: &str = "TTGACCATGCA\n";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let partner = dna::revcomp(input.trim().as_bytes());
    println!("{}", String::from_utf8(partner)?);
    Ok(())
}
```

`String::from_utf8` returns a `Result`, because not every list of bytes is valid text; `?` passes on the error if it ever fails. Compare this with your own solution from earlier in the course: using a crate saves a few lines here, but costs a large dependency. For one function, writing it yourself is often the better deal; for a sequence aligner or a suffix array, a crate like `bio` saves you weeks.
:::

```quiz
? Your `Cargo.toml` says `serde = "1.0.200"`. Which version could Cargo pick?
- Only `1.0.200`.
+ `1.0.229`
- `2.0.0`
- `0.9.9`
= The default caret requirement allows any version from `1.0.200` up to, but not including, `2.0.0`.

? What is `Cargo.lock` for?
- It lists the dependencies you want and their version ranges.
+ It records the exact versions that were resolved, so builds are reproducible.
- It stops other people from publishing a crate with the same name.
- It prevents `cargo` from downloading anything.
= `Cargo.toml` says what is acceptable. `Cargo.lock` records what was actually chosen. `cargo update` changes the lock file.

? Where should a crate you only use in tests go?
+ `[dev-dependencies]`
- `[dependencies]` with `optional = true`
- `[features]`
- `[profile.dev]`
= Dev-dependencies are available to tests, examples and benchmarks, and are not built for people who depend on your crate.

? A number-crunching program is slow with `cargo run` but fast with `cargo run --release`. Why?
- `--release` skips the borrow checker.
- `--release` runs the program on several cores.
+ The default `dev` profile doesn't optimise, to keep compile times short.
- The `dev` profile adds a delay for debugging.
= The `release` profile turns on optimisations. Compiling takes longer, but the program can be many times faster.
```
