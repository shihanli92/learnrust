---
title: Custom Error Types
module: Handling failure
summary: Design your own error enums, implement Display and Error for them, and let ? convert between error types automatically.
minutes: 35
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

:::exercise A bank error
Write an error enum `BankError` with variants `InsufficientFunds { needed: u64, available: u64 }` and `AccountLocked`. Derive `Debug`, implement `Display` with friendly messages and implement `std::error::Error` (an empty `impl` is fine). Then write `fn withdraw(balance: u64, amount: u64, locked: bool) -> Result<u64, BankError>` that returns the new balance. In `main`, try three withdrawals (one succeeds, one is too large, one on a locked account) and print each result with `{}` for errors.
:::solution
```rust
use std::fmt;

#[derive(Debug)]
enum BankError {
    InsufficientFunds { needed: u64, available: u64 },
    AccountLocked,
}

impl fmt::Display for BankError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            BankError::InsufficientFunds { needed, available } => {
                write!(f, "insufficient funds: needed {needed}, available {available}")
            }
            BankError::AccountLocked => write!(f, "the account is locked"),
        }
    }
}

impl std::error::Error for BankError {}

fn withdraw(balance: u64, amount: u64, locked: bool) -> Result<u64, BankError> {
    if locked {
        return Err(BankError::AccountLocked);
    }
    if amount > balance {
        return Err(BankError::InsufficientFunds { needed: amount, available: balance });
    }
    Ok(balance - amount)
}

fn main() {
    for (amount, locked) in [(30, false), (500, false), (10, true)] {
        match withdraw(100, amount, locked) {
            Ok(left) => println!("withdrew {amount}, {left} left"),
            Err(e) => println!("failed: {e}"),
        }
    }
}
```

```text
withdrew 30, 70 left
failed: insufficient funds: needed 500, available 100
failed: the account is locked
```
:::

:::exercise Convert with From
Start from your `BankError` and add a variant `BadAmount(std::num::ParseIntError)`. Implement `From<ParseIntError> for BankError`, then write `fn withdraw_text(balance: u64, amount: &str) -> Result<u64, BankError>` that parses `amount` with `?` and subtracts it (return `InsufficientFunds` if it's too large). Print the results for `"40"` and `"forty"`.
:::solution
```rust
use std::fmt;
use std::num::ParseIntError;

#[derive(Debug)]
enum BankError {
    InsufficientFunds { needed: u64, available: u64 },
    BadAmount(ParseIntError),
}

impl fmt::Display for BankError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            BankError::InsufficientFunds { needed, available } => {
                write!(f, "insufficient funds: needed {needed}, available {available}")
            }
            BankError::BadAmount(e) => write!(f, "bad amount: {e}"),
        }
    }
}

impl std::error::Error for BankError {}

impl From<ParseIntError> for BankError {
    fn from(e: ParseIntError) -> Self {
        BankError::BadAmount(e)
    }
}

fn withdraw_text(balance: u64, amount: &str) -> Result<u64, BankError> {
    let amount: u64 = amount.trim().parse()?;
    if amount > balance {
        return Err(BankError::InsufficientFunds { needed: amount, available: balance });
    }
    Ok(balance - amount)
}

fn main() {
    for text in ["40", "forty"] {
        match withdraw_text(100, text) {
            Ok(left) => println!("{text}: {left} left"),
            Err(e) => println!("{text}: {e}"),
        }
    }
}
```

```text
40: 60 left
forty: bad amount: invalid digit found in string
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
