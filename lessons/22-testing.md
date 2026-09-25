---
title: Testing
module: Building a package
summary: Write unit and integration tests with Rust's built-in test framework, run them with cargo test, and let tests drive your design.
minutes: 35
---

The compiler catches a lot, but it can't tell whether your function computes the *right* answer. Tests can. Rust has a test framework built into the language and Cargo, so there is nothing to install: you write functions marked `#[test]`, and `cargo test` finds and runs them.

For a library you plan to publish, tests matter twice over. They prove your code works today, and they tell you immediately when a later change breaks something your users rely on.

## Your first test

A test is an ordinary function with the `#[test]` attribute above it. It passes if it returns normally and fails if it panics. The assertion macros panic for you when something is wrong:

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[test]
fn adds_two_numbers() {
    assert_eq!(add(2, 3), 5);
}

#[test]
fn adding_zero_changes_nothing() {
    assert_eq!(add(7, 0), 7);
    assert_ne!(add(7, 1), 7);
    assert!(add(-1, 1) == 0);
}
```

```console
$ cargo test
   Compiling adder v0.1.0 (/home/you/adder)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.41s
     Running unittests src/lib.rs (target/debug/deps/adder-1c2e6a3b1f0a8d4e)

running 2 tests
test adding_zero_changes_nothing ... ok
test adds_two_numbers ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests adder

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

Here is a buggy function and a test that catches it. Every assertion macro also accepts a custom message with `format!`-style arguments, printed when the assertion fails:

```rust,should_panic
fn average(values: &[f64]) -> f64 {
    let sum: f64 = values.iter().sum();
    sum / (values.len() as f64 + 1.0) // bug!
}

#[test]
fn average_of_three() {
    let values = [2.0, 4.0, 6.0];
    let avg = average(&values);
    assert_eq!(avg, 4.0, "average of {values:?} should be 4");
}
```

```text
running 1 test
test average_of_three ... FAILED

failures:

---- average_of_three stdout ----

thread 'average_of_three' panicked at src/lib.rs:10:5:
assertion `left == right` failed: average of [2.0, 4.0, 6.0] should be 4
  left: 3.0
 right: 4.0
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace


failures:
    average_of_three

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

You get the test name, the file and line, your message, and both values. Good test names such as `average_of_three` help too: the list of failures reads like a list of broken behaviours.

## The tests module

In a real project, unit tests live in the same file as the code they test, inside a module at the bottom:

```rust,file=src/lib.rs
pub fn celsius_to_fahrenheit(c: f64) -> f64 {
    c * 9.0 / 5.0 + 32.0
}

fn round_to_tenth(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

pub fn describe(c: f64) -> String {
    format!("{c}°C is {}°F", round_to_tenth(celsius_to_fahrenheit(c)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn freezing_point() {
        assert_eq!(celsius_to_fahrenheit(0.0), 32.0);
    }

    #[test]
    fn rounding_helper() {
        assert_eq!(round_to_tenth(1.26), 1.3);
    }

    #[test]
    fn description() {
        assert_eq!(describe(37.0), "37°C is 98.6°F");
    }
}
```

Two lines deserve an explanation:

- `#[cfg(test)]` means "only compile this when testing". The tests module is left out of normal builds entirely, so it adds nothing to your library or program.
- `use super::*;` brings everything from the parent module (the code under test) into the tests module. Remember from the modules lesson that a child module can see its parent's private items, so `round_to_tenth` can be tested even though it isn't `pub`.

## Testing for panics

Sometimes the correct behaviour *is* to panic, for example when a caller breaks a documented rule. Mark such a test with `#[should_panic]`. Adding `expected` checks that the panic message contains a given piece of text, so the test doesn't pass by accident because of some other panic:

```rust
pub struct Percentage(u8);

impl Percentage {
    pub fn new(value: u8) -> Percentage {
        if value > 100 {
            panic!("percentage must be at most 100, got {value}");
        }
        Percentage(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_100() {
        assert_eq!(Percentage::new(100).0, 100);
    }

    #[test]
    #[should_panic(expected = "at most 100")]
    fn rejects_101() {
        Percentage::new(101);
    }
}
```

## Tests that return Result

A test can also return `Result<(), E>`. It fails if it returns `Err`. That lets you use `?` instead of calling `unwrap` on every step:

```rust
use std::num::ParseIntError;

fn parse_pair(s: &str) -> Result<(i32, i32), ParseIntError> {
    let (a, b) = s.split_once(',').unwrap_or((s, ""));
    Ok((a.trim().parse()?, b.trim().parse()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_pair() -> Result<(), ParseIntError> {
        let pair = parse_pair("3, 4")?;
        assert_eq!(pair, (3, 4));
        Ok(())
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_pair("3, x").is_err());
    }
}
```

To check that something *is* an error, don't use `?`. Assert on the result instead, as `rejects_garbage` does.

## Running tests

`cargo test` compiles your crate in test mode and runs every test in parallel. A few options cover most needs:

| Command | What it does |
| --- | --- |
| `cargo test` | Run all tests. |
| `cargo test parse` | Run only tests whose name contains `parse`. |
| `cargo test tests::accepts_100` | Run one specific test by its path. |
| `cargo test -- --nocapture` | Show `println!` output from passing tests too. |
| `cargo test -- --test-threads=1` | Run tests one at a time. |
| `cargo test -- --ignored` | Run only tests marked `#[ignore]` (for slow ones). |

The `--` separates options for Cargo from options for the test program itself. Output capture is worth knowing about: by default the test runner hides anything a *passing* test prints, to keep the report tidy. Failing tests show their output. `--nocapture` turns that off when you are debugging.

## Integration tests

Unit tests check pieces from the inside. **Integration tests** check your library from the outside, exactly the way a user would: through its public API only. They live in a `tests/` folder next to `src/`:

```text
temperature/
├── Cargo.toml
├── src/
│   └── lib.rs
└── tests/
    └── conversions.rs
```

```rust,ignore,file=tests/conversions.rs
use temperature::{celsius_to_fahrenheit, describe};

#[test]
fn body_temperature() {
    assert_eq!(describe(37.0), "37°C is 98.6°F");
}

#[test]
fn minus_forty_is_the_same_in_both() {
    assert_eq!(celsius_to_fahrenheit(-40.0), -40.0);
}
```

Each file in `tests/` is compiled as a separate crate that depends on your library, so it imports items by the crate name and can only see `pub` items. There is no need for `#[cfg(test)]` there, because Cargo only builds that folder when testing. To share helper code between integration test files, put it in `tests/common/mod.rs` and add `mod common;` to the files that need it (the `mod.rs` form stops Cargo from treating the helpers as a test file of their own).

Integration tests need a *library* crate to import. A package that only has `src/main.rs` can't be tested this way, which is one more reason to put your logic in `lib.rs` and keep `main.rs` thin.

`cargo test` runs the sections one after another: unit tests, then each integration test file, then doc tests. Use `cargo test --test conversions` to run a single integration test file.

## A first look at doc tests

The last section of `cargo test` output is `Doc-tests`. Code examples you write in documentation comments are compiled and run as tests too, so your examples can never silently go out of date. That is the topic of the next lesson.

## Letting tests lead

A useful habit is **test-driven development**: write a test for the behaviour you want, watch it fail, then write just enough code to make it pass. Writing the test first forces you to decide how the function should be *called* before you worry about how it works.

Suppose you need a function that decides whether a year is a leap year. Start with the rules as tests, and a function body that you know is wrong:

```rust,should_panic
pub fn is_leap_year(year: u32) -> bool {
    todo!()
}

#[test]
fn ordinary_years_are_not_leap_years() {
    assert!(!is_leap_year(2023));
}

#[test]
fn every_fourth_year_is_a_leap_year() {
    assert!(is_leap_year(2024));
}
```

`todo!()` compiles, so you can run the tests right away, and they fail with `not yet implemented`. A first attempt, `year % 4 == 0`, turns both green. Then add the tricky cases, which fail again, until the implementation handles them:

```rust
pub fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_years_are_not_leap_years() {
        assert!(!is_leap_year(2023));
    }

    #[test]
    fn every_fourth_year_is_a_leap_year() {
        assert!(is_leap_year(2024));
    }

    #[test]
    fn centuries_are_not_leap_years() {
        assert!(!is_leap_year(1900));
    }

    #[test]
    fn every_fourth_century_is_a_leap_year() {
        assert!(is_leap_year(2000));
    }
}
```

The tests now document the rules better than a comment could, and they will catch anyone who later "simplifies" the function back to `year % 4 == 0`.

:::tip What to test
Test the behaviour your users rely on, not every line. Good candidates: normal cases, edge cases (empty input, zero, the largest value), and every error your function can return. When you fix a bug, first write a test that reproduces it, so it can never come back unnoticed.
:::

:::exercise Test a function
Here is a function that returns the initials of a name, such as `"Grace Brewster Hopper"` giving `"G.B.H."`. Write a `tests` module with at least three tests: a normal name, a single name, and extra spaces between words. Make sure all of them pass.

```rust
pub fn initials(name: &str) -> String {
    name.split_whitespace()
        .filter_map(|word| word.chars().next())
        .map(|c| format!("{}.", c.to_uppercase()))
        .collect()
}
```
:::solution
```rust
pub fn initials(name: &str) -> String {
    name.split_whitespace()
        .filter_map(|word| word.chars().next())
        .map(|c| format!("{}.", c.to_uppercase()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_name() {
        assert_eq!(initials("Grace Brewster Hopper"), "G.B.H.");
    }

    #[test]
    fn single_name() {
        assert_eq!(initials("ferris"), "F.");
    }

    #[test]
    fn extra_spaces() {
        assert_eq!(initials("  ada   lovelace "), "A.L.");
    }

    #[test]
    fn empty_name() {
        assert_eq!(initials(""), "");
    }
}
```

`split_whitespace` skips any amount of whitespace, which is why the extra spaces don't produce empty words.
:::

:::exercise Test-drive a function
Using tests first, write `fn clamp_score(score: i32) -> u8` that turns any score into the range 0 to 100: negative numbers become 0, numbers above 100 become 100. Also write `fn grade(score: u8) -> char` that returns `'A'` for 90 and above, `'B'` for 80 to 89, `'C'` for 70 to 79, and `'F'` otherwise, with a `#[should_panic]` test that `grade(101)` panics.
:::solution
```rust
pub fn clamp_score(score: i32) -> u8 {
    score.clamp(0, 100) as u8
}

pub fn grade(score: u8) -> char {
    match score {
        90..=100 => 'A',
        80..=89 => 'B',
        70..=79 => 'C',
        0..=69 => 'F',
        _ => panic!("score out of range: {score}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_both_ends() {
        assert_eq!(clamp_score(-5), 0);
        assert_eq!(clamp_score(42), 42);
        assert_eq!(clamp_score(250), 100);
    }

    #[test]
    fn grade_boundaries() {
        assert_eq!(grade(100), 'A');
        assert_eq!(grade(90), 'A');
        assert_eq!(grade(89), 'B');
        assert_eq!(grade(70), 'C');
        assert_eq!(grade(69), 'F');
    }

    #[test]
    #[should_panic(expected = "out of range")]
    fn grade_rejects_101() {
        grade(101);
    }
}
```
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
