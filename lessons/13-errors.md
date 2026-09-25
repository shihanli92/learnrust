---
title: Error Handling
module: Handling failure
summary: Tell apart bugs from expected failures, and handle the latter with Result, match and the ? operator.
minutes: 35
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

thread 'main' panicked at src/main.rs:3:9:
average() called with no values
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

Before exiting, a panic **unwinds** the stack: it walks back up through the function calls and drops every value along the way, so memory and files are cleaned up properly. Setting the environment variable `RUST_BACKTRACE=1` shows the list of calls that led to the panic, which is very useful for finding bugs.

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

:::exercise Parse a list of numbers
Write `fn sum_all(items: &[&str]) -> Result<i32, std::num::ParseIntError>` that parses every string and returns the sum, using `?`. In `main`, print the result for `["1", "2", "3"]` and for `["1", "two", "3"]`. Use `match` so the error case prints a friendly message.
:::solution
```rust
use std::num::ParseIntError;

fn sum_all(items: &[&str]) -> Result<i32, ParseIntError> {
    let mut total = 0;
    for item in items {
        total += item.parse::<i32>()?;
    }
    Ok(total)
}

fn main() {
    for list in [["1", "2", "3"], ["1", "two", "3"]] {
        match sum_all(&list) {
            Ok(sum) => println!("{list:?}: sum is {sum}"),
            Err(e) => println!("{list:?}: could not add them up ({e})"),
        }
    }
}
```

```text
["1", "2", "3"]: sum is 6
["1", "two", "3"]: could not add them up (invalid digit found in string)
```
:::

:::exercise Key-value lines
Write `fn parse_setting(line: &str) -> Result<(String, u32), String>` for lines like `"volume=7"`. Return an `Err` with a helpful message if there is no `=` (use `split_once('=')` and `ok_or`) or if the value is not a number (use `map_err` to turn the parse error into a `String`, as in the hint). Print the result for `"volume=7"`, `"volume"` and `"volume=loud"`.

Hint: `result.map_err(|e| format!("bad number: {e}"))` changes the error inside a `Result` and leaves an `Ok` alone.
:::solution
```rust
fn parse_setting(line: &str) -> Result<(String, u32), String> {
    let (key, value) = line
        .split_once('=')
        .ok_or(format!("missing '=' in {line:?}"))?;
    let number = value
        .trim()
        .parse::<u32>()
        .map_err(|e| format!("bad number {value:?}: {e}"))?;
    Ok((key.trim().to_string(), number))
}

fn main() {
    for line in ["volume=7", "volume", "volume=loud"] {
        println!("{:?}", parse_setting(line));
    }
}
```

```text
Ok(("volume", 7))
Err("missing '=' in \"volume\"")
Err("bad number \"loud\": invalid digit found in string")
```
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
