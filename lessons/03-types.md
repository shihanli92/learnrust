---
title: Data Types
module: Getting started
summary: Meet Rust's built-in types (integers, floats, booleans, characters, tuples and arrays) and learn how to convert between them.
minutes: 30
---

Every value in Rust has a type, and the compiler knows every type before the program runs. That is what **statically typed** means. The type decides how much memory a value takes, what operations make sense on it, and which mistakes the compiler can catch for you.

This lesson is a tour of the built-in types you will use all the time. They fall into two groups: **scalar** types, which hold a single value (integers, floating-point numbers, booleans and characters), and **compound** types, which group several values together (tuples and arrays).

## Integers

An integer is a whole number. Rust has several integer types, named by whether they can be negative and by how many bits they use:

| Bits | Signed (can be negative) | Unsigned (zero or more) |
| --- | --- | --- |
| 8 | `i8`: -128 to 127 | `u8`: 0 to 255 |
| 16 | `i16` | `u16` |
| 32 | `i32`: about ±2.1 billion | `u32`: 0 to about 4.3 billion |
| 64 | `i64` | `u64` |
| 128 | `i128` | `u128` |
| pointer-sized | `isize` | `usize` |

`isize` and `usize` are as wide as a memory address on the machine: 64 bits on almost every computer today.

Which one should you pick?

- If you don't say, Rust uses `i32`. It is a good general-purpose default.
- Use `usize` for anything that counts or indexes into a collection. Lengths such as `"hello".len()` are `usize`.
- Use a specific size such as `u8` or `u64` when the data calls for it, for example a byte, or a number that might exceed two billion.

### Writing integer literals

Rust gives you some conveniences for writing numbers:

```rust
fn main() {
    let population = 8_100_000_000_u64; // underscores are ignored, they just help reading
    let hex = 0xff;                      // hexadecimal
    let octal = 0o755;                   // octal
    let bits = 0b1010_1010;              // binary
    let byte = b'A';                     // a u8 holding the ASCII code for 'A'
    let small = 42u8;                    // a suffix sets the type
    println!("{population} {hex} {octal} {bits} {byte} {small}");
}
```

```text
8100000000 255 493 170 65 42
```

### Integer overflow

What happens if a value gets too big for its type? A `u8` holds at most 255, so what is 250 + 10?

```rust,should_panic
fn main() {
    let mut level: u8 = 250;
    level += 10; // 260 does not fit in a u8
    println!("level is {level}");
}
```

```text
thread 'main' panicked at src/main.rs:3:5:
attempt to add with overflow
```

When you build in debug mode (plain `cargo run`), Rust checks every arithmetic operation and **panics** on overflow. A panic stops the program with an error message. Crashing sounds harsh, but it is much better than carrying on with a silently wrong number.

In release mode (`cargo build --release`) these checks are switched off for speed, and the value **wraps around**: 250 + 10 becomes 4. Your code should never rely on that. If you actually want wrapping, or want to handle overflow yourself, integers have methods that say so explicitly:

```rust
fn main() {
    let level: u8 = 250;
    println!("{}", level.wrapping_add(10));   // wraps around to 4
    println!("{}", level.saturating_add(10)); // stops at the maximum, 255
    println!("{:?}", level.checked_add(10));  // None: it would overflow
    println!("{:?}", level.checked_add(5));   // Some(255): it fits
}
```

```text
4
255
None
Some(255)
```

`checked_add` returns an `Option`, a value that is either `Some(result)` or `None`. You will learn to work with `Option` properly in the enums lesson; for now, `{:?}` lets you print it.

## Floating-point numbers

Numbers with a decimal point are **floats**. Rust has `f64` (the default, with about 15 significant digits) and `f32` (smaller and less precise). Stick with `f64` unless you have a reason not to.

```rust
fn main() {
    let price = 2.5;      // f64
    let tax: f32 = 0.2;   // f32
    println!("{}", price * 4.0);
    println!("{}", 7 / 2);       // integer division drops the remainder
    println!("{}", 7 % 2);       // remainder
    println!("{}", 7.0 / 2.0);   // float division
    println!("{}", 0.1 + 0.2);   // floats are approximations
    println!("{tax}");
}
```

```text
10
3
1
3.5
0.30000000000000004
0.2
```

Two things to notice. Dividing two integers gives an integer, rounded toward zero. And `0.1 + 0.2` is not exactly `0.3`, because most decimal fractions cannot be stored exactly in binary. That is true in every language that uses standard floats, not just Rust. Avoid floats for money; count whole cents in an integer instead.

Rust never mixes number types behind your back. You cannot multiply an integer by a float, or even add an `i32` to an `i64`, without converting one of them first:

```rust,compile_fail
fn main() {
    let items = 3;
    let weight = 1.5;
    let total = items * weight;
}
```

```text
error[E0277]: cannot multiply `{integer}` by `{float}`
 --> src/main.rs:4:23
  |
4 |     let total = items * weight;
  |                       ^ no implementation for `{integer} * {float}`
```

This strictness is on purpose. Automatic conversions are a classic source of subtle bugs, such as a fraction quietly being lost. You will see how to convert with `as` shortly.

## Booleans

The `bool` type has exactly two values, `true` and `false`. Comparisons produce booleans, and you combine them with `&&` (and), `||` (or) and `!` (not):

```rust
fn main() {
    let age = 20;
    let has_ticket = true;
    let is_adult = age >= 18;
    let can_enter = is_adult && has_ticket;
    println!("adult: {is_adult}, can enter: {can_enter}, no ticket: {}", !has_ticket);
}
```

```text
adult: true, can enter: true, no ticket: false
```

## Characters

A `char` is a single Unicode character, written in *single* quotes. Double quotes make a string, which is a different type.

```rust
fn main() {
    let letter = 'z';
    let accented = 'é';
    let chinese = '中';
    let infinity = '∞';
    println!("{letter} {accented} {chinese} {infinity}");
    println!("A char is {} bytes", std::mem::size_of::<char>());
}
```

```text
z é 中 ∞
A char is 4 bytes
```

A `char` is always 4 bytes, because it stores a **Unicode scalar value**: any code point from the whole Unicode range, not just English letters. This matters later when you meet strings, which store text much more compactly.

## Tuples

A **tuple** groups a fixed number of values, which can have different types:

```rust
fn main() {
    let player: (&str, i32, f64) = ("Ferris", 7, 98.5);

    // Access a field by position, starting at 0
    println!("{} is level {}", player.0, player.1);

    // Or unpack all of it at once: this is called destructuring
    let (name, level, health) = player;
    println!("{name}: level {level}, health {health}");
}
```

```text
Ferris is level 7
Ferris: level 7, health 98.5
```

Tuples are handy for returning several values from a function, which you will do in the next lesson. The empty tuple `()` is called the **unit** type. It means "no meaningful value", and it is what a function returns when it doesn't return anything.

## Arrays

An **array** holds a fixed number of values that all have the *same* type. Its type is written `[T; N]`: the element type `T` and the length `N`.

```rust
fn main() {
    let bases = ['A', 'C', 'G', 'T'];
    let counts: [u32; 4] = [20, 12, 17, 21]; // how many of each base a DNA string has
    let zeros = [0; 4]; // four zeros

    println!("First base: {}", bases[0]);
    println!("There are {} bases", bases.len());
    println!("G and C together: {}", counts[1] + counts[2]);
    println!("{:?}", zeros);
}
```

```text
First base: A
There are 4 bases
G and C together: 29
[0, 0, 0, 0]
```

The length is part of the type, so an array can never grow or shrink. When you need a list that can change size, you will use a `Vec`, covered in the collections lesson.

Indexing starts at 0, so the last element of a 3-element array is at index 2. What if you go past the end?

```rust,should_panic
fn main() {
    let scores = [90, 72, 85];
    let index = scores.len(); // 3: one past the last element
    println!("{}", scores[index]);
}
```

```text
thread 'main' panicked at src/main.rs:4:20:
index out of bounds: the len is 3 but the index is 3
```

Rust checks every index and panics rather than read memory that doesn't belong to the array. In C, the same mistake quietly reads whatever happens to be next in memory, which is the root of many security holes. (If the index is an obvious constant like `scores[5]`, the compiler catches it before the program even runs.)

## Converting with as

The `as` keyword converts between number types (and between some related types such as `char` and `u32`):

```rust
fn main() {
    let items = 3;
    let weight = 1.5;
    println!("{}", items as f64 * weight);  // 4.5

    println!("{}", 3.99_f64 as i32);  // 3: the fraction is cut off, not rounded
    println!("{}", 300_i32 as u8);    // 44: the high bits are thrown away
    println!("{}", 'A' as u32);       // 65: the character's code point
    println!("{}", 97_u8 as char);    // a
}
```

```text
4.5
3
44
65
a
```

:::warning as never fails, even when it should
`as` always produces *some* value, even when the number doesn't fit. `300 as u8` giving `44` is almost never what you wanted. Use `as` for conversions you know are safe, like `i32` to `f64`. Later in the course you will meet `From` and `TryFrom`, which are safer ways to convert when a value might not fit.
:::

## When inference needs a hint

Usually the compiler infers types from context. Sometimes the context isn't enough. A common example is `parse`, which turns text into a number, but it can produce *many* kinds of number:

```rust,compile_fail
fn main() {
    let n = "42".parse().unwrap();
    println!("{n}");
}
```

```text
error[E0284]: type annotations needed
 --> src/main.rs:2:9
  |
2 |     let n = "42".parse().unwrap();
  |         ^        ----- type must be known at this point
  |
help: consider giving `n` an explicit type
  |
2 |     let n: /* Type */ = "42".parse().unwrap();
  |          ++++++++++++
```

Should `"42"` become an `i32`, a `u8`, an `f64`? The compiler refuses to guess. You can answer by annotating the variable, or by naming the type on the method with the `::<>` syntax (nicknamed the **turbofish**):

```rust
fn main() {
    let a: i32 = "42".parse().unwrap();
    let b = "2.5".parse::<f64>().unwrap();
    println!("{}", a + 1);
    println!("{}", b * 2.0);
}
```

```text
43
5
```

`parse` can fail, for example on the text `"hello"`, so it returns a result that is either the number or an error. `.unwrap()` means "give me the number, or panic if it went wrong". That is fine for small experiments; you will learn to handle errors properly in the error-handling lessons.

## Printing floats with fixed decimals

One last formatting trick before the exercise. `{:.3}` prints a float rounded to three decimal places (any number works in place of 3), and it combines with names as `{x:.3}`:

```rust
fn main() {
    let gc_fraction = 29.0 / 70.0;
    println!("{gc_fraction}");
    println!("{gc_fraction:.3}");
    println!("{:.1}%", gc_fraction * 100.0);
}
```

```text
0.4142857142857143
0.414
41.4%
```

:::rosalind IPRB Mendel's First Law
**The biology.** A gene often comes in two versions (alleles): a dominant `A` and a recessive `a`. Each organism carries two copies, so it is `AA` (homozygous dominant), `Aa` (heterozygous) or `aa` (homozygous recessive). A child inherits one copy from each parent, each parent passing on either of its two copies with equal chance. The child shows the dominant trait unless it ends up `aa`.

**The task.** A population has `k` organisms that are `AA`, `m` that are `Aa` and `n` that are `aa`. Two *different* organisms are picked at random and mate. Print the probability that their child has at least one `A`. The input is the three whole numbers `k m n`; Rosalind expects one decimal number, and answers within 0.001 of the exact value are accepted.

For example, `1 2 3` gives about `0.58333`.

It is easiest to work out the chance of the opposite, an `aa` child, and subtract it from 1. Think of the picks in order: the first organism is chosen from all `t = k + m + n`, the second from the remaining `t - 1`. So there are `t · (t - 1)` ordered pairs, all equally likely. An `aa` child needs both parents to pass on `a`:

| Parents | Ordered pairs | Chance of an `aa` child |
| --- | --- | --- |
| `aa` and `aa` | `n · (n - 1)` | 1 |
| `Aa` and `aa`, either order | `2 · m · n` | 1/2 |
| `Aa` and `Aa` | `m · (m - 1)` | 1/4 |

Any pair that includes an `AA` parent always has a dominant child. Hold the three counts in a tuple, convert them to `f64` before dividing, and print the answer with five decimals.
:::solution
```rust
fn main() {
    // Paste your dataset's three numbers here: k (AA), m (Aa), n (aa).
    let (k, m, n): (u32, u32, u32) = (1, 2, 3);

    // Convert once, up front, so every calculation below is in floating point.
    let k = k as f64;
    let m = m as f64;
    let n = n as f64;
    let total = k + m + n;

    let pairs = total * (total - 1.0);
    let recessive = n * (n - 1.0) * 1.0 + 2.0 * m * n * 0.5 + m * (m - 1.0) * 0.25;

    let dominant = 1.0 - recessive / pairs;
    println!("{dominant:.5}");
}
```

```text
0.58333
```

The conversion is the careful part. If you kept the counts as integers, `recessive / pairs` would be an integer division, and a result such as 12 / 30 would come out as 0. You also can't write `0.25 * m` while `m` is a `u32`: Rust refuses to mix the two types. Converting all three counts with `as` at the start, and shadowing the old names, keeps the rest of the code simple. Going from `u32` to `f64` never loses information, so `as` is safe here.

In the example, `total` is 6, so there are 30 ordered pairs, and the `aa`-producing weight is 6 + 6 + 0.5 = 12.5. That leaves 1 - 12.5 / 30 = 0.58333.
:::

```quiz
? What is the type of `let x = 10;` if nothing else constrains it?
- `u32`
- `i64`
+ `i32`
- `usize`
= Integer literals default to `i32` when the compiler has no other information.

? In a debug build, what happens when `let mut n: u8 = 255; n += 1;` runs?
- `n` becomes 0.
- `n` becomes 256.
+ The program panics with "attempt to add with overflow".
- The compiler rejects it.
= Debug builds check arithmetic and panic on overflow. Release builds wrap around instead, which is why you should use methods like `checked_add` when overflow is possible.

? Which statement about `char` is true?
- It is 1 byte and holds an ASCII character.
+ It is 4 bytes and holds any Unicode scalar value.
- It is written with double quotes.
- It is the same type as a one-letter string.
= A `char` stores a Unicode scalar value in 4 bytes and is written with single quotes, like `'é'`.

? Why does `let n = "42".parse().unwrap();` fail to compile?
- `"42"` is not a valid number.
- `unwrap` is not allowed on `parse`.
- Strings cannot be converted to numbers in Rust.
+ The compiler cannot tell which number type you want.
= `parse` can produce many types. Add an annotation such as `let n: i32` or use the turbofish `parse::<i32>()`.
```
