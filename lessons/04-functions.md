---
title: Functions
module: Getting started
summary: Write your own functions with typed parameters and return values, and learn the difference between statements and expressions.
minutes: 30
---

So far every program has lived inside `main`. Real programs are split into many small functions, each with a name that says what it does. Functions let you reuse code, give ideas a name, and test pieces on their own.

Rust functions look much like those in other languages, with one twist that surprises almost everyone: whether a line ends in a semicolon can change what the function returns. By the end of this lesson that will make sense, and you will see why it is actually a tidy rule.

## Defining a function

You declare a function with `fn`, a name, a parameter list in parentheses and a body in braces:

```rust
fn main() {
    println!("Starting up");
    greet();
    greet();
}

fn greet() {
    println!("Hello from greet!");
}
```

```text
Starting up
Hello from greet!
Hello from greet!
```

A few points:

- Function names use `snake_case`, just like variables. Write `print_report`, not `printReport`; the compiler warns about the second one.
- It does not matter whether a function is defined above or below the place where you call it. Rust reads the whole file first.
- Calling a function uses its name followed by parentheses, even when there are no arguments.

## Parameters

Parameters are the inputs a function takes. Each one has a name and a **type**, and the type is required:

```rust
fn main() {
    print_total("apples", 3, 40);
    print_total("pears", 5, 55);
}

fn print_total(item: &str, quantity: u32, cents_each: u32) {
    println!("{quantity} {item} cost {} cents", quantity * cents_each);
}
```

```text
3 apples cost 120 cents
5 pears cost 275 cents
```

(`&str` is the type of a piece of text such as `"apples"`. You will learn exactly what the `&` means in the Ownership module.)

Leave a type out and you get an error:

```rust,compile_fail
fn add(a, b) -> i32 {
    a + b
}

fn main() {
    println!("{}", add(1, 2));
}
```

```text
error: expected one of `:`, `@`, or `|`, found `,`
 --> src/main.rs:1:9
  |
1 | fn add(a, b) -> i32 {
  |         ^ expected one of `:`, `@`, or `|`
  |
help: if this is a parameter name, give it a type
  |
1 | fn add(a: TypeName, b) -> i32 {
  |         ++++++++++
```

Why insist, when Rust happily infers the types of `let` variables? Because a function's signature (its name, parameters and return type) is a **contract**. Anyone calling `print_total` can see exactly what it needs without reading the body. It also keeps errors local: if you pass the wrong type, the compiler complains at the call site instead of somewhere deep inside the function. Inside a function body, type inference works as usual.

## Returning a value

To return a value, write its type after an arrow `->`. The last expression in the body is the value returned:

```rust
fn square(n: i32) -> i32 {
    n * n
}

fn main() {
    let area = square(7);
    println!("The area is {area}");
    println!("Squares: {} {} {}", square(1), square(2), square(3));
}
```

```text
The area is 49
Squares: 1 4 9
```

Notice that `n * n` has no semicolon and there is no `return` keyword. To see why that works, you need to know about statements and expressions.

## Statements and expressions

Rust code is made of two kinds of things:

- An **expression** produces a value. `5`, `n * n`, `square(7)` and `x > 3` are all expressions.
- A **statement** performs an action and produces no value. `let area = square(7);` is a statement.

In many languages, assignment is itself an expression, so you can write `x = y = 6`. In Rust, `let` is a statement, so `let x = (let y = 6);` is simply an error: there is no value for `x` to receive.

Here is the key rule: **adding a semicolon turns an expression into a statement.** The value is computed and then thrown away. So `n * n` produces a value, while `n * n;` produces nothing.

A function's body returns the value of its final expression. If the body ends in a statement instead, it returns `()`, the unit value that means "nothing".

### The semicolon matters

Here is the mistake almost every newcomer makes once:

```rust,compile_fail
fn plus_one(x: i32) -> i32 {
    x + 1;
}

fn main() {
    println!("{}", plus_one(5));
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:1:24
  |
1 | fn plus_one(x: i32) -> i32 {
  |    --------            ^^^ expected `i32`, found `()`
  |    |
  |    implicitly returns `()` as its body has no tail or `return` expression
2 |     x + 1;
  |          - help: remove this semicolon to return this value
```

The signature promises an `i32`, but `x + 1;` is a statement, so the body produces `()`. The compiler spots exactly this situation and tells you to remove the semicolon.

:::tip Reading the rule the other way
If a function has no `->` in its signature, it returns `()`. That is why `main` and `greet` above end their lines with semicolons: they have nothing to return.
:::

## Returning early

The final expression is the normal way out of a function, but sometimes you want to leave sooner. The `return` keyword exits immediately with a value:

```rust
fn safe_divide(a: i32, b: i32) -> i32 {
    if b == 0 {
        return 0; // bail out early: dividing by zero would panic
    }
    a / b
}

fn main() {
    println!("{}", safe_divide(10, 2));
    println!("{}", safe_divide(10, 0));
}
```

```text
5
0
```

The `if` checks a condition; you will study it properly in the next lesson. The style to aim for is: use `return` for early exits, and let the last expression be the normal result. Writing `return a / b;` on the last line also works, but it is not idiomatic.

(Returning `0` for a division by zero hides the problem from the caller. Later you will learn better tools, `Option` and `Result`, for "this might not have an answer".)

## Blocks are expressions too

A block in curly braces is an expression. Its value is the value of its last expression, just like a function body:

```rust
fn main() {
    let width = 4;
    let height = 3;

    let area = {
        let doubled_width = width * 2; // a statement inside the block
        doubled_width * height         // the block's value
    };

    println!("area = {area}");
}
```

```text
area = 24
```

The temporary `doubled_width` only exists inside the braces, which keeps it out of the way afterwards. This "everything is an expression" design is why Rust needs no special syntax for returning the last value, and you will see it again with `if` in the next lesson.

## Returning several values

A function returns exactly one value, but that value can be a tuple:

```rust
fn min_and_max(a: i32, b: i32, c: i32) -> (i32, i32) {
    let min = a.min(b).min(c);
    let max = a.max(b).max(c);
    (min, max)
}

fn main() {
    let (lowest, highest) = min_and_max(7, 2, 9);
    println!("lowest {lowest}, highest {highest}");
}
```

```text
lowest 2, highest 9
```

`a.min(b)` is a **method call**: a function attached to a value, called with a dot. Integers come with many handy methods like `min`, `max` and `abs`.

## Comments

Comments are notes for humans; the compiler ignores them.

```rust
/// Returns the number of seconds in the given number of minutes.
fn minutes_to_seconds(minutes: u32) -> u32 {
    // 60 seconds in every minute
    minutes * 60 /* an inline comment also works */
}

fn main() {
    println!("{}", minutes_to_seconds(3));
}
```

```text
180
```

- `//` starts a comment that runs to the end of the line. This is the usual kind.
- `/* ... */` can span part of a line or several lines. It is rarely used.
- `///` is a **documentation comment**. It describes the item that follows it, and tools turn it into web documentation. You will use it a lot when you publish your crate, in the documentation lesson.

Good comments explain *why* code does something. The code itself already says *what* it does.

Rosalind problems usually give you a few numbers and ask for one answer, which is exactly the shape of a function: parameters in, return value out. Writing the solution as a function, with `main` only supplying the dataset and printing the result, keeps the interesting part easy to read and easy to reuse.

:::exercise Strand statistics
Write a function `strand_stats(a: u32, c: u32, g: u32, t: u32) -> (u32, u32)`. Its parameters are how many of each base a DNA string contains; it returns the total length and the number of bases that are `G` or `C`. In `main`, call it with the counts 20, 12, 17 and 21, destructure the result and print both parts. Make sure the function body ends in an expression, not a statement.
:::solution
```rust
fn strand_stats(a: u32, c: u32, g: u32, t: u32) -> (u32, u32) {
    let length = a + c + g + t;
    let gc = g + c;
    (length, gc)
}

fn main() {
    let (length, gc) = strand_stats(20, 12, 17, 21);
    println!("length {length}, G or C: {gc}");
}
```

```text
length 70, G or C: 29
```

If you wrote `(length, gc);` with a semicolon, the compiler would report a mismatched type: the function promised a tuple but returned `()`.
:::

:::rosalind FIB Rabbits and Recurrence Relations
**The story.** This problem is a famous puzzle from 1202, by Leonardo of Pisa (Fibonacci), with one twist. You start with one pair of newborn rabbits. A pair takes one month to grow up, and from then on it produces `k` new pairs every month. Rabbits never die. How many pairs are there after `n` months?

In month 1 there is 1 pair (newborns) and in month 2 still 1 pair (now adults). From month 3 on, the count is everyone alive last month, plus `k` babies for each pair that was alive two months ago (those are the adults):

`F(1) = 1`, `F(2) = 1`, and `F(n) = F(n - 1) + k · F(n - 2)`.

A formula like this, where each value is built from earlier ones, is called a **recurrence relation**. With `k = 1` it gives the classic Fibonacci numbers 1, 1, 2, 3, 5, 8, ...

**The task.** The input is two numbers, `n` (at most 40) and `k` (at most 5). Print `F(n)`, a single whole number. For example, `n = 7` and `k = 2` give 43.

Fill in `rabbits` below. You need to repeat a step once for each month from 3 to `n`. Loops are the topic of the next lesson, but here is all you need: `for _ in 3..=n { ... }` runs the body once for each month from 3 up to and including `n`. (The `_` means you don't need to know which month it is.)

```rust
fn rabbits(n: u32, k: u64) -> u64 {
    // Your code here.
    0
}

fn main() {
    let n = 7; // paste n from your dataset
    let k = 2; // paste k from your dataset
    println!("{}", rabbits(n, k));
}
```
:::solution
Keep the last two months' counts in two `mut` variables and roll them forward one month at a time:

```rust
fn rabbits(n: u32, k: u64) -> u64 {
    if n <= 2 {
        return 1;
    }
    let mut two_ago: u64 = 1; // F(month - 2)
    let mut last: u64 = 1;    // F(month - 1)
    for _ in 3..=n {
        let now = last + k * two_ago;
        two_ago = last;
        last = now;
    }
    last
}

fn main() {
    let n = 7; // paste n from your dataset
    let k = 2; // paste k from your dataset
    println!("{}", rabbits(n, k));
}
```

```text
43
```

Notice the early `return 1;` for the first two months, and the final `last`, with no semicolon, as the normal result.

**Why `u64`?** The largest possible answer, `rabbits(40, 5)`, is 148277527396903091, about 1.5 × 10¹⁷. A `u32` tops out at about 4.3 × 10⁹, so it would overflow (and panic, in a debug build) long before month 40. A `u64` goes up to about 1.8 × 10¹⁹, which is enough.

**A recursive version.** A function may call itself. That lets you copy the recurrence almost word for word:

```rust
fn rabbits(n: u32, k: u64) -> u64 {
    if n <= 2 {
        return 1;
    }
    rabbits(n - 1, k) + k * rabbits(n - 2, k)
}

fn main() {
    println!("{}", rabbits(7, 2));
}
```

```text
43
```

It is lovely to read, but slow for large `n`: every call makes two more calls, which recompute the same months again and again. For `n = 40` that is hundreds of millions of calls, where the loop version does 38 steps. Use the loop for your dataset.
:::

```quiz
? What does this function return? `fn f() -> i32 { 5; }`
- `5`
- `0`
+ Nothing: it does not compile.
- `()`
= `5;` is a statement, so the body produces `()`, which does not match the promised `i32`. Removing the semicolon fixes it.

? Why must function parameters have explicit types?
+ The signature acts as a contract, so callers and the compiler know exactly what the function needs.
- Rust has no type inference.
- Types are only needed for public functions.
- It makes the program run faster.
= Rust infers types inside function bodies, but requires them in signatures so each function has a clear, checkable interface.

? What is the value of `x` after `let x = { let a = 2; a * 10 };`?
- `2`
- `()`
- It does not compile.
+ `20`
= A block is an expression whose value is its last expression, `a * 10`.

? Which comment style is used to document an item for generated documentation?
- `//`
- `/* */`
+ `///`
- `#`
= `///` doc comments describe the following item and appear in the generated documentation.
```
