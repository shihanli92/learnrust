---
title: Modules and Visibility
module: Building a package
summary: Organise code into modules, decide what is public, and split a growing project across files in a library-plus-binary package.
minutes: 35
---

So far every program has lived in a single `main.rs`. That works for one Rosalind problem at a time, but by now you have written the same helpers again and again: reading FASTA, complementing DNA, translating codons. The goal of this course is `dnakit`, a library that collects them for anyone to use, and a library needs structure. Which parts are the public interface? Which are private details you are free to change later? How is the code split across files?

Rust answers these questions with **modules**. This lesson starts the "Building a package" module of the course: by the end of it, you will have everything you need to write, test, document and publish a crate of your own.

## Packages, crates and modules

Three words come up constantly, and they mean different things:

| Term | What it is |
| --- | --- |
| **Package** | A folder with a `Cargo.toml`. It is what `cargo new` creates and what you publish. It contains one or more crates. |
| **Crate** | A unit of compilation. Either a *binary crate* (a program with `fn main`) or a *library crate* (code for other crates to use). |
| **Module** | A named container for items (functions, structs, enums, constants, other modules) inside a crate. |

Each crate starts from one file, its **crate root**. Cargo uses a simple convention:

- `src/main.rs` is the root of a binary crate with the same name as the package.
- `src/lib.rs` is the root of a library crate with the same name as the package.

A package may have both. You will see why that is useful at the end of this lesson.

## Modules and privacy

You create a module with `mod` and a block of items. Items inside are reached with a path using `::`:

```rust
mod dna {
    pub fn complement(strand: &str) -> String {
        strand.chars().map(pair).collect()
    }

    fn pair(base: char) -> char {
        match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            other => other,
        }
    }

    pub mod stats {
        pub fn length(strand: &str) -> usize {
            strand.len()
        }
    }
}

fn main() {
    let strand = "GATTACA";
    println!("{strand} pairs with {}", dna::complement(strand));
    println!("length: {}", dna::stats::length(strand));
}
```

```text
GATTACA pairs with CTAATGT
length: 7
```

Everything in Rust is **private by default**. `pair` has no `pub`, so only code inside `dna` (and modules nested inside it) can call it. Try from outside and the compiler stops you:

```rust,compile_fail
mod dna {
    fn pair(base: char) -> char {
        match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            other => other,
        }
    }
}

fn main() {
    println!("{}", dna::pair('A'));
}
```

```text
error[E0603]: function `pair` is private
  --> src/main.rs:14:25
   |
14 |     println!("{}", dna::pair('A'));
   |                         ^^^^ private function
```

Why private by default? Because everything you make public is a promise. Once other people call `pair`, you can no longer rename it, change its arguments or delete it without breaking their code. Keeping things private until you have a reason to expose them leaves you free to change your mind.

Two details about the rules:

- Privacy is about *where* the code is, not about the struct or function. Code in a child module can see everything in its ancestors, even private items. Code in a parent can only see the child's `pub` items.
- `pub mod stats` makes the module itself reachable, but you still need `pub` on each item inside it that should be visible.

## pub on structs and enums

Structs and enums differ in one important way.

A `pub struct` is visible, but **each field is still private** unless you mark it `pub` too. An enum is the opposite: if the enum is `pub`, **all its variants are public** automatically. A variant you couldn't name would be useless for matching, so Rust doesn't make you repeat yourself.

```rust
mod fasta {
    pub struct Record {
        pub id: String,
        seq: String,
    }

    impl Record {
        pub fn new(id: &str) -> Record {
            Record { id: id.to_string(), seq: String::new() }
        }

        pub fn add_line(&mut self, line: &str) {
            self.seq.push_str(&line.trim().to_uppercase());
        }

        pub fn seq(&self) -> &str {
            &self.seq
        }
    }

    #[derive(Debug)]
    pub enum Alphabet {
        Dna,
        Rna,
    }
}

fn main() {
    let mut record = fasta::Record::new("Rosalind_0042");
    record.add_line("acgtt\n");
    record.add_line("  GGA ");
    println!("{}: {} ({:?})", record.id, record.seq(), fasta::Alphabet::Dna);
    let _other = fasta::Alphabet::Rna;
}
```

```text
Rosalind_0042: ACGTTGGA (Dna)
```

Because `seq` is private, code outside `fasta` can't write `record.seq = String::from("hello")`, and it can't build a `Record` with a struct literal either. The only way in is through `new` and `add_line`, which trims each line and converts it to uppercase, and the only way to read it is the `seq` method. This is how Rust libraries protect *invariants*, rules like "a record's sequence is always uppercase with no stray spaces", which every function that later reads the sequence can rely on:

```rust,compile_fail
mod fasta {
    pub struct Record {
        pub id: String,
        seq: String,
    }
}

fn main() {
    let record = fasta::Record { id: String::from("x"), seq: String::from("acgt") };
}
```

```text
error[E0451]: field `seq` of struct `Record` is private
 --> src/main.rs:9:57
  |
9 |     let record = fasta::Record { id: String::from("x"), seq: String::from("acgt") };
  |                                                         ^^^ private field
```

## Paths: crate, self and super

A path can start in three special places:

| Path starts with | Means |
| --- | --- |
| `crate::` | the root of the current crate (an *absolute* path) |
| `self::` | the current module |
| `super::` | the parent module, like `..` in a file system |

```rust
mod bio {
    const GC_BASES: [char; 2] = ['G', 'C'];

    fn is_gc(base: char) -> bool {
        GC_BASES.contains(&base)
    }

    pub mod stats {
        pub fn gc_count(dna: &str) -> usize {
            dna.chars().filter(|&base| super::is_gc(base)).count()
        }

        pub fn gc_report(dna: &str) -> String {
            let percent = self::gc_count(dna) as f64 * 100.0 / dna.len() as f64;
            format!("{dna}: {percent:.1}% GC")
        }
    }
}

fn main() {
    println!("{}", crate::bio::stats::gc_report("AGCTATAG"));
    println!("{}", bio::stats::gc_count("GGCCAT"));
}
```

```text
AGCTATAG: 37.5% GC
4
```

`super::is_gc` works even though `is_gc` is private, because `stats` is a child of `bio`. `self::` is usually optional (`gc_count(dna)` would work too). Prefer `crate::` paths when you refer to something far away in your own crate; they keep working if you move the code that uses them.

## use: shorter names

Writing `crate::bio::stats::gc_count` every time gets old. A `use` declaration creates a shortcut in the current scope:

```rust
use std::collections::HashMap;
use std::fmt::{self, Display};

mod dna {
    pub struct Strand(pub String);
}

use dna::Strand;

impl Display for Strand {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "5'-{}-3'", self.0)
    }
}

fn main() {
    let mut strands = HashMap::new();
    strands.insert("forward", Strand(String::from("AGCTTAGG")));
    strands.insert("reverse", Strand(String::from("CCTAAGCT")));
    println!("{}", strands["forward"]);
}
```

```text
5'-AGCTTAGG-3'
```

The `use dna::Strand;` line lets the rest of the file write `Strand` instead of `dna::Strand`. (Biologists mark the two ends of a strand 5' and 3', read "five prime" and "three prime", to show which way it runs.)

A few conventions keep code readable:

- For **types** (structs, enums, traits), import the item itself: `use std::collections::HashMap;` and then write `HashMap`.
- For **functions**, import the parent module and call `module::function()`. Seeing `stats::gc_count(...)` or `fasta::parse(...)` tells the reader the function is not defined locally, and which part of the library it belongs to.
- Group imports from the same place with braces. `self` inside the braces imports the module itself, as in `use std::fmt::{self, Display};`.
- If two names clash, rename one with `as`: `use std::io::Result as IoResult;`.

## Re-exports with pub use

A plain `use` is private: the shortcut exists only inside that module. `pub use` makes it part of your public interface. This is called a **re-export**, and libraries use it to present a tidy API while organising the code however they like internally:

```rust
mod seq {
    mod dna {
        pub struct Dna {
            pub bases: String,
        }

        impl Dna {
            pub fn gc_content(&self) -> f64 {
                let gc = self.bases.chars().filter(|&b| b == 'G' || b == 'C').count();
                gc as f64 * 100.0 / self.bases.len() as f64
            }
        }
    }

    pub use dna::Dna;
}

fn main() {
    let d = seq::Dna { bases: String::from("GGCATTAC") };
    println!("GC content: {:.1}%", d.gc_content());
}
```

```text
GC content: 50.0%
```

The `dna` module is private, so outside code can't write `seq::dna::Dna`. Users see the short path `seq::Dna`, and you can later move `Dna` to another internal module without breaking anyone. Well-known crates do this all the time: many of the types you use from the standard library live in private modules and are re-exported.

:::tip pub(crate)
Sometimes an item should be usable anywhere in your crate but not by other crates. Write `pub(crate) fn helper()` for that. It is common for internal helpers in larger libraries: in `dnakit`, the function that checks a sequence for invalid bases is `pub(crate)`, so every module can use it but it isn't part of the public API.
:::

## Splitting modules into files

Inline `mod name { ... }` blocks are handy for examples, but real projects put each module in its own file. Replace the block with a declaration that ends in a semicolon:

```rust,ignore,file=src/lib.rs
pub mod fasta;
pub mod seq;
```

Each line tells the compiler "there is a module with this name; its contents are in another file". For `pub mod fasta;`, Cargo looks for `src/fasta.rs`. A module can have its own submodules, which live in a folder with the module's name:

```text
biokit/
├── Cargo.toml
└── src/
    ├── lib.rs           # pub mod fasta; pub mod seq;
    ├── fasta.rs         # reading FASTA files
    ├── seq.rs           # mod dna; mod rna; pub use ...
    └── seq/
        ├── dna.rs
        └── rna.rs
```

```rust,ignore,file=src/seq.rs
mod dna;
mod rna;

pub use dna::Dna;
pub use rna::Rna;
```

```rust,ignore,file=src/seq/dna.rs
pub struct Dna {
    pub bases: String,
}

impl Dna {
    pub fn gc_content(&self) -> f64 {
        let gc = self.bases.chars().filter(|&b| b == 'G' || b == 'C').count();
        gc as f64 * 100.0 / self.bases.len() as f64
    }
}
```

Notice that `dna.rs` does not contain `mod dna { ... }`. The file *is* the module body. Its name comes from the `mod dna;` line in the parent. A file that isn't declared with `mod` somewhere is simply ignored by the compiler, which is a common beginner surprise.

There is an older layout you will still see in many projects: `src/seq/mod.rs` instead of `src/seq.rs`. Both work the same. The newer style is recommended because otherwise every module folder has a file called `mod.rs`, and an editor with five `mod.rs` tabs open is confusing. Pick one style per project.

## A library and a binary in one package

Here is the layout the capstone project, `dnakit`, will use. The package has *both* `src/lib.rs` and `src/main.rs`, which means it contains two crates: a library and a binary, both named after the package.

```text
gc-calc/
├── Cargo.toml       # name = "gc-calc"
└── src/
    ├── lib.rs       # the library crate: all the real logic
    └── main.rs      # the binary crate: a thin command-line wrapper
```

```rust,ignore,file=src/lib.rs
pub fn gc_content(dna: &str) -> f64 {
    let gc = dna.chars().filter(|&b| b == 'G' || b == 'C').count();
    gc as f64 * 100.0 / dna.len() as f64
}
```

```rust,ignore,file=src/main.rs
fn main() {
    let gc = gc_calc::gc_content("GGCATTAC");
    println!("GC content: {gc:.1}%");
}
```

The binary is a separate crate, so it uses the library **by name**, exactly as any other project would, and it can only see `pub` items. `crate::` in `main.rs` would refer to the binary crate, not the library. Package names may contain hyphens, but crate names in code can't, so `gc-calc` becomes `gc_calc`.

Why bother splitting? Everything in `lib.rs` can be reused by other programs and is easy to test, while `main.rs` stays small: read the dataset, call the library, print the answer. It also forces you to design a public API, because `main.rs` is your library's first user.

:::rosalind RNA Transcribing DNA into RNA, one module at a time
When a cell uses a gene, it first copies the DNA into RNA, a process called *transcription*. RNA uses the same letters as DNA except one: where DNA has `T` (thymine), RNA has `U` (uracil). So transcribing a DNA string means replacing every `T` with `U`.

You probably solved this problem in one line before. This time, organise the solution the way a library would:

- A module `dna` with a public function `transcribe(dna: &str) -> String` and a private helper `transcribe_base(base: char) -> char` that it calls for each base.
- A module `rna` with a public function `is_rna(seq: &str) -> bool` that checks that every character is `A`, `C`, `G` or `U`.
- `main`, outside both modules, which reads the dataset (the file named on the command line, or a built-in sample), calls `dna::transcribe`, checks the result with `rna::is_rna`, and prints the RNA string on one line.

Try calling `dna::transcribe_base` from `main` too, to see the privacy error. For the sample `ACGTTTGACCTG` the output is:

```text
ACGUUUGACCUG
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "ACGTTTGACCTG\n";

mod dna {
    pub fn transcribe(dna: &str) -> String {
        dna.chars().map(transcribe_base).collect()
    }

    fn transcribe_base(base: char) -> char {
        if base == 'T' { 'U' } else { base }
    }
}

mod rna {
    pub fn is_rna(seq: &str) -> bool {
        seq.chars().all(|base| matches!(base, 'A' | 'C' | 'G' | 'U'))
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let transcript = dna::transcribe(input.trim());
    if !rna::is_rna(&transcript) {
        return Err(format!("not valid RNA: {transcript}").into());
    }
    println!("{transcript}");
    Ok(())
}
```

```text
ACGUUUGACCUG
```

Only `transcribe` and `is_rna` are `pub`; `transcribe_base` is an implementation detail that `main` can't reach, so you could later rewrite `transcribe` with `str::replace` without anyone noticing. The variable is called `transcript` rather than `rna`, so it doesn't look like the module of the same name. Run it on your download with `cargo run -- rosalind_rna.txt`.
:::

:::exercise Fix the privacy errors
This program models a cell that expresses a gene: the gene's instructions go to a ribosome, which builds the protein using the genetic code. It doesn't compile. Add the minimum number of `pub` keywords to make it work. Don't make `genetic_code` public.

```rust,compile_fail
mod cell {
    mod ribosome {
        fn build(gene: &str) -> String {
            format!("protein from {gene}, built with {}", super::genetic_code())
        }
    }

    fn genetic_code() -> &'static str {
        "the standard genetic code"
    }

    struct Gene {
        name: String,
    }

    impl Gene {
        fn new(name: &str) -> Gene {
            Gene { name: name.to_string() }
        }

        fn express(&self) -> String {
            ribosome::build(&self.name)
        }
    }
}

fn main() {
    let gene = cell::Gene::new("insulin");
    println!("{}", gene.express());
}
```
:::solution
```rust
mod cell {
    mod ribosome {
        pub fn build(gene: &str) -> String {
            format!("protein from {gene}, built with {}", super::genetic_code())
        }
    }

    fn genetic_code() -> &'static str {
        "the standard genetic code"
    }

    pub struct Gene {
        name: String,
    }

    impl Gene {
        pub fn new(name: &str) -> Gene {
            Gene { name: name.to_string() }
        }

        pub fn express(&self) -> String {
            ribosome::build(&self.name)
        }
    }
}

fn main() {
    let gene = cell::Gene::new("insulin");
    println!("{}", gene.express());
}
```

```text
protein from insulin, built with the standard genetic code
```

`ribosome` itself can stay private, because only code inside `cell` uses it, but `build` needs `pub` so its parent can call it. `Gene`, `new` and `express` are used from `main`, so they need `pub`. The `name` field and `genetic_code` can stay private: `ribosome` is a child of `cell`, so it may call its parent's private function.
:::

:::rosalind REVC Complementing a Strand of DNA, as a package
DNA is double-stranded: `A` pairs with `T` and `C` pairs with `G`, and the two strands run in opposite directions. So the partner strand of a DNA string, read in its own direction, is the *reverse complement*: reverse the string, then swap every base for its partner. The reverse complement of `AACG` is `CGTT`.

Build it as a real library-plus-binary package called `revc`, in files rather than inline modules:

- `src/dna.rs` holds a public `reverse_complement(dna: &str) -> String` and a private `complement(base: char) -> char`.
- `src/lib.rs` declares the module.
- `src/main.rs` takes the dataset file name from the command line (returning an error with a usage message if it is missing), and prints the reverse complement on one line.

Write down the directory tree and the contents of each file, then run it with `cargo run -- rosalind_revc.txt`. A dataset containing `TTGACCATGCA` should print `TGCATGGTCAA`.
:::solution
```text
revc/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── dna.rs
    └── main.rs
```

```rust,ignore,file=src/lib.rs
pub mod dna;
```

```rust,ignore,file=src/dna.rs
pub fn reverse_complement(dna: &str) -> String {
    dna.chars().rev().map(complement).collect()
}

fn complement(base: char) -> char {
    match base {
        'A' => 'T',
        'T' => 'A',
        'C' => 'G',
        'G' => 'C',
        other => other,
    }
}
```

```rust,ignore,file=src/main.rs
use std::error::Error;

use revc::dna;

fn main() -> Result<(), Box<dyn Error>> {
    let path = std::env::args().nth(1).ok_or("usage: revc <dataset-file>")?;
    let input = std::fs::read_to_string(path)?;
    println!("{}", dna::reverse_complement(input.trim()));
    Ok(())
}
```

```console
$ cargo run -- rosalind_revc.txt
TGCATGGTCAA
$ cargo run
Error: "usage: revc <dataset-file>"
```

`main.rs` uses the library by its crate name, `revc`, and `use revc::dna;` follows the convention of importing the module and calling `dna::reverse_complement`. `ok_or` turns the missing argument (`None`) into an error, and `?` returns it; a plain `&str` message converts into `Box<dyn Error>` automatically. If you want users to write `revc::reverse_complement`, add `pub use dna::reverse_complement;` to `lib.rs`.
:::

```quiz
? A `pub struct` has a field without `pub`. What can code outside the module do with that field?
- Read it but not change it.
+ Nothing: it can neither read nor write it, nor build the struct with a literal.
- Everything, because the struct is public.
- Only change it through a `&mut` reference.
= Struct fields are private unless marked `pub`. Outside code has to go through public methods such as a constructor and getters.

? What does `pub use internal::Record;` in `lib.rs` do?
- Makes the `internal` module public.
- Copies `Record` into a new type.
+ Lets users of the crate refer to `Record` directly from the crate root, even if `internal` is private.
- Nothing; `use` can't be `pub`.
= A re-export adds a public path to an item, so your public API can differ from your internal file layout.

? Inside `src/main.rs` of a package named `seq-tools` that also has a `src/lib.rs`, how do you call the library's public function `gc_content`?
- `crate::gc_content()`
- `lib::gc_content()`
- `seq-tools::gc_content()`
+ `seq_tools::gc_content()`
= The binary is its own crate and uses the library by name, with the hyphen replaced by an underscore.

? You add `src/fasta.rs` to a project but its code never seems to get compiled. What is most likely missing?
+ A `mod fasta;` line in the crate root (or its parent module).
- A `pub` keyword at the top of `fasta.rs`.
- An entry for the file in `Cargo.toml`.
- A `use fasta;` line in `main.rs`.
= Files only become modules when a parent declares them with `mod`. Cargo does not compile every file in `src/` automatically.
```
