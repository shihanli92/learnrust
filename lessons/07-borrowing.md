---
title: References and Borrowing
module: Ownership
summary: Use values without taking ownership through shared and mutable references, and learn the borrowing rules that keep them safe.
minutes: 40
---

At the end of the last lesson, getting the length of a string meant moving the string into a function and then passing it back out again. That works, but it is clumsy. Most of the time a function only needs to *look at* a value, or change it briefly, and then hand it back.

Rust's answer is **borrowing**. Instead of giving a function the value itself, you give it a **reference**: a pointer that lets it use the value while the owner keeps ownership. This lesson covers the two kinds of reference and the rules the compiler enforces so a reference can never point at something that has changed out from under it or been freed.

## References with `&`

Here is the length example again, this time with a reference:

```rust
fn length_of(text: &String) -> usize {
    text.len()
} // `text` goes out of scope, but it doesn't own the String, so nothing is dropped

fn main() {
    let s = String::from("borrowing");
    let len = length_of(&s);
    println!("'{s}' has {len} letters");
}
```

```text
'borrowing' has 9 letters
```

Two small changes made the difference. The parameter type is `&String`, "a reference to a String", and the call passes `&s`, which *creates* a reference to `s`. Creating a reference is called **borrowing**, because, as in real life, you use something and give it back; you don't own it.

In memory, the reference is just a pointer to the owner's `String`:

```text
 text (&String)        s (String)                  heap
+-----+           +----------+-----+        +---+---+---+---+-- ...
|  o--+---------> | ptr      |  o--+------> | b | o | r | r | ...
+-----+           | len      |  9  |        +---+---+---+---+-- ...
                  | capacity |  9  |
                  +----------+-----+
```

Because `length_of` only borrowed the string, `s` is still valid afterwards, and it is `main` that drops it at the end of its scope. Notice also that `text.len()` works directly on the reference. When you call a method, Rust follows the reference for you.

## References are read-only by default

Just as variables are immutable by default, so are references. Try to change something through a plain `&` and the compiler refuses:

```rust,compile_fail
fn add_world(text: &String) {
    text.push_str(", world");
}

fn main() {
    let s = String::from("hello");
    add_world(&s);
}
```

```text
error[E0596]: cannot borrow `*text` as mutable, as it is behind a `&` reference
 --> src/main.rs:2:5
  |
2 |     text.push_str(", world");
  |     ^^^^ `text` is a `&` reference, so it cannot be borrowed as mutable
  |
help: consider changing this to be a mutable reference
  |
1 | fn add_world(text: &mut String) {
  |                     +++
```

## Mutable references with `&mut`

To let a function change a borrowed value, use a **mutable reference**, `&mut`. You need `mut` in three places: on the variable (it must be mutable to begin with), on the borrow at the call site, and in the parameter type:

```rust
fn add_world(text: &mut String) {
    text.push_str(", world");
}

fn main() {
    let mut s = String::from("hello");
    add_world(&mut s);
    println!("{s}");
}
```

```text
hello, world
```

The call site `add_world(&mut s)` makes it obvious to a reader that this function may change `s`. There are no hidden modifications.

| | `&T` | `&mut T` |
| --- | --- | --- |
| Name | shared reference | mutable (exclusive) reference |
| Can read the value | Yes | Yes |
| Can change the value | No | Yes |
| How many at once | As many as you like | Exactly one, and no `&T` alongside it |
| Created with | `&x` | `&mut x` (needs `let mut x`) |

## The borrowing rules

The last row of that table is the heart of this lesson. The compiler enforces two rules about references:

1. At any given time, you can have **either** one mutable reference **or** any number of shared references, but not both.
2. References must always be **valid**: a reference can never outlive the value it points to.

Here is rule 1 being broken with two mutable references:

```rust,compile_fail
fn main() {
    let mut s = String::from("hello");

    let r1 = &mut s;
    let r2 = &mut s;

    println!("{r1}, {r2}");
}
```

```text
error[E0499]: cannot borrow `s` as mutable more than once at a time
 --> src/main.rs:5:14
  |
4 |     let r1 = &mut s;
  |              ------ first mutable borrow occurs here
5 |     let r2 = &mut s;
  |              ^^^^^^ second mutable borrow occurs here
6 |
7 |     println!("{r1}, {r2}");
  |                -- first borrow later used here
```

And mixing a shared reference with a mutable one is just as forbidden:

```rust,compile_fail
fn main() {
    let mut s = String::from("hello");

    let r1 = &s;
    let r2 = &mut s;

    println!("{r1}, {r2}");
}
```

```text
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
 --> src/main.rs:5:14
  |
4 |     let r1 = &s;
  |              -- immutable borrow occurs here
5 |     let r2 = &mut s;
  |              ^^^^^^ mutable borrow occurs here
6 |
7 |     println!("{r1}, {r2}");
  |                -- immutable borrow later used here
```

A helpful way to remember the rule: **shared or mutable, never both**. Many readers are fine. One writer is fine. A writer while anyone else is looking is not.

## Why these rules?

The rules may seem strict, but they rule out real bugs that are notoriously hard to find in other languages.

### Changing data out from under a reference

Here is a classic example. It uses a `Vec`, Rust's growable list, which you will study in the collections lesson. For now you only need to know that `vec![...]` creates one and `.push()` adds an element to the end.

```rust,compile_fail
fn main() {
    let mut scores = vec![10, 20, 30];

    let first = &scores[0];
    scores.push(40);

    println!("The first score is {first}");
}
```

```text
error[E0502]: cannot borrow `scores` as mutable because it is also borrowed as immutable
 --> src/main.rs:5:5
  |
4 |     let first = &scores[0];
  |                  ------ immutable borrow occurs here
5 |     scores.push(40);
  |     ^^^^^^^^^^^^^^^ mutable borrow occurs here
6 |
7 |     println!("The first score is {first}");
  |                                   ----- immutable borrow later used here
```

Why is this a problem? A `Vec` keeps its elements in one block of heap memory. If that block is full, `push` allocates a bigger block, copies the elements across, and frees the old one. `first` would then point into freed memory. In C++ this kind of bug (called **reference** or **iterator invalidation**) compiles without complaint. In Rust, the borrowing rules catch it: `push` needs a mutable borrow, and `first` is a shared borrow that is still in use.

### Data races

The same rule protects programs that run several threads at once. A **data race** happens when two threads access the same memory at the same time, at least one of them writes, and nothing coordinates them. The results are unpredictable and the bug may only show up once in a thousand runs. "One writer, or many readers, never both" is exactly the condition that makes data races impossible, so Rust rejects them at compile time.

## A borrow ends at its last use

The rules are about references that are *in use* at the same time. A reference's borrow lasts from where it is created to the last place it is used, not necessarily to the end of the scope. This is called **non-lexical lifetimes**, and it means this program is fine:

```rust
fn main() {
    let mut s = String::from("hello");

    let r1 = &s;
    let r2 = &s;
    println!("{r1} and {r2}"); // last use of r1 and r2: their borrows end here

    let r3 = &mut s; // allowed: no shared borrows are still in use
    r3.push_str(", world");
    println!("{r3}");
}
```

```text
hello and hello
hello, world
```

Often the fix for a borrow error is simply to reorder your code so one borrow is finished before the next begins.

## Dangling references are impossible

Rule 2 says a reference must never outlive the value it points to. In C, it is easy to return a pointer to a local variable that no longer exists, a **dangling pointer**. Try it in Rust:

```rust,compile_fail
fn dangle() -> &String {
    let s = String::from("hello");
    &s
} // `s` is dropped here, so a reference to it would point at freed memory

fn main() {
    let r = dangle();
}
```

```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:16
  |
1 | fn dangle() -> &String {
  |                ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but there is no value for it to be borrowed from
help: instead, you are more likely to want to return an owned value
  |
1 - fn dangle() -> &String {
1 + fn dangle() -> String {
  |
```

The message mentions *lifetimes*, which you will meet properly in the lifetimes lesson. The important line is the `help`: the function returns a borrowed value, "but there is no value for it to be borrowed from". The `String` is created inside `dangle` and dropped when `dangle` ends. The fix is to return the `String` itself, moving ownership to the caller:

```rust
fn no_dangle() -> String {
    let s = String::from("hello");
    s // ownership moves out; nothing is dropped
}

fn main() {
    let r = no_dangle();
    println!("{r}");
}
```

```text
hello
```

## Dereferencing with `*`

A reference is a pointer, not the value itself. To get at the value it points to, you **dereference** it with `*`. This matters most when you change a value through a `&mut`:

```rust
fn add_bonus(score: &mut i32) {
    *score += 10; // change the i32 that `score` points to
}

fn main() {
    let mut score = 50;
    add_bonus(&mut score);
    add_bonus(&mut score);

    let r = &score;
    println!("score is {r}");       // println! follows the reference for you
    println!("is it 70? {}", *r == 70);
}
```

```text
score is 70
is it 70? true
```

Without the `*`, `score += 10` would try to add 10 to the *reference*, which makes no sense, and the compiler tells you so. Likewise, `r == 70` doesn't compile, because it compares a reference with a number; the compiler suggests adding `*`.

You often don't need `*`: method calls like `text.len()` and macros like `println!` follow references automatically. Reach for `*` when you read or assign a value through a reference with operators like `=`, `+=` or `==`.

:::tip How to read borrow errors
Borrow errors always point to two or three places: where the first borrow is created, where the conflicting borrow happens, and where the first borrow is *later used*. That last one is the key. Either move the conflicting line after that last use, or shorten how long you hold the first reference.
:::

:::exercise Fix the list
This program keeps a list of the positions where a pattern was found in a DNA string. It fails with E0502. Find two different ways to fix it.

```rust,compile_fail
fn main() {
    let mut positions = vec![3, 9, 14];
    let last = &positions[2];
    positions.push(21);
    println!("The old last match was at position {last}");
}
```
:::solution
Fix 1: finish using the borrow before changing the list.

```rust
fn main() {
    let mut positions = vec![3, 9, 14];
    let last = &positions[2];
    println!("The old last match was at position {last}");
    positions.push(21);
}
```

Fix 2: don't borrow at all. The elements are `i32`, which is `Copy`, so you can copy the value out:

```rust
fn main() {
    let mut positions = vec![3, 9, 14];
    let last = positions[2]; // a copy, not a reference
    positions.push(21);
    println!("The old last match was at position {last}");
}
```

Both print:

```text
The old last match was at position 14
```
:::

:::rosalind REVC Complementing a Strand of DNA
**The biology.** DNA has two strands that run in opposite directions, and they pair letter by letter: `A` with `T`, and `C` with `G`. So if you know one strand you know the other. To read the partner strand in its own direction, you reverse the sequence and swap every letter for its partner. The result is called the **reverse complement**. For example, the partner of `AACG` is `CGTT`.

**The task.** The input is one DNA string (up to 1000 letters). Print its reverse complement. For example, `GATTACAGGCTAACGT` gives `ACGTTAGCCTGTAATC`.

**Part 1.** Write `fn reverse_complement(dna: &str) -> String`. The function only needs to *read* the DNA, so it borrows it; it builds and returns a new, owned `String`. (`&str` is the type of borrowed text, such as a string literal; the next lesson explains how it relates to `String`.) Just as `(1..=4).rev()` walks a range backwards, `dna.chars().rev()` gives you the characters from last to first. Push each one's partner onto a `String::new()`.

**Part 2.** Complement a sequence *in place*, without building a second copy, by writing `fn reverse_complement_in_place(seq: &mut Vec<u8>)`. It works on the raw bytes of the text, which you can compare with byte literals like `b'A'` from the types lesson. Useful tools:

- `dna.as_bytes().to_vec()` turns text into a `Vec<u8>` you own, one byte per letter.
- `seq.reverse()` reverses a `Vec` in place.
- `for base in seq.iter_mut()` hands you a `&mut u8` for each element in turn, so `*base = ...` overwrites it.
- `String::from_utf8(seq).unwrap()` turns the bytes back into a `String` at the end. Like `parse`, it can fail (not every list of bytes is valid text), hence the `unwrap`.
:::solution
Part 1:

```rust
fn reverse_complement(dna: &str) -> String {
    let mut result = String::new();
    for base in dna.chars().rev() {
        if base == 'A' {
            result.push('T');
        } else if base == 'T' {
            result.push('A');
        } else if base == 'C' {
            result.push('G');
        } else if base == 'G' {
            result.push('C');
        }
    }
    result
}

fn main() {
    let dna = "GATTACAGGCTAACGT".trim(); // paste your dataset between the quotes
    println!("{}", reverse_complement(dna));
}
```

```text
ACGTTAGCCTGTAATC
```

Any character that isn't one of the four bases is skipped, so a newline left over from pasting can't sneak into the answer.

Part 2:

```rust
fn complement(base: u8) -> u8 {
    if base == b'A' {
        b'T'
    } else if base == b'T' {
        b'A'
    } else if base == b'C' {
        b'G'
    } else if base == b'G' {
        b'C'
    } else {
        base
    }
}

fn reverse_complement_in_place(seq: &mut Vec<u8>) {
    seq.reverse();
    for base in seq.iter_mut() {
        *base = complement(*base); // read the byte, then overwrite it
    }
}

fn main() {
    let dna = "GATTACAGGCTAACGT".trim(); // paste your dataset between the quotes
    let mut seq = dna.as_bytes().to_vec();
    reverse_complement_in_place(&mut seq);
    println!("{}", String::from_utf8(seq).unwrap());
}
```

```text
ACGTTAGCCTGTAATC
```

The `&mut` in the call `reverse_complement_in_place(&mut seq)` tells every reader that `seq` is about to change. Inside the loop, `base` is a `&mut u8`, so `*base` on the right reads the byte it points to and `*base =` on the left writes a new one. Part 1 is simpler and usually what you want. Part 2 pays off when sequences are huge: a human chromosome has hundreds of millions of letters, and changing them in place avoids holding two copies in memory.
:::

```quiz
? Which combination of references to the same value is allowed at the same time?
- One `&mut` and one `&`
- Two `&mut`
+ Three `&`
- One `&mut` and three `&`
= You may have any number of shared references, or exactly one mutable reference, but never a mutable reference alongside any other reference.

? What does it mean to borrow a value?
+ To create a reference to it, so you can use it without taking ownership.
- To copy it onto the heap.
- To move it into a function temporarily.
- To make it mutable.
= Borrowing creates a reference. The original owner keeps ownership and is still responsible for dropping the value.

? Why does this compile? `let r1 = &s; println!("{r1}"); let r2 = &mut s; r2.push_str("!");`
- Because `println!` copies `r1`.
- Because `s` is a `String`.
- It doesn't compile.
+ Because `r1` is last used before `r2` is created, so the borrows don't overlap.
= With non-lexical lifetimes, a borrow ends at its last use, not at the end of the scope.

? What does the `*` do in `*count += 1` when `count: &mut i32`?
- Multiplies `count` by 1.
- Creates a new reference.
+ Dereferences `count` to change the `i32` it points to.
- Makes `count` mutable.
= `*` follows the reference to the value behind it, so `+=` updates that value rather than the reference.
```
