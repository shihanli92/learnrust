---
title: Capstone: Build dnakit
module: Building a package
summary: Put the whole course together by building, testing, documenting and packaging dnakit, a bioinformatics library and command-line tool that solves Rosalind problems.
minutes: 120
---

Time to build something real. In this project you will write `dnakit`, a library crate for DNA, RNA and protein sequences (reading FASTA files, counting bases, GC content, transcription, reverse complements and translation) plus a command-line tool that uses it to solve Rosalind problems straight from a downloaded dataset. Along the way you will use almost everything from the course: structs and enums, pattern matching, collections, a custom error type, closures and iterators, modules, tests, doc comments and Cargo metadata. At the end, the crate is ready to publish.

You have solved most of these problems before, one program at a time. The difference now is structure: the solutions become a tested, documented library with one tool in front of it, which is how real bioinformatics software is organised. Work through the steps in order and type the code yourself rather than copying it. A finished reference implementation lives in the course repository in the `capstone/dnakit/` folder, and the finished files on this page are identical to it, so you can compare your version whenever you get stuck. The crate grows one module at a time, and it compiles and passes its tests after every step, so a few files first appear in an early version that a later step completes.

## What you will build

Rosalind's GC problem gives you a FASTA file like this one (made up for this page; your download will have different IDs and longer sequences). To try the examples yourself, save it as `rosalind_gc.txt` in a folder of its own, such as `~/rosalind/`, and not inside the package you are about to create: datasets are input for the tool, not part of it, and files in the package folder end up in git and in the published package.

```text,file=~/rosalind/rosalind_gc.txt
>Rosalind_6397
TTAGTGACAGTCAAGGCTAAAGCTTATTTCAACAATCATTTGTTGTGTATATGTACCAAT
ACTTCGCATACTCAGGAACTATACGACACCAA
>Rosalind_6407
AATCCGACTAGACGGCCCCATTCTGACCTTCATAGAAGCGTCAGAACTGTATGTGCACGC
CTCCGCACGAGATCGTCGGCGGTGTAGGCTCGGCTTACCATATCG
>Rosalind_2152
ACGGAAATATAATGCTAACGATGGGCATAGATCAAGTGCACGCCCTAGTGTACAGTCCAT
GCCTAGATGCACCAAGAAGTCACACGAC
```

The finished tool takes the problem ID and the file, and prints the answer in exactly the format Rosalind wants: the ID of the record with the highest GC content, then its GC content as a percentage.

```console
$ cd ~/rosalind
$ dnakit gc rosalind_gc.txt
Rosalind_6407
56.190476
```

The same tool solves five more problems, and it reports problems in plain words instead of crashing. The next commands use two more small files from the same folder: `rosalind_revc.txt` holds one line of DNA, and `bad.txt` holds the same line with a typo at position 11.

```text,file=~/rosalind/rosalind_revc.txt
ATGCTTCAGAAAGGTCTTACG
```

```text,file=~/rosalind/bad.txt
ATGCTTCAGAXAGGTCTTACG
```

```console
$ dnakit revc rosalind_revc.txt
CGTAAGACCTTTCTGAAGCAT
$ dnakit dna rosalind_revc.txt
6 4 5 6
$ dnakit dna bad.txt
dnakit: invalid base 'X' at position 11
$ dnakit subs rosalind_revc.txt
dnakit: unknown problem "subs" (try: dna, rna, revc, gc, hamm, prot)
$ dnakit revc
usage: dnakit <problem> <dataset-file>
problems: dna, rna, revc, gc, hamm, prot
```

`subs` is not supported yet. Adding it is the first exercise at the end of this lesson.

## Step 1: Create the package

Start with a library package. You will add the binary's `src/main.rs` to it in step 8.

```console
$ cargo new --lib dnakit
    Creating library `dnakit` package
$ cd dnakit
```

`cargo new` also makes the folder a git repository, with a `.gitignore` file that keeps the `target/` build folder out of it. You will make the first commit in step 12.

By the end of the project, the package will look like this:

```text
dnakit/
├── Cargo.toml
├── LICENSE-APACHE
├── LICENSE-MIT
├── README.md
├── src/
│   ├── lib.rs        # crate root: docs, modules, re-exports
│   ├── error.rs      # the Error type
│   ├── fasta.rs      # reading FASTA files
│   ├── seq.rs        # DNA helpers: counts, GC content, transcription, reverse complement
│   ├── protein.rs    # translating RNA into protein
│   ├── rosalind.rs   # solve(problem, dataset): one match arm per problem
│   └── main.rs       # the thin command-line tool
└── tests/
    ├── rosalind.rs   # integration tests with sample datasets
    └── cli.rs        # tests that run the real binary
```

This is the library-plus-binary layout from the modules lesson. All the logic lives in the library, where it is easy to test and reusable by other programs. `main.rs` only reads the arguments and the file, calls the library and prints.

Notice that even the part that turns a dataset into an answer (`rosalind.rs`) is in the library, not in `main.rs`. It is the part most worth testing: an answer in the wrong format is rejected by Rosalind just like a wrong answer, and integration tests can only reach code in the library.

## Step 2: The crate root

`src/lib.rs` is the crate root: it declares the modules and decides what users of the library can see. It grows by one `mod` line per step, so the crate compiles and `cargo test` can run after every step. Replace its contents with this first version, which has only the error module you will write next:

```rust,ignore,file=src/lib.rs (first version)
//! Small, dependency-free tools for DNA, RNA and protein sequences.

#![warn(missing_docs)]

mod error;

pub use error::Error;
```

- The `//!` comment documents the crate itself and becomes the front page of its documentation. It gets an example in step 7, once there is something to show.
- `#![warn(missing_docs)]` makes the compiler remind you about every public item you forget to document.
- `mod error;` declares a private module, and `pub use error::Error;` re-exports the type it defines. Users write `dnakit::Error`, not `dnakit::error::Error`, and you are free to reorganise the files later without breaking anyone.

The crate won't build until `src/error.rs` exists, which is the very next step.

## Step 3: The error type

Several things can go wrong in `dnakit`: a sequence can contain a character that isn't a base, a FASTA file can be malformed, a dataset can have the wrong shape, and the file can fail to load. Create `src/error.rs`:

```rust,ignore,file=src/error.rs (first version)
use std::fmt;
use std::io;

/// Everything that can go wrong in dnakit.
#[derive(Debug)]
#[non_exhaustive]
pub enum Error {
    /// A sequence contained a character that is not allowed in it.
    InvalidBase {
        /// Where the character is, counting from 1.
        position: usize,
        /// The character that was found.
        found: char,
    },
    /// A FASTA file had sequence data before its first `>` header line.
    MissingHeader {
        /// The line number, counting from 1.
        line: usize,
    },
    /// Two sequences that must be equally long are not.
    LengthMismatch {
        /// Length of the first sequence.
        first: usize,
        /// Length of the second sequence.
        second: usize,
    },
    /// A dataset did not have the shape the problem needs. The message says
    /// what was expected.
    BadDataset(String),
    /// A dataset file could not be read.
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
            Error::InvalidBase { position, found } => {
                write!(f, "invalid base {found:?} at position {position}")
            }
            Error::MissingHeader { line } => {
                write!(f, "line {line}: sequence data before the first '>' header")
            }
            Error::LengthMismatch { first, second } => {
                write!(f, "sequences differ in length ({first} and {second})")
            }
            Error::BadDataset(message) => write!(f, "bad dataset: {message}"),
            Error::Io { path, source } => write!(f, "cannot read {path}: {source}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}
```

This follows the custom error lesson:

- An enum with one variant per kind of failure. Variants carry the details a person needs to fix the problem: *which* character, at *which* position, on *which* line. `Io` keeps the file name *and* the original `io::Error`.
- Positions and line numbers count from 1, because they are for people (and Rosalind counts from 1 too).
- `Display` writes a message meant for people.
- Implementing `std::error::Error` makes it a proper error type. `source` exposes the underlying I/O error for tools that print error chains.
- `#[non_exhaustive]` is the attribute from the publishing lesson. Code outside the crate that matches on `Error` must include a `_ =>` arm, so adding a variant in a later version is not a breaking change. Inside the crate, where you know every variant, it changes nothing.

The type is called `Error`, the usual name for a crate's main error type. Users see it as `dnakit::Error`, just as the standard library has `std::io::Error` and `std::fmt::Error`. Inside this file, `std::error::Error` (the trait) is always written out in full so the two don't get mixed up.

This is the first version of the file. Step 7 adds one more variant, for a problem ID the tool doesn't know, together with the code that needs it. Run `cargo test` now: there are no tests yet, so it reports `0 passed` twice (once for unit tests, once for doc tests), but it proves that the crate compiles.

## Step 4: Reading FASTA

Most Rosalind datasets from GC onwards are FASTA files, so parsing them is the first real job. Create `src/fasta.rs`:

```rust,ignore,file=src/fasta.rs
//! Reading sequences in FASTA format.
//!
//! A FASTA file holds one or more records. Each record starts with a header
//! line beginning with `>`, followed by the sequence, which may be wrapped
//! over several lines:
//!
//! ```text
//! >Rosalind_0001
//! ACGTACGTAC
//! GGTTAA
//! >Rosalind_0002
//! TTGACA
//! ```

use crate::Error;

/// One FASTA record: an ID and its sequence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    /// The first word of the header line, without the `>`.
    pub id: String,
    /// The sequence, with all of its lines joined together.
    pub seq: String,
}

/// Parses FASTA text into a list of records, in the order they appear.
///
/// Sequence lines are joined, blank lines are skipped, and spaces at the
/// start or end of a line are ignored. Anything after the first word of a
/// header line is ignored too. Text with no records gives an empty list.
///
/// # Errors
///
/// Returns [`Error::MissingHeader`] if a sequence line comes before the
/// first header line.
///
/// # Examples
///
/// ```
/// use dnakit::fasta;
///
/// let text = ">one\nACGT\nAC\n\n>two some description\nGGG\n";
/// let records = fasta::parse(text).unwrap();
/// assert_eq!(records.len(), 2);
/// assert_eq!(records[0].id, "one");
/// assert_eq!(records[0].seq, "ACGTAC");
/// assert_eq!(records[1].id, "two");
/// ```
pub fn parse(text: &str) -> Result<Vec<Record>, Error> {
    let mut records: Vec<Record> = Vec::new();
    for (index, line) in text.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(header) = line.strip_prefix('>') {
            let id = header.split_whitespace().next().unwrap_or("");
            records.push(Record {
                id: id.to_string(),
                seq: String::new(),
            });
        } else {
            match records.last_mut() {
                Some(record) => record.seq.push_str(line),
                None => return Err(Error::MissingHeader { line: index + 1 }),
            }
        }
    }
    Ok(records)
}
```

Some decisions worth understanding:

- **Module docs.** A `//!` comment at the top of a module file documents the module. Because `fasta` is a public module, this becomes its page in the generated docs. The example there is marked `text`, so rustdoc shows it without trying to compile it.
- **One pass, no lookahead.** `parse` walks through the lines once. A header line starts a new, empty `Record`; any other line is added to the *last* record with `records.last_mut()`, which returns an `Option<&mut Record>`. That is how wrapped sequences are joined, and it is also how the "sequence before any header" mistake is spotted: there is no last record yet, so `last_mut` returns `None`.
- **Forgiving about whitespace.** `trim` removes spaces and tabs at both ends of each line, and blank lines are skipped. `lines` already handles both Unix (`\n`) and Windows (`\r\n`) line endings. Real data files are messy, and a parser that trips over a trailing space is no fun five minutes before a deadline.
- **`strip_prefix`** returns `Some(rest)` if the line starts with `>`, which both tests for a header and removes the `>` in one step. `split_whitespace().next()` then keeps the first word; `unwrap_or("")` handles a header that is just `>`.
- **The index** from `enumerate` counts from 0, so the error adds 1 to report a line number a person can find in their editor.

Now its tests, at the bottom of the same file:

```rust,ignore,file=src/fasta.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_wrapped_lines() {
        let records = parse(">a\nAC\nGT\n>b\nTT\n").unwrap();
        assert_eq!(
            records,
            vec![
                Record {
                    id: "a".to_string(),
                    seq: "ACGT".to_string()
                },
                Record {
                    id: "b".to_string(),
                    seq: "TT".to_string()
                },
            ]
        );
    }

    #[test]
    fn ignores_blank_lines_and_extra_spaces() {
        let records = parse("\n >a \nAC  \n\n\tGT\r\n").unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].seq, "ACGT");
    }

    #[test]
    fn empty_text_has_no_records() {
        assert!(parse("").unwrap().is_empty());
    }

    #[test]
    fn sequence_before_header_is_an_error() {
        let result = parse("\nACGT\n>a\nAC\n");
        assert!(matches!(result, Err(Error::MissingHeader { line: 2 })));
    }
}
```

`matches!` returns `true` if a value matches a pattern, and patterns can include literal values, so `Error::MissingHeader { line: 2 }` checks both the variant and the line number in one go. Each test checks one behaviour, and its name says which. The edge cases are the valuable ones: blank lines, stray spaces, empty input, and a broken file.

Finally, declare the new module in the crate root. Below `#![warn(missing_docs)]`, `src/lib.rs` now reads:

```rust,ignore,file=src/lib.rs (step 4)
mod error;
pub mod fasta;

pub use error::Error;
```

Unlike `error`, `fasta` is a *public* module. Its function is called `parse`, which would be too vague on its own, so, following the `use` conventions from the modules lesson, users call it with the module name in front: `fasta::parse(...)`. Run `cargo test`: the four new tests pass, and so does the example in the documentation of `parse`, which runs as a doc test.

## Step 5: Sequence helpers

Now the functions that do the biology. They all share one rule: a DNA sequence may only contain the uppercase letters `A`, `C`, `G` and `T`, and anything else is an error rather than a panic or a wrong answer. Create `src/seq.rs`:

```rust,ignore,file=src/seq.rs
use crate::Error;

/// How many times each base occurs in a DNA sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BaseCounts {
    /// Number of `A`s.
    pub a: usize,
    /// Number of `C`s.
    pub c: usize,
    /// Number of `G`s.
    pub g: usize,
    /// Number of `T`s.
    pub t: usize,
}

/// Checks that every character of `seq` is one of the characters in
/// `alphabet`, such as `"ACGT"` for DNA.
pub(crate) fn check_bases(seq: &str, alphabet: &str) -> Result<(), Error> {
    for (index, found) in seq.chars().enumerate() {
        if !alphabet.contains(found) {
            return Err(Error::InvalidBase {
                position: index + 1,
                found,
            });
        }
    }
    Ok(())
}

/// Counts the `A`, `C`, `G` and `T` bases in a DNA sequence.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] if `dna` contains anything other than the
/// uppercase letters `A`, `C`, `G` and `T`.
///
/// # Examples
///
/// ```
/// use dnakit::count_bases;
///
/// let counts = count_bases("GATTACA").unwrap();
/// assert_eq!((counts.a, counts.c, counts.g, counts.t), (3, 1, 1, 2));
/// ```
pub fn count_bases(dna: &str) -> Result<BaseCounts, Error> {
    check_bases(dna, "ACGT")?;
    Ok(BaseCounts {
        a: dna.matches('A').count(),
        c: dna.matches('C').count(),
        g: dna.matches('G').count(),
        t: dna.matches('T').count(),
    })
}

/// Returns the percentage (0 to 100) of bases in `dna` that are `G` or `C`.
///
/// An empty sequence has a GC content of 0.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::gc_content;
///
/// assert_eq!(gc_content("GGCA").unwrap(), 75.0);
/// ```
pub fn gc_content(dna: &str) -> Result<f64, Error> {
    let counts = count_bases(dna)?;
    if dna.is_empty() {
        return Ok(0.0);
    }
    Ok((counts.g + counts.c) as f64 * 100.0 / dna.len() as f64)
}
```

- **`check_bases` is `pub(crate)`.** Every function in `seq.rs` validates its input, and so will the translation code in `protein.rs`, so the check lives in one helper that the whole crate can call. It isn't part of the public API, so users never see it, and you can change it freely.
- **Validate first, then compute.** Once `check_bases` has passed, the rest of each function can assume clean input. `count_bases` just counts each letter with `str::matches`, which finds every occurrence of a pattern.
- **`BaseCounts`** is a struct with public fields rather than a tuple or array, so callers write `counts.g` instead of remembering that G is at index 2. Deriving `Default` gives the all-zero value for free.
- **`gc_content`** reuses `count_bases` for validation and counting. An empty sequence would mean dividing zero by zero, which gives `NaN` for floats, so it returns 0 instead, and the docs say so. `dna.len()` counts bytes, which is the same as counting characters here because `check_bases` has already made sure every character is one of four ASCII letters.

Continue in the same file:

```rust,ignore,file=src/seq.rs
/// Transcribes DNA into RNA by replacing every `T` with `U`.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::transcribe;
///
/// assert_eq!(transcribe("GATTACA").unwrap(), "GAUUACA");
/// ```
pub fn transcribe(dna: &str) -> Result<String, Error> {
    check_bases(dna, "ACGT")?;
    Ok(dna.replace('T', "U"))
}

/// Returns the reverse complement of a DNA sequence: the other strand of
/// the double helix, read in its own direction.
///
/// Every base is swapped for its partner (`A` with `T`, `C` with `G`) and
/// the result is reversed.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::reverse_complement;
///
/// assert_eq!(reverse_complement("AACG").unwrap(), "CGTT");
/// assert!(reverse_complement("AAXG").is_err());
/// ```
pub fn reverse_complement(dna: &str) -> Result<String, Error> {
    check_bases(dna, "ACGT")?;
    Ok(dna.chars().rev().map(complement).collect())
}

/// The partner of a DNA base.
fn complement(base: char) -> char {
    match base {
        'A' => 'T',
        'T' => 'A',
        'C' => 'G',
        'G' => 'C',
        _ => unreachable!("check_bases only lets A, C, G and T through"),
    }
}

/// Counts the positions at which two sequences differ (their Hamming
/// distance).
///
/// Any characters can be compared, not only DNA bases.
///
/// # Errors
///
/// Returns [`Error::LengthMismatch`] if the sequences are not equally long.
///
/// # Examples
///
/// ```
/// use dnakit::hamming;
///
/// assert_eq!(hamming("GATTACA", "GACTATA").unwrap(), 2);
/// assert!(hamming("GAT", "GATT").is_err());
/// ```
pub fn hamming(first: &str, second: &str) -> Result<usize, Error> {
    let (len1, len2) = (first.chars().count(), second.chars().count());
    if len1 != len2 {
        return Err(Error::LengthMismatch {
            first: len1,
            second: len2,
        });
    }
    Ok(first
        .chars()
        .zip(second.chars())
        .filter(|(a, b)| a != b)
        .count())
}
```

- **`transcribe`** is a single `replace`: RNA uses `U` (uracil) where DNA has `T` (thymine).
- **`reverse_complement`** reads the characters backwards with `rev`, swaps each one for its partner by passing the function `complement` to `map`, and collects the result into a `String`. The order doesn't matter here (reversing then complementing gives the same result as the other way round), so the whole thing is one iterator chain.
- **`complement`** is private and only ever sees checked input. The last arm uses `unreachable!`, a macro that panics with a message. It documents an assumption: if this line ever runs, there is a bug in the crate, not in the user's data. That makes it a legitimate panic in the sense of the error-handling lesson.
- **`hamming`** doesn't validate bases at all, because counting differences makes sense for any two strings. It does insist on equal lengths, since `zip` would otherwise stop quietly at the end of the shorter string and give a wrong answer. The lengths are counted in characters so the error message makes sense even for non-ASCII input.

The tests go at the bottom:

```rust,ignore,file=src/seq.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_bases_reports_the_first_bad_character() {
        assert!(check_bases("ACGT", "ACGT").is_ok());
        let result = check_bases("ACxTy", "ACGT");
        assert!(matches!(
            result,
            Err(Error::InvalidBase {
                position: 3,
                found: 'x'
            })
        ));
    }

    #[test]
    fn lowercase_is_not_a_base() {
        assert!(count_bases("acgt").is_err());
    }

    #[test]
    fn counts_every_base() {
        let counts = count_bases("AACCCGGGGT").unwrap();
        assert_eq!(
            counts,
            BaseCounts {
                a: 2,
                c: 3,
                g: 4,
                t: 1
            }
        );
    }

    #[test]
    fn gc_content_of_empty_sequence_is_zero() {
        assert_eq!(gc_content("").unwrap(), 0.0);
        assert_eq!(gc_content("ATAT").unwrap(), 0.0);
        assert_eq!(gc_content("GCGC").unwrap(), 100.0);
    }

    #[test]
    fn transcribe_only_changes_t() {
        assert_eq!(transcribe("ACGTTT").unwrap(), "ACGUUU");
    }

    #[test]
    fn reverse_complement_twice_gives_the_original() {
        let dna = "ATGCCGTAAG";
        let twice = reverse_complement(&reverse_complement(dna).unwrap()).unwrap();
        assert_eq!(twice, dna);
    }

    #[test]
    fn hamming_distance() {
        assert_eq!(hamming("", "").unwrap(), 0);
        assert_eq!(hamming("AAAA", "TTTT").unwrap(), 4);
        assert!(matches!(
            hamming("AA", "AAA"),
            Err(Error::LengthMismatch {
                first: 2,
                second: 3
            })
        ));
    }
}
```

`reverse_complement_twice_gives_the_original` tests a *property* instead of a single example: doing the operation twice must give back what you started with. `lowercase_is_not_a_base` pins down a decision (lowercase input is rejected), so nobody changes it by accident.

Declare the module in `src/lib.rs` and re-export its public items:

```rust,ignore,file=src/lib.rs (step 5)
mod error;
pub mod fasta;
mod seq;

pub use error::Error;
pub use seq::{BaseCounts, count_bases, gc_content, hamming, reverse_complement, transcribe};
```

This time the module stays private and the `pub use` line re-exports the items, so users write `dnakit::reverse_complement`, not `dnakit::seq::reverse_complement`. `cargo test` now runs 11 unit tests and 6 doc tests.

## Step 6: Translating RNA into protein

A ribosome reads RNA three bases at a time. Each group of three, a *codon*, stands for one amino acid, except the three *stop codons*, which end the protein. Create `src/protein.rs`:

```rust,ignore,file=src/protein.rs
use crate::Error;
use crate::seq::check_bases;

/// Translates RNA into a protein, written with one-letter amino acid codes.
///
/// The RNA is read three bases (one *codon*) at a time from the start, using
/// the standard genetic code. Translation ends at the first stop codon
/// (`UAA`, `UAG` or `UGA`) or at the end of the RNA; one or two bases left
/// over at the end are ignored.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] if `rna` contains anything other than the
/// uppercase letters `A`, `C`, `G` and `U`.
///
/// # Examples
///
/// ```
/// use dnakit::translate;
///
/// assert_eq!(translate("AUGUUUCCCUAA").unwrap(), "MFP");
/// assert_eq!(translate("AUGGC").unwrap(), "M");
/// ```
pub fn translate(rna: &str) -> Result<String, Error> {
    check_bases(rna, "ACGU")?;
    let mut protein = String::new();
    for codon in rna.as_bytes().chunks_exact(3) {
        match amino_acid(codon) {
            Some(letter) => protein.push(letter),
            None => break,
        }
    }
    Ok(protein)
}

/// Looks up one codon in the standard genetic code. Returns `None` for the
/// three stop codons.
fn amino_acid(codon: &[u8]) -> Option<char> {
    let letter = match codon {
        b"UUU" | b"UUC" => 'F',
        b"UUA" | b"UUG" | b"CUU" | b"CUC" | b"CUA" | b"CUG" => 'L',
        b"AUU" | b"AUC" | b"AUA" => 'I',
        b"AUG" => 'M',
        b"GUU" | b"GUC" | b"GUA" | b"GUG" => 'V',
        b"UCU" | b"UCC" | b"UCA" | b"UCG" | b"AGU" | b"AGC" => 'S',
        b"CCU" | b"CCC" | b"CCA" | b"CCG" => 'P',
        b"ACU" | b"ACC" | b"ACA" | b"ACG" => 'T',
        b"GCU" | b"GCC" | b"GCA" | b"GCG" => 'A',
        b"UAU" | b"UAC" => 'Y',
        b"CAU" | b"CAC" => 'H',
        b"CAA" | b"CAG" => 'Q',
        b"AAU" | b"AAC" => 'N',
        b"AAA" | b"AAG" => 'K',
        b"GAU" | b"GAC" => 'D',
        b"GAA" | b"GAG" => 'E',
        b"UGU" | b"UGC" => 'C',
        b"UGG" => 'W',
        b"CGU" | b"CGC" | b"CGA" | b"CGG" | b"AGA" | b"AGG" => 'R',
        b"GGU" | b"GGC" | b"GGA" | b"GGG" => 'G',
        _ => return None,
    };
    Some(letter)
}
```

- **`chunks_exact(3)`** splits the bytes into slices of exactly three. If one or two bases are left over at the end, they are skipped, which is the documented behaviour.
- **Byte string patterns.** Because `check_bases` has already guaranteed ASCII input, working with bytes is safe, and `b"UUU"` is a byte string literal that can be used directly as a pattern against a `&[u8]` slice. Grouping codons with `|` makes the table a readable copy of the standard genetic code: one line per amino acid.
- **`_ => return None`** covers the three stop codons. The `match` is used as an expression whose value is a `char`, so every other arm is just a letter, and the rare case leaves the function early.

And the tests:

```rust,ignore,file=src/protein.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exactly_three_of_the_64_codons_are_stops() {
        let bases = [b'A', b'C', b'G', b'U'];
        let mut stops = Vec::new();
        for first in bases {
            for second in bases {
                for third in bases {
                    let codon = [first, second, third];
                    if amino_acid(&codon).is_none() {
                        stops.push(String::from_utf8(codon.to_vec()).unwrap());
                    }
                }
            }
        }
        assert_eq!(stops, ["UAA", "UAG", "UGA"]);
    }

    #[test]
    fn stops_at_the_first_stop_codon() {
        assert_eq!(translate("AUGUGAUUU").unwrap(), "M");
    }

    #[test]
    fn empty_rna_gives_empty_protein() {
        assert_eq!(translate("").unwrap(), "");
    }

    #[test]
    fn dna_is_not_rna() {
        assert!(matches!(
            translate("AUGTTT"),
            Err(Error::InvalidBase {
                position: 4,
                found: 'T'
            })
        ));
    }
}
```

`exactly_three_of_the_64_codons_are_stops` is a safety net for the table. With 61 hand-typed codons, a typo is easy, and a typo would make that codon fall through to `_ => return None` and silently cut proteins short. The test builds all 64 possible codons and checks that exactly the three real stop codons are missing from the table.

Add the module to `src/lib.rs`, again private with a re-export:

```rust,ignore,file=src/lib.rs (step 6)
mod error;
pub mod fasta;
mod protein;
mod seq;

pub use error::Error;
pub use protein::translate;
pub use seq::{BaseCounts, count_bases, gc_content, hamming, reverse_complement, transcribe};
```

`cargo test` now runs 15 unit tests and 7 doc tests.

## Step 7: Solving Rosalind problems

This module connects the library to Rosalind: it takes a problem ID and the text of a dataset file, and returns the answer as a string in Rosalind's format. Create `src/rosalind.rs`:

```rust,ignore,file=src/rosalind.rs
//! Solve [Rosalind](https://rosalind.info) problems from their datasets.
//!
//! Each Rosalind problem has a short ID, such as `revc`. [`solve`] takes the
//! ID and the text of a downloaded dataset, and returns the answer in the
//! exact format Rosalind expects.

use crate::{
    Error, count_bases, fasta, gc_content, hamming, reverse_complement, transcribe, translate,
};

/// The problem IDs that [`solve`] understands.
pub const PROBLEMS: [&str; 6] = ["dna", "rna", "revc", "gc", "hamm", "prot"];

/// Solves one Rosalind problem.
///
/// `problem` is a problem ID from [`PROBLEMS`] (upper or lower case) and
/// `dataset` is the text of the dataset file. The answer has no trailing
/// newline.
///
/// # Errors
///
/// Returns [`Error::UnknownProblem`] for an ID not in [`PROBLEMS`], and
/// any error from the library functions if the dataset is not valid.
///
/// # Examples
///
/// ```
/// use dnakit::rosalind;
///
/// assert_eq!(rosalind::solve("dna", "GATTACA\n").unwrap(), "3 1 1 2");
/// assert_eq!(rosalind::solve("REVC", "AACG\n").unwrap(), "CGTT");
/// ```
pub fn solve(problem: &str, dataset: &str) -> Result<String, Error> {
    let text = dataset.trim();
    match problem.to_ascii_lowercase().as_str() {
        "dna" => {
            let counts = count_bases(text)?;
            Ok(format!(
                "{} {} {} {}",
                counts.a, counts.c, counts.g, counts.t
            ))
        }
        "rna" => transcribe(text),
        "revc" => reverse_complement(text),
        "gc" => highest_gc(text),
        "hamm" => {
            let (first, second) = two_lines(text)?;
            Ok(hamming(first, second)?.to_string())
        }
        "prot" => translate(text),
        _ => Err(Error::UnknownProblem(problem.to_string())),
    }
}

/// GC: the ID of the FASTA record with the highest GC content, then that
/// GC content on the next line.
fn highest_gc(dataset: &str) -> Result<String, Error> {
    let records = fasta::parse(dataset)?;
    let mut best: Option<(&str, f64)> = None;
    for record in &records {
        let gc = gc_content(&record.seq)?;
        match best {
            Some((_, top)) if top >= gc => {}
            _ => best = Some((&record.id, gc)),
        }
    }
    match best {
        Some((id, gc)) => Ok(format!("{id}\n{gc:.6}")),
        None => Err(Error::BadDataset("no FASTA records found".to_string())),
    }
}

/// Splits a dataset into exactly two non-empty lines.
fn two_lines(dataset: &str) -> Result<(&str, &str), Error> {
    let mut lines = dataset.lines().map(str::trim).filter(|l| !l.is_empty());
    match (lines.next(), lines.next(), lines.next()) {
        (Some(first), Some(second), None) => Ok((first, second)),
        _ => Err(Error::BadDataset("expected exactly two lines".to_string())),
    }
}
```

- **`PROBLEMS`** is a public constant listing the supported IDs, used in two places: the unknown-problem error message and the tool's usage message. It is an array of `&str` with its length in the type, `[&str; 6]`.
- **`solve`** trims the dataset once, because downloaded files end with a newline, and then chooses a branch with `match`. `to_ascii_lowercase` lets people type `REVC` as it appears on the website. Most arms are one line, because the library functions already return `Result<String, Error>`.
- **`highest_gc`** keeps the best record seen so far in an `Option<(&str, f64)>`. The `&str` borrows the ID from `records` instead of cloning it, which works because `records` lives until the end of the function. The match guard `if top >= gc` keeps the current best when a record ties with it, so the first of equal records wins. `{gc:.6}` prints six decimal places, like Rosalind's own answers.
- **`two_lines`** matches on a tuple of three `next()` calls: the dataset must have a first line, a second line, and *no* third one. Checking the shape of the input here gives a clear message instead of a confusing wrong answer.

Tests for the private helpers go at the bottom:

```rust,ignore,file=src/rosalind.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_listed_problem_is_known() {
        for problem in PROBLEMS {
            let result = solve(problem, "");
            assert!(
                !matches!(result, Err(Error::UnknownProblem(_))),
                "{problem} is listed but not handled"
            );
        }
    }

    #[test]
    fn unknown_problem() {
        assert!(matches!(
            solve("fib", "5 3"),
            Err(Error::UnknownProblem(name)) if name == "fib"
        ));
    }

    #[test]
    fn highest_gc_keeps_the_first_of_equal_records() {
        let dataset = ">a\nGGAA\n>b\nCCTT\n>c\nAAAT\n";
        assert_eq!(highest_gc(dataset).unwrap(), "a\n50.000000");
    }

    #[test]
    fn two_lines_ignores_blank_lines() {
        assert_eq!(two_lines("AC\n\nGT\n").unwrap(), ("AC", "GT"));
        assert!(two_lines("AC").is_err());
        assert!(two_lines("AC\nGT\nTT").is_err());
    }
}
```

`every_listed_problem_is_known` makes sure `PROBLEMS` and the `match` in `solve` never drift apart: if you list a problem but forget its arm, this test tells you. `unknown_problem` shows a match guard inside `matches!`, checking the name that was stored in the error.

Two more changes make the crate compile again. First, declare the module in `src/lib.rs`, below `mod protein;`. Like `fasta`, it is public, so users call `rosalind::solve(...)`:

```rust,ignore,file=src/lib.rs (step 7)
pub mod rosalind;
```

Second, `solve` returns `Error::UnknownProblem`, which doesn't exist yet. Add the variant to the `Error` enum in `src/error.rs`, below `BadDataset`:

```rust,ignore,file=src/error.rs (step 7)
    /// The command-line tool was asked to solve a problem it doesn't know.
    UnknownProblem(String),
```

Run `cargo build`, and the compiler points straight at the code that has to change (the start of the message is shown):

```text
error[E0004]: non-exhaustive patterns: `&error::Error::UnknownProblem(_)` not covered
  --> src/error.rs:43:15
   |
43 |         match self {
   |               ^^^^ pattern `&error::Error::UnknownProblem(_)` not covered
```

The `match` in `Display` must handle every variant, and `#[non_exhaustive]` doesn't change that inside the crate that defines the enum. That is a good thing: a new variant can never be left without a message. Add the missing arm below the `BadDataset` arm, and the import it needs at the top of the file, below `use std::io;`:

```rust,ignore,file=src/error.rs (step 7)
            Error::UnknownProblem(name) => {
                write!(f, "unknown problem {name:?} (try: {})", PROBLEMS.join(", "))
            }
```

```rust,ignore,file=src/error.rs (step 7)
use crate::rosalind::PROBLEMS;
```

The message lists the problems the tool does know, using the `PROBLEMS` constant, so it stays correct when you add more. `src/error.rs` is now finished.

### The finished crate root

All five modules exist, so the crate root can get its final form, with a front page that shows the library in action. Replace the contents of `src/lib.rs`:

```rust,ignore,file=src/lib.rs
//! Small, dependency-free tools for DNA, RNA and protein sequences.
//!
//! `dnakit` reads FASTA files, counts bases, measures GC content, transcribes
//! DNA into RNA, builds reverse complements and translates RNA into protein.
//! It ships as a library you can call from your own code and as a
//! command-line tool of the same name that solves
//! [Rosalind](https://rosalind.info) problems.
//!
//! # Examples
//!
//! ```
//! use dnakit::{fasta, gc_content, reverse_complement, transcribe, translate};
//!
//! # fn main() -> Result<(), dnakit::Error> {
//! let records = fasta::parse(">demo\nATGGC\nCTGAA\n")?;
//! let dna = &records[0].seq;
//! assert_eq!(dna, "ATGGCCTGAA");
//! assert_eq!(gc_content(dna)?, 50.0);
//! assert_eq!(reverse_complement(dna)?, "TTCAGGCCAT");
//! assert_eq!(translate(&transcribe(dna)?)?, "MA");
//! # Ok(())
//! # }
//! ```

#![warn(missing_docs)]

mod error;
pub mod fasta;
mod protein;
pub mod rosalind;
mod seq;

pub use error::Error;
pub use protein::translate;
pub use seq::{BaseCounts, count_bases, gc_content, hamming, reverse_complement, transcribe};
```

The file does four jobs:

- The `//!` comment is the front page of the documentation, now with an example that runs as a doc test. The lines starting with `# ` wrap the example in a hidden `fn main` that returns `Result`, so it can use `?`, exactly as in the documentation lesson.
- `#![warn(missing_docs)]` keeps reminding you about undocumented public items.
- `mod error;`, `mod protein;` and `mod seq;` declare private modules, and the `pub use` lines re-export their important items, so users write `dnakit::translate` and you can move code between files without breaking anyone.
- `pub mod fasta;` and `pub mod rosalind;` are public modules, whose vaguely named functions are used with the module name in front: `fasta::parse(...)`, `rosalind::solve(...)`.

Run the tests:

```console
$ cargo test
   Compiling dnakit v0.1.0 (/home/you/dnakit)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.50s
     Running unittests src/lib.rs (target/debug/deps/dnakit-7e80fe87409cfb57)

running 19 tests
test fasta::tests::empty_text_has_no_records ... ok
test fasta::tests::ignores_blank_lines_and_extra_spaces ... ok
test fasta::tests::joins_wrapped_lines ... ok
test fasta::tests::sequence_before_header_is_an_error ... ok
test protein::tests::dna_is_not_rna ... ok
test protein::tests::empty_rna_gives_empty_protein ... ok
test protein::tests::exactly_three_of_the_64_codons_are_stops ... ok
test protein::tests::stops_at_the_first_stop_codon ... ok
test rosalind::tests::every_listed_problem_is_known ... ok
test rosalind::tests::highest_gc_keeps_the_first_of_equal_records ... ok
test rosalind::tests::two_lines_ignores_blank_lines ... ok
test rosalind::tests::unknown_problem ... ok
test seq::tests::check_bases_reports_the_first_bad_character ... ok
test seq::tests::counts_every_base ... ok
test seq::tests::gc_content_of_empty_sequence_is_zero ... ok
test seq::tests::hamming_distance ... ok
test seq::tests::lowercase_is_not_a_base ... ok
test seq::tests::reverse_complement_twice_gives_the_original ... ok
test seq::tests::transcribe_only_changes_t ... ok

test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests dnakit

running 9 tests
test src/fasta.rs - fasta::parse (line 39) ... ok
test src/lib.rs - (line 11) ... ok
test src/protein.rs - protein::translate (line 18) ... ok
test src/rosalind.rs - rosalind::solve (line 27) ... ok
test src/seq.rs - seq::count_bases (line 39) ... ok
test src/seq.rs - seq::gc_content (line 65) ... ok
test src/seq.rs - seq::hamming (line 141) ... ok
test src/seq.rs - seq::reverse_complement (line 108) ... ok
test src/seq.rs - seq::transcribe (line 86) ... ok

test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

all doctests ran in 0.32s; merged doctests compilation took 0.31s
```

The doc tests are the examples you wrote in the `///` comments, compiled and run against the public API. Tests run in parallel, so the lines may come out in a different order for you.

## Step 8: The command-line tool

Create `src/main.rs`:

```rust,ignore,file=src/main.rs
use std::fs;
use std::process;

use dnakit::{Error, rosalind};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [problem, path] = args.as_slice() else {
        eprintln!("usage: dnakit <problem> <dataset-file>");
        eprintln!("problems: {}", rosalind::PROBLEMS.join(", "));
        process::exit(2);
    };

    match run(problem, path) {
        Ok(answer) => println!("{answer}"),
        Err(err) => {
            eprintln!("dnakit: {err}");
            process::exit(1);
        }
    }
}

fn run(problem: &str, path: &str) -> Result<String, Error> {
    let dataset = fs::read_to_string(path).map_err(|source| Error::Io {
        path: path.to_string(),
        source,
    })?;
    rosalind::solve(problem, &dataset)
}
```

The binary is deliberately thin:

- `args.as_slice()` gives a slice of the arguments, and `let [problem, path] = ... else { ... };` is a `let`-`else` with a *slice pattern*: it matches only if there are exactly two arguments, binding them to `problem` and `path`. For any other number, the `else` block prints the usage and exits. An `else` block must not continue normally, and `process::exit` never returns, so that rule is satisfied.
- Exit codes tell scripts what happened: 0 for success (the default), 1 for a failure while working, and 2 for a usage mistake, which is a common convention for command-line tools.
- `run` reads the file, wrapping any I/O failure in `Error::Io` with `map_err` to attach the file name, and hands the text to the library. Every error is printed in one place with `eprintln!`, which writes to standard error, so a redirected answer (`dnakit gc data.txt > answer.txt`) never contains an error message.
- Returning `Result` from `main` would also work, but it prints the `Debug` form of the error, which is less friendly than our `Display` message.

Notice the `use dnakit::{Error, rosalind};` line: the binary uses the library by its crate name, exactly as any other project would.

Try it on the example file from the top of this page, which you saved outside the package. The `--` separates Cargo's own options from the arguments for your program:

```console
$ cargo run -- gc ~/rosalind/rosalind_gc.txt
   Compiling dnakit v0.1.0 (/home/you/dnakit)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.24s
     Running `target/debug/dnakit gc /home/you/rosalind/rosalind_gc.txt`
Rosalind_6407
56.190476
```

## Step 9: Integration tests

Unit tests check the pieces from the inside. Integration tests use the crate from the outside, as a user would. Start with one test per problem, each using a small sample dataset, and one test that feeds in broken datasets. Create `tests/rosalind.rs`:

```rust,ignore,file=tests/rosalind.rs
use dnakit::rosalind::solve;

#[test]
fn dna_counts_bases() {
    let answer = solve("dna", "ATGCTTCAGAAAGGTCTTACG\n").unwrap();
    assert_eq!(answer, "6 4 5 6");
}

#[test]
fn rna_and_revc() {
    let dataset = "ATGCTTCAGAAAGGTCTTACG\n";
    assert_eq!(solve("rna", dataset).unwrap(), "AUGCUUCAGAAAGGUCUUACG");
    assert_eq!(solve("revc", dataset).unwrap(), "CGTAAGACCTTTCTGAAGCAT");
}

#[test]
fn gc_picks_the_highest_record() {
    let dataset = "\
>Rosalind_1111
CCTGCGGAAGATCGGCACTAGA
ATCCCACTAAT
>Rosalind_3333
GCCGCCCAGGGCAACGAATTATGGGCG
>Rosalind_2222
CCATCGGTAGCGCATCCTTAGTCCAATTA
AGTCCC
";
    assert_eq!(solve("gc", dataset).unwrap(), "Rosalind_3333\n66.666667");
}

#[test]
fn hamm_counts_differences() {
    let dataset = "ACCGTTAGCATTGA\nACTGTAAGCTTTGA\n";
    assert_eq!(solve("hamm", dataset).unwrap(), "3");
}

#[test]
fn prot_translates_until_the_stop_codon() {
    let dataset = "AUGAAACGUUGGCAUGAGUAA\n";
    assert_eq!(solve("prot", dataset).unwrap(), "MKRWHE");
}

#[test]
fn bad_datasets_give_errors_not_panics() {
    assert!(solve("dna", "ACGU").is_err());
    assert!(solve("gc", "ACGT\n>a\nAC").is_err());
    assert!(solve("hamm", "ACGT").is_err());
    assert!(solve("hamm", "ACGT\nAC").is_err());
    assert!(solve("frob", "ACGT").is_err());
}
```

These tests are the best habit you can take from Rosalind into your own work: before you download a real dataset, run your code on a small input whose answer you know. Here those inputs become permanent tests. The `"\` at the start of the GC dataset is a string continuation: a backslash at the end of a line skips the newline, so the text starts cleanly at the first `>`.

Then test the tool itself, the way you will use it on Rosalind. Create `tests/cli.rs`:

```rust,ignore,file=tests/cli.rs
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output};

/// Runs the compiled `dnakit` binary with the given arguments.
fn dnakit(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_dnakit"))
        .args(args)
        .output()
        .expect("failed to run dnakit")
}

/// Writes a dataset to a file in Cargo's scratch folder for tests.
fn dataset(name: &str, contents: &str) -> PathBuf {
    let path = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(name);
    fs::write(&path, contents).unwrap();
    path
}

#[test]
fn prints_the_answer_to_stdout() {
    let path = dataset("rosalind_revc.txt", "AACGT\n");
    let output = dnakit(&["revc", path.to_str().unwrap()]);
    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "ACGTT\n");
}

#[test]
fn wrong_arguments_print_usage() {
    let output = dnakit(&["revc"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).starts_with("usage: dnakit"));
}

#[test]
fn missing_file_is_an_error() {
    let output = dnakit(&["dna", "no-such-file.txt"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.starts_with("dnakit: cannot read no-such-file.txt"));
}
```

Cargo helps integration tests in two ways here:

- `env!("CARGO_BIN_EXE_dnakit")` is the path of the compiled `dnakit` binary. `env!` reads an environment variable at *compile* time, and Cargo sets this one for integration tests, building the binary first. `std::process::Command` runs it and `output()` collects its exit status, standard output and standard error.
- `env!("CARGO_TARGET_TMPDIR")` is a scratch folder inside `target/` where tests may write files, which is where `dataset` puts its input.

The three tests check the promises the tool makes: answers on standard output with a trailing newline, exit code 2 and a usage message for wrong arguments, exit code 1 and a readable message for a missing file.

## Step 10: Solve a real Rosalind problem

Install the tool so the `dnakit` command works in any folder:

```console
$ cargo install --path .
  Installing dnakit v0.1.0 (/home/you/dnakit)
    ...
   Installed package `dnakit v0.1.0 (/home/you/dnakit)` (executable `dnakit`)
```

`cargo install` builds in release mode and copies the binary into `~/.cargo/bin`, which `rustup` put on your `PATH`. Run it again after each change you make to the code.

Now log in to Rosalind, open the GC problem, and click **Download dataset**. The five-minute timer starts, but you only need a few seconds:

```console
$ dnakit gc ~/Downloads/rosalind_gc.txt
```

Paste the two lines of output into the answer box (or save them with `> answer.txt` and upload the file), and submit. Do the same for DNA, RNA, REVC, HAMM and PROT. You solved most of them in earlier lessons, but a problem can be tried again with a fresh dataset, and seeing the tool pass all six is a satisfying end-to-end check.

## Step 11: Documentation and polish

You have been writing doc comments all along, so the documentation is nearly done. Build it and read it as a stranger would:

```console
$ cargo doc --open
```

Check that the front page explains the crate, that every public item has a summary, that the `fasta` and `rosalind` modules have their own pages, and that the intra-doc links such as [`Error::InvalidBase`] work. Then polish:

```console
$ cargo fmt
$ cargo clippy --all-targets -- -D warnings
$ cargo test
```

All three should finish without complaints. `--all-targets` makes Clippy check the tests too. The reference implementation passes them, and also builds its docs without a single warning.

Next, write `README.md` in the package root. It is what people see on crates.io and on GitHub:

````markdown,file=README.md
# dnakit

Small, dependency-free tools for DNA, RNA and protein sequences: read FASTA
files, count bases, measure GC content, transcribe, reverse-complement and
translate. `dnakit` is both a Rust library and a command-line tool that
solves [Rosalind](https://rosalind.info) problems.

## Command-line tool

Install it with Cargo:

```console
$ cargo install dnakit
```

Then give it a Rosalind problem ID and a downloaded dataset file. The answer
is printed in the format Rosalind expects:

```console
$ dnakit revc rosalind_revc.txt
$ dnakit gc rosalind_gc.txt
```

Supported problems: `dna`, `rna`, `revc`, `gc`, `hamm` and `prot`.

## Library

Add it to your project with `cargo add dnakit`, then:

```rust
use dnakit::{fasta, gc_content, reverse_complement};

let records = fasta::parse(">demo\nATGGC\nCTGAA\n").unwrap();
let dna = &records[0].seq;
assert_eq!(gc_content(dna).unwrap(), 50.0);
assert_eq!(reverse_complement(dna).unwrap(), "TTCAGGCCAT");
```

Sequences must be uppercase. Functions return an error rather than panic
when they meet a character that is not a valid base.

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or
[MIT license](LICENSE-MIT) at your option.
````

Finally, add the license files `LICENSE-MIT` and `LICENSE-APACHE`. Copy the standard texts, for example from the reference implementation, and put your name in the MIT copyright line.

## Step 12: Package metadata

Fill in `Cargo.toml` with everything crates.io needs:

```toml,file=Cargo.toml
[package]
name = "dnakit"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "Read FASTA files and work with DNA, RNA and protein sequences, with a command-line tool for Rosalind problems."
license = "MIT OR Apache-2.0"
repository = "https://github.com/your-name/dnakit"
readme = "README.md"
keywords = ["bioinformatics", "dna", "fasta", "rosalind"]
categories = ["science", "command-line-utilities"]

[dependencies]
```

`[dependencies]` is empty: `dnakit` uses only the standard library, which means fast builds and nothing for users to audit. (The Cargo lesson showed that adding `bio` for its FASTA reader brings in over ninety crates.) The `keywords` and `categories` help people find the crate; categories must come from the official list on crates.io. Replace `your-name` in `repository` with your own GitHub account once you have pushed the code.

Cargo packages the files that git tracks, and it refuses to package changes you haven't committed yet, so that what you publish always matches a commit. Make the first commit now:

```console
$ git add .
$ git commit -m "First version of dnakit"
```

(If git asks who you are, tell it once with `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then run the commit again.) Now check what would be uploaded:

```console
$ cargo package --list
.cargo_vcs_info.json
.gitignore
Cargo.lock
Cargo.toml
Cargo.toml.orig
LICENSE-APACHE
LICENSE-MIT
README.md
src/error.rs
src/fasta.rs
src/lib.rs
src/main.rs
src/protein.rs
src/rosalind.rs
src/seq.rs
tests/cli.rs
tests/rosalind.rs
```

`.cargo_vcs_info.json` records which commit the package was made from, and `Cargo.toml.orig` is your manifest exactly as you wrote it (Cargo uploads a tidied-up copy as `Cargo.toml`). If a file you don't want to publish shows up here, such as a dataset, move it out of the package folder, commit, and check again.

## Step 13: Publish it, or keep it private

You now have a complete, publishable crate. You have two options.

**Publish it.** The name `dnakit` might well be taken by the time you read this, perhaps by another learner. Pick a free name, for example `dnakit-yourname`, and change `name` in `Cargo.toml`. The library's crate name changes with it, so update the `use dnakit::...` lines in `main.rs`, the tests and the doc comments (`dnakit-yourname` becomes `dnakit_yourname` in code). In `tests/cli.rs`, the binary becomes `CARGO_BIN_EXE_dnakit-yourname`, with the hyphen, because that one is a file name rather than a crate name. Then follow the publishing lesson:

```console
$ cargo test
$ git add . && git commit -m "Release 0.1.0"
$ cargo publish --dry-run
$ cargo publish
```

A few minutes later, your documentation appears on docs.rs, and anyone can install your tool with `cargo install dnakit-yourname`.

**Keep it private.** If you would rather not publish, add `publish = false` to `[package]` so it can't happen by accident. You can still use the library from your other projects by path or from Git:

```toml
[dependencies]
dnakit = { path = "../dnakit" }
# or, once it is on GitHub:
# dnakit = { git = "https://github.com/your-name/dnakit" }
```

and you can install the command-line tool from your own folder with `cargo install --path .`, as in step 10.

## Compare with the reference

The course repository contains the finished project in `capstone/dnakit/`. Its source files are identical to the finished files on this page, and it passes `cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` and `cargo doc`. If your version behaves differently, run both on the same dataset and compare, or diff the files. Small differences in wording or style are fine; the tests (and Rosalind) are the real judge.

:::rosalind SUBS Add a subs command
A *motif* is a short stretch of DNA that means something, such as a place where a protein binds. The SUBS problem gives you two lines: a DNA string `s` and a shorter motif `t`. The answer is every position where `t` occurs in `s`, counting from 1 and separated by spaces. Occurrences may overlap: in `ATATAT`, the motif `ATA` occurs at 1 and at 3.

Extend `dnakit` so that `dnakit subs rosalind_subs.txt` works:

1. Add `pub fn find_motif(seq: &str, motif: &str) -> Vec<usize>` to `src/seq.rs`, with docs and a doc test, and re-export it from `lib.rs`. Decide what an empty motif should return.
2. Add `"subs"` to `PROBLEMS` and an arm to `solve`. The `two_lines` helper already reads this dataset's shape.
3. Add an integration test. With this dataset:

```text
CGTACGTACGTAC
GTACG
```

the answer is:

```text
2 6
```

`every_listed_problem_is_known` will remind you if you add the name to `PROBLEMS` but forget the arm.
:::solution
In `src/seq.rs`, above the tests module:

```rust,ignore,file=src/seq.rs
/// Finds every position where `motif` occurs in `seq`, counting from 1.
/// Overlapping occurrences all count. An empty motif is found nowhere.
///
/// # Examples
///
/// ```
/// use dnakit::find_motif;
///
/// assert_eq!(find_motif("TTATATAG", "ATA"), vec![3, 5]);
/// assert!(find_motif("GATTACA", "GG").is_empty());
/// ```
pub fn find_motif(seq: &str, motif: &str) -> Vec<usize> {
    if motif.is_empty() {
        return Vec::new();
    }
    seq.as_bytes()
        .windows(motif.len())
        .enumerate()
        .filter(|(_, window)| *window == motif.as_bytes())
        .map(|(index, _)| index + 1)
        .collect()
}
```

`windows(n)` yields every run of `n` neighbouring bytes, one starting at each position, so overlapping matches are found naturally. (`str::match_indices` would skip overlaps, which is the classic mistake in this problem.) `windows(0)` panics, which is one more reason to handle the empty motif first.

In `src/lib.rs`, add `find_motif` to the re-exports:

```rust,ignore,file=src/lib.rs
pub use seq::{
    BaseCounts, count_bases, find_motif, gc_content, hamming, reverse_complement, transcribe,
};
```

In `src/rosalind.rs`, import `find_motif` in the `use crate::{...}` line, then change `PROBLEMS` (the length in the type changes too) and add the arm:

```rust,ignore,file=src/rosalind.rs
pub const PROBLEMS: [&str; 7] = ["dna", "rna", "revc", "gc", "hamm", "prot", "subs"];
```

```rust,ignore,file=src/rosalind.rs
        "subs" => {
            let (seq, motif) = two_lines(text)?;
            let positions: Vec<String> = find_motif(seq, motif)
                .iter()
                .map(|position| position.to_string())
                .collect();
            Ok(positions.join(" "))
        }
```

And in `tests/rosalind.rs`:

```rust,ignore,file=tests/rosalind.rs
#[test]
fn subs_finds_overlapping_motifs() {
    let dataset = "CGTACGTACGTAC\nGTACG\n";
    assert_eq!(solve("subs", dataset).unwrap(), "2 6");
}
```

Run `cargo test`, then `cargo install --path .` and try it on a real SUBS dataset.
:::

:::rosalind CONS Add a cons command
Given several DNA strings of the same length (in FASTA format), the *profile* counts, for each position, how many of the strings have `A`, `C`, `G` or `T` there. The *consensus string* takes the most common base at each position: it is a kind of average of the strings. Rosalind wants the consensus on the first line, then four lines of counts starting with `A:`, `C:`, `G:` and `T:`, the numbers separated by spaces. If two bases tie for most common, either is accepted.

Add a `cons` command. Reject records of different lengths with `Error::LengthMismatch`, and invalid characters with `Error::InvalidBase`. For this dataset:

```text
>s1
ATCCA
>s2
GTCAA
>s3
ATGCT
```

the answer is:

```text
ATCCA
A: 2 0 0 1 2
C: 0 0 2 2 0
G: 1 0 1 0 0
T: 0 3 0 0 1
```

Hint: for each position, collect the bases in that column into a `String` and let `count_bases` count them.
:::solution
Add a private function to `src/rosalind.rs`, next to `highest_gc`:

```rust,ignore,file=src/rosalind.rs
/// CONS: the consensus string, then one line of counts per base.
fn consensus(dataset: &str) -> Result<String, Error> {
    let records = fasta::parse(dataset)?;
    let Some(first) = records.first() else {
        return Err(Error::BadDataset("no FASTA records found".to_string()));
    };
    let length = first.seq.len();
    for record in &records {
        check_bases(&record.seq, "ACGT")?;
        if record.seq.len() != length {
            return Err(Error::LengthMismatch {
                first: length,
                second: record.seq.len(),
            });
        }
    }

    let mut consensus = String::new();
    let mut rows = ["A:", "C:", "G:", "T:"].map(String::from);
    for i in 0..length {
        let column: String = records
            .iter()
            .map(|r| r.seq.as_bytes()[i] as char)
            .collect();
        let counts = count_bases(&column)?;
        let per_base = [
            ('A', counts.a),
            ('C', counts.c),
            ('G', counts.g),
            ('T', counts.t),
        ];
        for (row, (_, count)) in rows.iter_mut().zip(per_base) {
            row.push_str(&format!(" {count}"));
        }
        let (base, _) = per_base.iter().max_by_key(|(_, count)| *count).unwrap();
        consensus.push(*base);
    }
    Ok(format!("{consensus}\n{}", rows.join("\n")))
}
```

It needs one more import at the top of the file, `use crate::seq::check_bases;`, which works because `check_bases` is `pub(crate)`. Then add `"cons"` to `PROBLEMS` and one arm to `solve`:

```rust,ignore,file=src/rosalind.rs
        "cons" => consensus(text),
```

How it works: the first loop checks every record before any counting starts, so the indexing later can't go out of bounds. Then, column by column, the bases are gathered into a small string and counted by the existing `count_bases`. `rows` starts as the four labels and grows by one number per column. `max_by_key` picks a base with the highest count (on a tie it returns the last one, which Rosalind accepts). Finally the consensus and the rows are joined with newlines.

A test for `tests/rosalind.rs`:

```rust,ignore,file=tests/rosalind.rs
#[test]
fn cons_builds_consensus_and_profile() {
    let dataset = ">s1\nATCCA\n>s2\nGTCAA\n>s3\nATGCT\n";
    let expected = "ATCCA\nA: 2 0 0 1 2\nC: 0 0 2 2 0\nG: 1 0 1 0 0\nT: 0 3 0 0 1";
    assert_eq!(solve("cons", dataset).unwrap(), expected);
}
```
:::

:::exercise Break it on purpose
Tests are only useful if they fail when the code is wrong. Make each of these changes one at a time, run `cargo test --no-fail-fast`, note which tests fail, and then undo the change. (Plain `cargo test` stops after the first group of tests with a failure; `--no-fail-fast` runs them all.)

1. In `reverse_complement`, remove `.rev()`.
2. In `check_bases`, change `position: index + 1` to `position: index`.
3. In `solve`, change `let text = dataset.trim();` to `let text = dataset;`.
:::solution
1. Five tests fail: the doc tests on the crate root, on `reverse_complement` and on `solve`, the integration test `rna_and_revc`, and `prints_the_answer_to_stdout` in `tests/cli.rs`. The interesting one is the test that *passes*: `reverse_complement_twice_gives_the_original` still holds, because complementing twice gives back the original even without reversing. A property test is a useful net, but it doesn't replace checking real examples.
2. `check_bases_reports_the_first_bad_character` and `dna_is_not_rna` fail. Off-by-one mistakes in positions are easy to make, which is why the tests check exact positions rather than just "is an error".
3. `dna_counts_bases`, `rna_and_revc` and `prot_translates_until_the_stop_codon` fail, along with the doc test on `solve` and `prints_the_answer_to_stdout`: the newline at the end of every dataset is now reported as an invalid base. `gc` and `hamm` still pass because they split the text into lines themselves. This is exactly the bug that bites Rosalind solutions on the real dataset file after working on a pasted sample.
:::

## Stretch goals

Once the reference version works, make it yours. Some ideas, roughly from easiest to hardest:

- Accept lowercase sequences by converting the input to uppercase in one place.
- Add more problems you solved in earlier lessons: `prtm` (protein mass), `mrna`, `tran` (transitions and transversions) or `grph` (overlap graphs).
- Add `splc`: remove introns from a gene with `str::replace`, then `transcribe` and `translate`. All the parts are already in the library.
- Add `orf`: find every protein that can be read from an open reading frame, starting at `AUG` and ending at a stop codon, on both strands. You will need `reverse_complement`, `transcribe` and a variant of `translate`, and a `BTreeSet` to keep each protein once.
- Read the dataset from standard input when the file name is `-`, so `cat data.txt | dnakit gc -` works.
- Replace the hand-written argument parsing with the popular `clap` crate (use its `derive` feature), and add `--help`.
- Publish version `0.2.0` with your improvements, and decide whether any of your changes are breaking.

```quiz
? Why does `solve` live in the library (`src/rosalind.rs`) rather than in `src/main.rs`?
- Cargo does not allow `match` expressions in `main.rs`.
+ Code in the library can be reached by integration tests and by other programs; `main.rs` stays a thin wrapper.
- Functions in `main.rs` can't return `Result`.
- It makes the binary smaller.
= Integration tests in `tests/` can only import the library crate. Keeping the logic there makes it testable and reusable.

? `check_bases` is declared `pub(crate)`. What does that mean?
- Only `lib.rs` can call it.
- Anyone can call it, but it is hidden from the docs.
+ Any module in the dnakit crate can call it, but users of the crate cannot.
- It is only compiled when testing.
= `pub(crate)` makes an item visible throughout its own crate, so `protein.rs` can share the check without it becoming part of the public API.

? The `Error` enum is marked `#[non_exhaustive]`. What does that allow you to do later?
+ Add a new variant without it being a breaking change.
- Remove variants without anyone noticing.
- Skip implementing `Display` for some variants.
- Use `Error` without importing it.
= Code outside the crate must include a `_ =>` arm when matching on the enum, so a new variant can't break it.

? What does `solve` do with the newline at the end of a downloaded dataset file?
- It reports an invalid base.
- Nothing: `str` methods ignore newlines automatically.
+ It calls `trim` once at the start, so no problem ever sees the trailing newline.
- `fs::read_to_string` removes it.
= `fs::read_to_string` returns the file exactly as it is, including the final newline. Trimming once in `solve` protects every problem.
```
