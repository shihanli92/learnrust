---
title: Error Handling
module: Handling failure
summary: Tell apart bugs from expected failures, and handle the latter with Result, match and the ? operator.
minutes: 45
---

Things go wrong. Files are missing, users type "twelve" where you asked for a number, networks drop. Many languages handle this with exceptions, which can fly out of almost any function call without warning. Rust takes a different approach: it splits errors into two kinds and makes both visible.

- **Unrecoverable errors** are bugs: an index past the end of an array, a situation your code assumed could never happen. Rust stops the program with a **panic**.
- **Recoverable errors** are situations a correct program should expect and deal with, such as a missing file. Functions that can fail this way return a `Result`, and the type system makes sure the caller notices.

## panic!: stop everything

You can panic deliberately with the `panic!` macro. It prints a message and ends the program (strictly speaking, the current thread):

```rust,should_panic
fn average(values: &[i32]) -> i32 {
    if values.is_empty() {
        panic!("average() called with no values");
    }
    let mut sum = 0;
    for v in values {
        sum += v;
    }
    sum / values.len() as i32
}

fn main() {
    println!("{}", average(&[2, 4, 9]));
    println!("{}", average(&[]));
}
```

```text
5

thread 'main' (31764) panicked at src/main.rs:3:9:
average() called with no values
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

The first line says which thread panicked (`main`, plus an ID number that varies between runs) and where in your source code. Before exiting, a panic **unwinds** the stack: it walks back up through the function calls and drops every value along the way, so memory and files are cleaned up properly. Setting the environment variable `RUST_BACKTRACE=1` shows the list of calls that led to the panic, which is very useful for finding bugs.

You have already met code that panics for you: indexing past the end of a vector, integer overflow in debug builds, dividing an integer by zero, and `unwrap()` on a `None`. A panic always means "the program has a bug", never "the user did something unusual".

## Result: success or failure

For errors you expect, the standard library defines another enum:

```rust,ignore
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`T` is the type of the successful value and `E` the type of the error. Like `Option`, `Result`, `Ok` and `Err` are always in scope. A good first example is turning text into a number. `str::parse` returns a `Result`, because not every string is a number:

```rust
fn main() {
    let inputs = ["42", "-7", "twelve", "99999999999"];

    for text in inputs {
        match text.parse::<i32>() {
            Ok(n) => println!("{text:?} -> {n}"),
            Err(e) => println!("{text:?} -> error: {e}"),
        }
    }
}
```

```text
"42" -> 42
"-7" -> -7
"twelve" -> error: invalid digit found in string
"99999999999" -> error: number too large to fit in target type
```

The `::<i32>` (nicknamed the **turbofish**) tells `parse` which type to produce. Often you can leave it out and annotate the variable instead: `let n: i32 = text.parse().unwrap();`. The error type here is `std::num::ParseIntError`, which knows how to describe itself when printed with `{}`.

:::note Coming from Python
Python's `int(" 42\n")` quietly ignores surrounding whitespace, but Rust's `parse` doesn't: `" 42\n".parse::<i32>()` is an `Err`. Lines read from a file or pasted from a dataset often carry spaces or a trailing newline, so call `.trim()` before parsing, as the examples below do.
:::

The crucial point is the same as with `Option`: a `Result<i32, ParseIntError>` is not an `i32`. You cannot use the number until you have dealt with the possibility that there isn't one.

## Writing functions that return Result

Your own functions return `Result` the same way. Pick a success type and an error type. For now a `String` describing the problem works well; the next lesson shows how to build proper error types.

```rust
fn check_age(age: i32) -> Result<u8, String> {
    if age < 0 {
        Err(format!("age can't be negative (got {age})"))
    } else if age > 150 {
        Err(format!("{age} is not a realistic age"))
    } else {
        Ok(age as u8)
    }
}

fn main() {
    for a in [30, -2, 400] {
        match check_age(a) {
            Ok(age) => println!("valid age: {age}"),
            Err(msg) => println!("invalid: {msg}"),
        }
    }
}
```

```text
valid age: 30
invalid: age can't be negative (got -2)
invalid: 400 is not a realistic age
```

:::note Result must be used
`Result` is marked `#[must_use]`. If you call a function returning `Result` and ignore the value, the compiler warns you. Errors cannot slip by silently the way an unchecked return code can in C.
:::

## unwrap and expect

`Result` has the same shortcuts as `Option`. `unwrap()` returns the `Ok` value or panics on `Err`. `expect("message")` does the same but with your message, which makes the panic much easier to understand:

```rust
fn main() {
    let port: u16 = "8080".parse().expect("port should be a valid number");
    println!("listening on port {port}");

    let fallback: i32 = "oops".parse().unwrap_or(0);
    println!("fallback = {fallback}");
}
```

```text
listening on port 8080
fallback = 0
```

When are `unwrap` and `expect` acceptable?

- In examples, quick experiments and tests, where a crash with a message is exactly what you want.
- When you *know* the operation can't fail, but the compiler doesn't. Parsing the literal `"8080"` can never fail. Use `expect` and write *why* you believe it can't fail, so a future reader (or a future panic message) explains the assumption.
- Not for input from users, files or the network. Those will eventually be wrong, and your program should say so politely instead of crashing.

## The ? operator

Handling every `Result` with `match` gets repetitive when a function does several fallible steps and just wants to hand any error back to its caller. That pattern is so common that Rust has an operator for it: `?`.

Put `?` after an expression that returns a `Result`. If it is `Ok(v)`, the expression evaluates to `v` and the function carries on. If it is `Err(e)`, the function **returns `Err(e)` immediately**.

```rust
use std::num::ParseIntError;

fn add_strings(a: &str, b: &str) -> Result<i32, ParseIntError> {
    let x = a.trim().parse::<i32>()?;
    let y = b.trim().parse::<i32>()?;
    Ok(x + y)
}

// Exactly what the ? version does, written out by hand
fn add_strings_long(a: &str, b: &str) -> Result<i32, ParseIntError> {
    let x = match a.trim().parse::<i32>() {
        Ok(v) => v,
        Err(e) => return Err(e),
    };
    let y = match b.trim().parse::<i32>() {
        Ok(v) => v,
        Err(e) => return Err(e),
    };
    Ok(x + y)
}

fn main() {
    println!("{:?}", add_strings("2", " 40 "));
    println!("{:?}", add_strings("2", "forty"));
    println!("{:?}", add_strings_long("1", "2"));
}
```

```text
Ok(42)
Err(ParseIntError { kind: InvalidDigit })
Ok(3)
```

The `?` version reads like code that ignores errors, yet handles every one of them. Each `?` is a visible marker of "this step can fail, and if it does we stop here".

:::note Coming from Python
`?` is much like letting an exception propagate to the caller, with two differences: every place it can happen is marked with a `?`, and the function's signature states which error type can come out. Think of returning `Result` as a checked, typed `raise` that the caller can't overlook.
:::

There is one rule: `?` can only be used inside a function whose return type can hold the error, typically a `Result`. Using it in a function that returns `()` or `i32` is a compile error:

```rust,compile_fail
fn double(text: &str) -> i32 {
    let n: i32 = text.parse()?;
    n * 2
}

fn main() {
    println!("{}", double("4"));
}
```

```text
error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option` (or another type that implements `FromResidual`)
 --> src/main.rs:2:30
  |
1 | fn double(text: &str) -> i32 {
  | ---------------------------- this function should return `Result` or `Option` to accept `?`
2 |     let n: i32 = text.parse()?;
  |                              ^ cannot use the `?` operator in a function that returns `i32`
```

### ? in main

`main` is allowed to return a `Result` too, which lets you use `?` all the way to the top of your program. If `main` returns an `Err`, Rust prints it with Debug formatting and the program exits with a non-zero status code, which signals failure to the shell.

```rust
use std::num::ParseIntError;

fn main() -> Result<(), ParseIntError> {
    let width: u32 = "12".parse()?;
    let height: u32 = "5".parse()?;
    println!("area = {}", width * height);
    Ok(())
}
```

```text
area = 60
```

`Ok(())` means "succeeded, with nothing to return". `()` is the unit type you have seen as the return type of functions that return nothing.

### ? with Option

`?` works on `Option` as well, in a function that returns `Option`. On `None`, the function returns `None` early:

```rust
fn first_char_upper(words: &[&str]) -> Option<char> {
    let first_word = words.first()?;
    let c = first_word.chars().next()?;
    Some(c.to_ascii_uppercase())
}

fn main() {
    println!("{:?}", first_char_upper(&["rust", "is", "fun"]));
    println!("{:?}", first_char_upper(&[]));
    println!("{:?}", first_char_upper(&[""]));
}
```

```text
Some('R')
None
None
```

You can't mix the two in one function: `?` on an `Option` inside a function returning `Result` won't compile. To convert, use `option.ok_or(some_error)?`, which turns `None` into `Err(some_error)`.

## Reading a Rosalind dataset from a file

Until now you have pasted every Rosalind dataset into your program as a string. That works, but it means editing and recompiling for each new dataset, and pasting 1000 lines of FASTA into your source code gets old fast. Now that you know `Result` and `?`, you can read the file Rosalind gives you directly. Two standard library functions do the work:

- `std::env::args()` gives you the program's **command-line arguments** as `String`s. The first one (number 0) is the path of the program itself, so `.nth(1)` is the first argument you typed. It returns an `Option<String>`: `None` if you didn't type one.
- `std::fs::read_to_string(path)` reads a whole file into a `String`. It returns a `Result<String, std::io::Error>`, because the file might not exist or might not be readable.

From here on, every Rosalind solution in the course starts like this:

```rust
use std::error::Error;

// Used when no file name is given, so the program still runs on its own.
const SAMPLE: &str = "GATTACA\n";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let dna = input.trim();

    let mut gc = 0;
    for c in dna.chars() {
        if c == 'G' || c == 'C' {
            gc += 1;
        }
    }
    println!("{} bases, {gc} of them G or C", dna.len());
    Ok(())
}
```

```text
7 bases, 2 of them G or C
```

The `match` picks where the text comes from. With a file name, it reads the file, and the `?` hands any I/O error straight back out of `main`. Without one, it falls back to the built-in `SAMPLE`, which is why the program still prints something when you run it on this page. Both arms produce a `String`, so `input` has one type either way. `.trim()` removes the newline at the end of the file, just as it did for pasted text.

The return type `Result<(), Box<dyn Error>>` means "succeed with nothing, or fail with *any* kind of error". That lets `?` pass on an `io::Error` here, a `ParseIntError` there, or even a plain `String` message. The next lesson explains how it works; for now, treat it as the standard signature for a program's `main`.

To run it on a dataset you downloaded, save the file into your project folder and pass its name after `--`. Everything after the `--` goes to your program instead of to Cargo:

```console
$ cargo run -- rosalind_dna.txt
946 bases, 471 of them G or C
$ cargo run -- no_such_file.txt
Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }
```

A missing file is exactly the kind of expected failure `Result` is for: the program reports it and exits with a failure status instead of crashing with a panic. The report is in Debug format, because that is how `main` prints the error it returns; the next lesson shows how to print a friendlier message instead.

:::tip Beat the five-minute timer
Rosalind gives you five minutes to submit an answer once you download a dataset. With this pattern, the routine is: download, `cargo run -- ~/Downloads/rosalind_prtm.txt`, copy the output, upload. Test on the sample first, so you download only when your code works.
:::

## Panic or Result?

A useful rule of thumb from the Rust community:

| Situation | Use |
| --- | --- |
| The failure is expected in normal use (bad input, missing file, network down) | Return `Result` |
| The failure means your code has a bug (broken invariant, impossible state) | `panic!`, `unwrap`, `expect` |
| Examples, prototypes and tests | `unwrap` or `expect` is fine |
| You are writing a library | Strongly prefer `Result`, so the caller decides what to do |

Returning `Result` hands the decision to the caller, who knows more about the situation. A command-line tool might print a message and exit; a web server might return an error page and carry on. Panicking takes that choice away, so do it only when continuing would be wrong.

:::tip Test that code panics
In the Testing lesson you'll see `#[should_panic]`, an attribute that marks a test as passing only if the code inside panics. It's how you check that your `panic!` guards really fire.
:::

:::rosalind PRTM Calculating Protein Mass
A protein is a chain of amino acids, and each amino acid has a known weight. Scientists weigh proteins with a mass spectrometer and compare the result with the weight they expect, to check which protein they have. The weight of the chain (its **monoisotopic mass**, in daltons) is simply the sum of the weights of its amino acids, called **residues** once they are part of a chain.

Given a protein string of up to 1000 letters, print its total mass. Rosalind accepts small rounding differences, so print three decimal places with `{:.3}`. These are the residue masses:

| Residue | Mass | Residue | Mass |
| --- | --- | --- | --- |
| A | 71.03711 | M | 131.04049 |
| C | 103.00919 | N | 114.04293 |
| D | 115.02694 | P | 97.05276 |
| E | 129.04259 | Q | 128.05858 |
| F | 147.06841 | R | 156.10111 |
| G | 57.02146 | S | 87.03203 |
| H | 137.05891 | T | 101.04768 |
| I | 113.08406 | V | 99.06841 |
| K | 128.09496 | W | 186.07931 |
| L | 113.08406 | Y | 163.06333 |

Write it in three layers:

1. `fn residue_mass(aa: char) -> Option<f64>`: a `match` over the table, `None` for any other character.
2. `fn protein_mass(protein: &str) -> Result<f64, String>`: add up the masses. Turn each `Option` into a `Result` with `ok_or`, with a message saying which character was wrong and where, then use `?`.
3. `main`, reading the dataset with the file-or-sample pattern from this lesson.

For the sample `WHEATGRASS` the output is:

```text
1082.489
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "WHEATGRASS\n";

fn residue_mass(aa: char) -> Option<f64> {
    let mass = match aa {
        'A' => 71.03711,
        'C' => 103.00919,
        'D' => 115.02694,
        'E' => 129.04259,
        'F' => 147.06841,
        'G' => 57.02146,
        'H' => 137.05891,
        'I' => 113.08406,
        'K' => 128.09496,
        'L' => 113.08406,
        'M' => 131.04049,
        'N' => 114.04293,
        'P' => 97.05276,
        'Q' => 128.05858,
        'R' => 156.10111,
        'S' => 87.03203,
        'T' => 101.04768,
        'V' => 99.06841,
        'W' => 186.07931,
        'Y' => 163.06333,
        _ => return None,
    };
    Some(mass)
}

fn protein_mass(protein: &str) -> Result<f64, String> {
    let mut total = 0.0;
    for (i, aa) in protein.chars().enumerate() {
        total += residue_mass(aa).ok_or(format!("unknown residue {aa:?} at position {}", i + 1))?;
    }
    Ok(total)
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let mass = protein_mass(input.trim())?;
    println!("{mass:.3}");
    Ok(())
}
```

```text
1082.489
```

`residue_mass` uses `return None` inside the `match` for unknown characters, so every other arm can just be a number. If the dataset contained a stray `Z` at position 8, the program would stop with `Error: "unknown residue 'Z' at position 8"`. The quotes are there because `main` prints errors with Debug formatting; the next lesson shows how to print the plain message instead. Either way, a bad input produces a clear message instead of a wrong answer, which is exactly what you want five minutes before a Rosalind deadline.
:::

:::rosalind MRNA Inferring mRNA from Protein
The codon table from the Pattern Matching lesson works in one direction only: each codon gives exactly one amino acid, but most amino acids have several codons. Leucine (`L`) has six, tryptophan (`W`) only one. So if you know a protein, how many different RNA strings could have produced it? Multiply the number of choices for each amino acid, and then by 3, because the RNA must end with one of the three stop codons.

The answer grows astronomically (a 1000-letter protein has hundreds of digits), so Rosalind asks for it **modulo 1,000,000**, the remainder after dividing by one million. Given a protein string of up to 1000 letters, print that remainder as a single integer.

The number of codons for each amino acid:

| Codons | Amino acids |
| --- | --- |
| 1 | M, W |
| 2 | C, D, E, F, H, K, N, Q, Y |
| 3 | I |
| 4 | A, G, P, T, V |
| 6 | L, R, S |

Write `fn codon_count(aa: char) -> Option<u64>` and `fn count_mrnas(protein: &str) -> Option<u64>`, using `?` on each `codon_count` so that an unknown letter makes the whole count `None`. In `main`, turn that `None` into an error with `ok_or("...")?`.

The trick for the size problem: take the remainder after **every** multiplication, not once at the end. Reducing after each step gives the same final remainder as multiplying everything first and reducing once, but the running total always stays below 1,000,000, so `total * 6` can never overflow a `u64`. Multiplying first would overflow long before the end of the protein, and in a debug build that's a panic.

For the sample `MWQRY` there are 1 × 1 × 2 × 6 × 2 × 3 = 72 possibilities:

```text
72
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "MWQRY\n";
const MODULUS: u64 = 1_000_000;

/// How many codons encode each amino acid (from the codon table in the Pattern Matching lesson).
fn codon_count(aa: char) -> Option<u64> {
    match aa {
        'M' | 'W' => Some(1),
        'C' | 'D' | 'E' | 'F' | 'H' | 'K' | 'N' | 'Q' | 'Y' => Some(2),
        'I' => Some(3),
        'A' | 'G' | 'P' | 'T' | 'V' => Some(4),
        'L' | 'R' | 'S' => Some(6),
        _ => None,
    }
}

fn count_mrnas(protein: &str) -> Option<u64> {
    let mut total = 3; // the three possible stop codons at the end
    for aa in protein.chars() {
        total = total * codon_count(aa)? % MODULUS;
    }
    Some(total)
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let count = count_mrnas(input.trim()).ok_or("the protein contains an unknown amino acid")?;
    println!("{count}");
    Ok(())
}
```

```text
72
```

In `count_mrnas`, `codon_count(aa)?` returns `None` from the whole function the moment it meets a character it doesn't know, which is `?` on `Option` doing its job. `main` returns a `Result`, so it can't use `?` on the `Option` directly; `ok_or` converts it first. Note the order in `total * codon_count(aa)? % MODULUS`: `*` and `%` have the same precedence and run left to right, so the product is reduced right after it is formed.
:::

```quiz
? What does `?` do when applied to an `Err(e)`?
- It panics with the message in `e`.
- It replaces the error with a default value.
+ It returns `Err(e)` from the current function immediately.
- It skips to the next line.
= `?` unwraps an `Ok` value, or returns early with the error so the caller can deal with it.

? Which situation calls for returning a `Result` rather than panicking?
+ A configuration file the user pointed to does not exist.
- An internal function receives a value that your own code guarantees can't happen.
- A test wants to fail loudly.
= Missing files are a normal, expected failure that the caller should be able to handle. Panics are for bugs.

? Why won't `let n: i32 = text.parse()?;` compile inside `fn f() -> i32`?
- `parse` can't produce an `i32`.
- `?` only works on `Option`.
+ `?` needs the enclosing function to return a type like `Result` or `Option` that can carry the error.
= On an error, `?` returns early from the function, so the function's return type must be able to represent that error.

? What happens when `main` returns `Err(e)`?
- Nothing; the error is ignored.
- The program restarts.
+ The error is printed and the program exits with a non-zero status code.
= Returning `Result` from `main` is a convenient way to report failures from a command-line program.
```
