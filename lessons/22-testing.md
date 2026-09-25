---
title: Testing
module: Building a package
summary: Write unit and integration tests with Rust's built-in test framework, run them with cargo test, and let tests drive your design.
minutes: 40
---

The compiler catches a lot, but it can't tell whether your function computes the *right* answer. Tests can. Rust has a test framework built into the language and Cargo, so there is nothing to install: you write functions marked `#[test]`, and `cargo test` finds and runs them.

For a library you plan to publish, tests matter twice over. They prove your code works today, and they tell you immediately when a later change breaks something your users rely on. Rosalind has been training you for this all along: every problem page shows a small sample dataset with its answer, and checking your program against it before downloading the real dataset *is* a test. This lesson shows how to keep those checks in your code, so they run every time.

## Your first test

A test is an ordinary function with the `#[test]` attribute above it. It passes if it returns normally and fails if it panics. The assertion macros panic for you when something is wrong:

```rust
fn count_g(dna: &str) -> usize {
    dna.chars().filter(|&base| base == 'G').count()
}

#[test]
fn counts_every_g() {
    assert_eq!(count_g("GATTACAGG"), 3);
}

#[test]
fn sequences_without_g() {
    assert_eq!(count_g("ATTA"), 0);
    assert_ne!(count_g("G"), 0);
    assert!(count_g("") == 0);
}
```

```console
$ cargo test
   Compiling seqtools v0.1.0 (/home/you/seqtools)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.41s
     Running unittests src/lib.rs (target/debug/deps/seqtools-1c2e6a3b1f0a8d4e)

running 2 tests
test counts_every_g ... ok
test sequences_without_g ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests seqtools

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

| Macro | Passes when |
| --- | --- |
| `assert!(cond)` | `cond` is `true` |
| `assert_eq!(left, right)` | `left == right` |
| `assert_ne!(left, right)` | `left != right` |

Prefer `assert_eq!` over `assert!(a == b)`. When it fails, it prints both values, which usually tells you what went wrong without any extra digging. To compare values this way, their type must implement `PartialEq` and `Debug`, which is one more reason to `#[derive(Debug, PartialEq)]` on your own types.

## When a test fails

Here is a buggy reverse complement (the REVC problem) and a test that catches it. Every assertion macro also accepts a custom message with `format!`-style arguments, printed when the assertion fails:

```rust,should_panic
fn reverse_complement(dna: &str) -> String {
    dna.chars()
        .map(|base| match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            other => other,
        })
        .collect() // bug: forgot to reverse!
}

#[test]
fn reverse_complement_of_a_short_strand() {
    let dna = "AACCGT";
    assert_eq!(reverse_complement(dna), "ACGGTT", "reverse complement of {dna}");
}
```

```text
running 1 test
test reverse_complement_of_a_short_strand ... FAILED

failures:

---- reverse_complement_of_a_short_strand stdout ----

thread 'reverse_complement_of_a_short_strand' panicked at src/lib.rs:16:5:
assertion `left == right` failed: reverse complement of AACCGT
  left: "TTGGCA"
 right: "ACGGTT"
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    reverse_complement_of_a_short_strand

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

You get the test name, the file and line, your message, and both values. Here, `left` is the complement of `AACCGT` but not reversed, which points straight at the bug. Good test names such as `reverse_complement_of_a_short_strand` help too: the list of failures reads like a list of broken behaviours.

## The tests module

In a real project, unit tests live in the same file as the code they test, inside a module at the bottom:

```rust,file=src/lib.rs
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

pub fn solve_revc(dataset: &str) -> String {
    reverse_complement(dataset.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn complement_pairs_bases() {
        assert_eq!(complement('A'), 'T');
        assert_eq!(complement('G'), 'C');
    }

    #[test]
    fn reverses_and_complements() {
        assert_eq!(reverse_complement("AACCGT"), "ACGGTT");
    }

    #[test]
    fn sample_dataset() {
        assert_eq!(solve_revc("GTCAAAGC\n"), "GCTTTGAC");
    }
}
```

Two lines deserve an explanation:

- `#[cfg(test)]` means "only compile this when testing". The tests module is left out of normal builds entirely, so it adds nothing to your library or program.
- `use super::*;` brings everything from the parent module (the code under test) into the tests module. Remember from the modules lesson that a child module can see its parent's private items, so `complement` can be tested even though it isn't `pub`.

Look at `sample_dataset`. It calls `solve_revc`, the function that takes the text of a dataset file, with a small sample that ends in a newline, just like a downloaded file does. Splitting a Rosalind solution into "parse the dataset" and "compute the answer" functions like this makes both easy to test without touching the file system.

## Testing for panics

Sometimes the correct behaviour *is* to panic, for example when a caller breaks a documented rule. Mark such a test with `#[should_panic]`. Adding `expected` checks that the panic message contains a given piece of text, so the test doesn't pass by accident because of some other panic, such as an out-of-range slice. Here, asking for a codon past the end of an RNA string is a bug in the caller:

```rust
/// Returns codon number `n` (counting from 0) of an RNA string.
pub fn nth_codon(rna: &str, n: usize) -> &str {
    let start = n * 3;
    assert!(start + 3 <= rna.len(), "codon {n} is past the end of the RNA");
    &rna[start..start + 3]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_and_last_codon() {
        assert_eq!(nth_codon("AUGGCCUAA", 0), "AUG");
        assert_eq!(nth_codon("AUGGCCUAA", 2), "UAA");
    }

    #[test]
    #[should_panic(expected = "past the end")]
    fn codon_past_the_end() {
        nth_codon("AUGGCC", 2);
    }
}
```

## Tests that return Result

A test can also return `Result<(), E>`. It fails if it returns `Err`. That lets you use `?` instead of calling `unwrap` on every step. Here is the parsing half of a solution to FIB, whose dataset is two numbers on one line:

```rust
use std::num::ParseIntError;

/// Parses the FIB dataset, two numbers such as "6 2".
fn parse_fib_input(dataset: &str) -> Result<(u64, u64), ParseIntError> {
    let text = dataset.trim();
    let (n, k) = text.split_once(' ').unwrap_or((text, ""));
    Ok((n.parse()?, k.trim().parse()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_n_and_k() -> Result<(), ParseIntError> {
        let (n, k) = parse_fib_input("6 2\n")?;
        assert_eq!((n, k), (6, 2));
        Ok(())
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_fib_input("6 x").is_err());
        assert!(parse_fib_input("6").is_err());
    }
}
```

To check that something *is* an error, don't use `?`. Assert on the result instead, as `rejects_garbage` does.

## Running tests

`cargo test` compiles your crate in test mode and runs every test in parallel. A few options cover most needs:

| Command | What it does |
| --- | --- |
| `cargo test` | Run all tests. |
| `cargo test codon` | Run only tests whose name contains `codon`. |
| `cargo test tests::codon_past_the_end` | Run one specific test by its path. |
| `cargo test -- --nocapture` | Show `println!` output from passing tests too. |
| `cargo test -- --test-threads=1` | Run tests one at a time. |
| `cargo test -- --ignored` | Run only tests marked `#[ignore]` (for slow ones). |

The `--` separates options for Cargo from options for the test program itself. Output capture is worth knowing about: by default the test runner hides anything a *passing* test prints, to keep the report tidy. Failing tests show their output. `--nocapture` turns that off when you are debugging.

## Integration tests

Unit tests check pieces from the inside. **Integration tests** check your library from the outside, exactly the way a user would: through its public API only. They live in a `tests/` folder next to `src/`:

```text
seqtools/
├── Cargo.toml
├── src/
│   └── lib.rs
└── tests/
    └── samples.rs
```

```rust,ignore,file=tests/samples.rs
use seqtools::{reverse_complement, solve_revc};

#[test]
fn dataset_with_windows_line_ending() {
    assert_eq!(solve_revc("GTCAAAGC\r\n"), "GCTTTGAC");
}

#[test]
fn reverse_complement_twice_gives_the_original() {
    let dna = "ATGCCGTAAG";
    assert_eq!(reverse_complement(&reverse_complement(dna)), dna);
}
```

The second test checks a *property* rather than one example: doing the reverse complement twice must give back the original strand, whatever the strand is. Each file in `tests/` is compiled as a separate crate that depends on your library, so it imports items by the crate name and can only see `pub` items (`complement` is out of reach here). There is no need for `#[cfg(test)]` there, because Cargo only builds that folder when testing. To share helper code between integration test files, put it in `tests/common/mod.rs` and add `mod common;` to the files that need it (the `mod.rs` form stops Cargo from treating the helpers as a test file of their own).

Integration tests need a *library* crate to import. A package that only has `src/main.rs` can't be tested this way, which is one more reason to put your logic in `lib.rs` and keep `main.rs` thin.

`cargo test` runs the sections one after another: unit tests, then each integration test file, then doc tests. Use `cargo test --test samples` to run a single integration test file.

## A first look at doc tests

The last section of `cargo test` output is `Doc-tests`. Code examples you write in documentation comments are compiled and run as tests too, so your examples can never silently go out of date. That is the topic of the next lesson.

## Letting tests lead

A useful habit is **test-driven development**: write a test for the behaviour you want, watch it fail, then write just enough code to make it pass. Writing the test first forces you to decide how the function should be *called* before you worry about how it works.

Take the SUBS problem: find every position where a short DNA *motif* `t` occurs in a longer string `s`, counting from 1, as a list of numbers. Start with the rules as tests, and a function body that you know is wrong:

```rust,should_panic
pub fn find_motif(s: &str, t: &str) -> Vec<usize> {
    todo!()
}

#[test]
fn finds_every_position() {
    assert_eq!(find_motif("ACGTACGT", "CG"), vec![2, 6]);
}

#[test]
fn motif_not_present() {
    assert!(find_motif("AAAA", "G").is_empty());
}
```

`todo!()` compiles, so you can run the tests right away, and they fail with `not yet implemented`. A first attempt using the standard library's `str::match_indices`, which finds every match of a pattern, turns both green:

```rust,ignore
pub fn find_motif(s: &str, t: &str) -> Vec<usize> {
    s.match_indices(t).map(|(index, _)| index + 1).collect()
}
```

Then think about the tricky cases and add a test for each. Motifs can *overlap*: in `AAAA`, the motif `AA` starts at positions 1, 2 and 3. That test fails:

```text
---- overlapping_matches_count stdout ----

thread 'overlapping_matches_count' panicked at src/lib.rs:17:5:
assertion `left == right` failed
  left: [1, 3]
 right: [1, 2, 3]
```

`match_indices` continues searching *after* each match, so it never finds overlapping ones. This is exactly the bug that makes a SUBS answer wrong on the real dataset while looking fine on a simple example. Rewrite the function to check every starting position, with `windows`, which yields every run of `t.len()` neighbouring bytes, and keep adding edge cases until you run out of ideas:

```rust
pub fn find_motif(s: &str, t: &str) -> Vec<usize> {
    if t.is_empty() {
        return Vec::new();
    }
    s.as_bytes()
        .windows(t.len())
        .enumerate()
        .filter(|(_, window)| *window == t.as_bytes())
        .map(|(index, _)| index + 1)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_every_position() {
        assert_eq!(find_motif("ACGTACGT", "CG"), vec![2, 6]);
    }

    #[test]
    fn motif_not_present() {
        assert!(find_motif("AAAA", "G").is_empty());
    }

    #[test]
    fn overlapping_matches_count() {
        assert_eq!(find_motif("AAAA", "AA"), vec![1, 2, 3]);
    }

    #[test]
    fn motif_at_the_very_end() {
        assert_eq!(find_motif("GGACT", "ACT"), vec![3]);
    }

    #[test]
    fn motif_longer_than_sequence() {
        assert!(find_motif("AC", "ACGT").is_empty());
    }

    #[test]
    fn empty_motif_is_found_nowhere() {
        assert!(find_motif("ACGT", "").is_empty());
    }
}
```

The tests now document the rules better than a comment could, and they will catch anyone who later "simplifies" the function back to `match_indices`. The empty-motif test earned its place too: `windows(0)` panics, so without the `is_empty` check this version would crash on an empty motif.

:::tip What to test
Test the behaviour your users rely on, not every line. Good candidates: the sample from the problem page, edge cases (empty input, a trailing newline, the largest value the problem allows), and every error your function can return. When you fix a bug, first write a test that reproduces it, so it can never come back unnoticed.
:::

:::rosalind HAMM Counting Point Mutations, with tests
When DNA is copied, mistakes occasionally happen: one base is replaced by another, a *point mutation*. Comparing two DNA strings of the same length position by position and counting where they differ gives their *Hamming distance*, a simple measure of how far apart they have drifted. The dataset has two DNA strings of equal length, one per line; the answer is a single number.

You solved this problem in the slices lesson. Here is a working solution; your job is to add a `tests` module that checks it: the sample dataset, two identical strings (including two empty ones), two strings that differ everywhere, a dataset with Windows line endings (`\r\n`) and a blank last line, and a `#[should_panic]` test for strings of different lengths.

```rust
use std::error::Error;

const SAMPLE: &str = "GATTACAGT\nGACTATAGC\n";

pub fn hamming(a: &str, b: &str) -> usize {
    assert_eq!(a.len(), b.len(), "sequences must have the same length");
    a.chars().zip(b.chars()).filter(|(x, y)| x != y).count()
}

pub fn solve_hamm(dataset: &str) -> String {
    let mut lines = dataset.lines();
    let a = lines.next().unwrap_or("").trim();
    let b = lines.next().unwrap_or("").trim();
    hamming(a, b).to_string()
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    println!("{}", solve_hamm(&input));
    Ok(())
}
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "GATTACAGT\nGACTATAGC\n";

pub fn hamming(a: &str, b: &str) -> usize {
    assert_eq!(a.len(), b.len(), "sequences must have the same length");
    a.chars().zip(b.chars()).filter(|(x, y)| x != y).count()
}

pub fn solve_hamm(dataset: &str) -> String {
    let mut lines = dataset.lines();
    let a = lines.next().unwrap_or("").trim();
    let b = lines.next().unwrap_or("").trim();
    hamming(a, b).to_string()
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    println!("{}", solve_hamm(&input));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_dataset() {
        assert_eq!(solve_hamm(SAMPLE), "3");
    }

    #[test]
    fn identical_strands_have_distance_zero() {
        assert_eq!(hamming("ACGT", "ACGT"), 0);
        assert_eq!(hamming("", ""), 0);
    }

    #[test]
    fn every_position_different() {
        assert_eq!(hamming("AAAA", "TTTT"), 4);
    }

    #[test]
    fn windows_line_endings_and_blank_last_line() {
        assert_eq!(solve_hamm("AC\r\nAG\r\n\r\n"), "1");
    }

    #[test]
    #[should_panic(expected = "same length")]
    fn different_lengths_panic() {
        hamming("ACGT", "ACG");
    }
}
```

```console
$ cargo test
...
running 5 tests
test tests::every_position_different ... ok
test tests::sample_dataset ... ok
test tests::windows_line_endings_and_blank_last_line ... ok
test tests::identical_strands_have_distance_zero ... ok
test tests::different_lengths_panic - should panic ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.13s
```

Once the tests pass, `cargo run -- rosalind_hamm.txt` gives you the real answer. `sample_dataset` reuses the `SAMPLE` constant, so the program's built-in sample and the test can never disagree. The tests call `solve_hamm` as well as `hamming`, because the dataset handling (reading two lines, trimming them) is where Rosalind solutions most often go wrong.
:::

:::rosalind FIB Rabbits and Recurrence Relations, test first
Fibonacci's famous puzzle models a rabbit population: you start with one pair of newborn rabbits; a pair needs one month to mature, and from then on every mature pair produces a new pair each month; rabbits never die. The FIB problem generalises it: each mature pair produces `k` new pairs a month. The dataset is two numbers `n` and `k` (with `n` up to 40 and `k` up to 5) and the answer is the number of rabbit pairs after `n` months.

The numbers follow a *recurrence relation*: month 1 and month 2 both have 1 pair, and after that, the pairs in month `n` are last month's pairs (rabbits never die) plus `k` new pairs for every pair that existed two months ago (those are the mature ones): F(n) = F(n-1) + k * F(n-2).

You solved this in the functions lesson. This time, work test first: write `fn rabbits(n: u64, k: u64) -> u64` with `todo!()` as its body, and tests for: the first two months, the sample below, `k = 1` (which gives the ordinary Fibonacci numbers, so month 10 has 55 pairs), the largest input `rabbits(40, 5)` to make sure it doesn't overflow, and a `#[should_panic]` test for month 0, which doesn't exist. Then implement it and make them pass. With the dataset `6 2` the answer is:

```text
21
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "6 2\n";

/// Rabbit pairs alive after `n` months, if every mature pair produces
/// `k` new pairs each month.
pub fn rabbits(n: u64, k: u64) -> u64 {
    assert!(n >= 1, "months are counted from 1");
    let (mut previous, mut current) = (1, 1);
    for _ in 2..n {
        (previous, current) = (current, current + k * previous);
    }
    current
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let mut numbers = input.split_whitespace();
    let n: u64 = numbers.next().ok_or("missing n")?.parse()?;
    let k: u64 = numbers.next().ok_or("missing k")?.parse()?;
    println!("{}", rabbits(n, k));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_two_months_have_one_pair() {
        assert_eq!(rabbits(1, 3), 1);
        assert_eq!(rabbits(2, 3), 1);
    }

    #[test]
    fn sample() {
        assert_eq!(rabbits(6, 2), 21);
    }

    #[test]
    fn one_new_pair_gives_fibonacci() {
        assert_eq!(rabbits(10, 1), 55);
    }

    #[test]
    fn largest_input_does_not_overflow() {
        assert_eq!(rabbits(40, 5), 148_277_527_396_903_091);
    }

    #[test]
    #[should_panic(expected = "counted from 1")]
    fn month_zero_panics() {
        rabbits(0, 1);
    }
}
```

```console
$ cargo run
21
$ cargo test
...
running 5 tests
test tests::one_new_pair_gives_fibonacci ... ok
test tests::sample ... ok
test tests::first_two_months_have_one_pair ... ok
test tests::largest_input_does_not_overflow ... ok
test tests::month_zero_panics - should panic ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s
```

The loop keeps only the last two months, and `(previous, current) = (current, current + k * previous);` updates both at once, so the old `previous` is used before it is replaced. The expected value in `largest_input_does_not_overflow` came from running the finished function once and checking that it is plausible; its real job is to catch an overflow panic, which a debug build would report if `u64` were too small (`u32` is, for these limits).
:::

```quiz
? What does `#[cfg(test)]` on a `mod tests` block do?
- Marks every function in the module as a test.
+ Compiles the module only when running tests, leaving it out of normal builds.
- Makes the module's functions public.
- Runs the tests in a separate thread.
= `cfg(test)` is conditional compilation: the code only exists when the crate is built by `cargo test`.

? A test panics. What is the result?
+ The test fails, unless it is marked `#[should_panic]` and the message matches.
- All remaining tests are skipped.
- The test is reported as ignored.
- The whole `cargo test` run crashes without a report.
= Each test runs in its own thread, so one panic fails only that test.

? Where do integration tests go, and what can they access?
- In `src/tests.rs`, with access to private functions.
- Inside `mod tests` in `main.rs`.
+ In the `tests/` folder, with access to the library's public API only.
- In `Cargo.toml` under `[tests]`.
= Each file in `tests/` is a separate crate that uses your library like any other user would.

? Why doesn't `println!` output appear when you run `cargo test`?
- Tests can't print.
- It is written to a log file in `target/`.
+ The test runner captures the output of passing tests; use `cargo test -- --nocapture` to see it.
- Only `eprintln!` works in tests.
= Capturing keeps the report readable. The output of failing tests is shown automatically.
```
