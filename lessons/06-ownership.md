---
title: Ownership
module: Ownership
summary: Learn how Rust manages memory without a garbage collector: owners, moves, clones, Copy types and drop.
minutes: 35
---

Ownership is the idea that makes Rust different from almost every other language. It is how Rust frees memory safely without a garbage collector, and it is the reason for most of the compiler errors you will see as a beginner. Once it clicks, those errors stop being mysterious and start being helpful.

Every program has to manage memory: ask for it when data is created, and give it back when the data is no longer needed. Some languages, such as Python, Java and Go, use a **garbage collector** that finds unused memory while the program runs. Others, such as C, make you free memory by hand, and forgetting (or doing it twice) causes crashes and security holes. Rust takes a third path: a small set of **ownership rules** that the compiler checks. If your code breaks them, it does not compile. If it compiles, memory is freed at exactly the right moment, with no runtime cost.

## The stack and the heap

To see why ownership matters, you need a rough picture of where values live while a program runs. There are two regions of memory:

- The **stack** holds values whose size is known at compile time: integers, floats, `bool`, `char`, and tuples and arrays made of them. Each function call gets a slot on the stack for its local variables, and the slot is thrown away when the function returns. It is very fast and completely automatic.
- The **heap** holds data whose size is only known while the program runs, or that can grow, such as a piece of text the user typed. The program asks for heap space, gets back a **pointer** (the address of that space), and must eventually give it back.

Stack values clean themselves up. Heap memory is the tricky part: something has to decide *when* it is safe to free it. Free it too early and other code reads garbage; free it twice and the program can crash or be exploited; never free it and memory leaks. Ownership is Rust's answer to "who frees this, and when?"

:::note A simplified model
Real compilers are cleverer than this picture, but "fixed-size values on the stack, growable data on the heap behind a pointer" is exactly the right mental model for learning ownership.
:::

## The three rules

Everything in this module follows from three rules:

1. Each value in Rust has an **owner**, a variable that is responsible for it.
2. There can be only **one owner** at a time.
3. When the owner goes **out of scope**, the value is **dropped**: its memory is freed.

A scope is the region between a pair of curly braces. A variable is valid from where it is declared until the closing brace of its scope:

```rust
fn main() {
    {                       // `name` is not valid yet
        let name = "Ferris"; // `name` is valid from here...
        println!("{name}");
    }                       // ...to here. The scope ends, `name` is gone.
    println!("done");
}
```

```text
Ferris
done
```

## String: a value on the heap

To see the rules at work you need a type that uses the heap. Text literals like `"Ferris"` are fixed and baked into the program, so they are a poor example. The `String` type is growable text, and its contents live on the heap:

```rust
fn main() {
    let mut greeting = String::from("hello");
    greeting.push_str(", world"); // grows the text: needs heap memory
    println!("{greeting}");
}
```

```text
hello, world
```

A `String` is made of two parts. On the stack there is a small, fixed-size record with three fields: a pointer to the text, its length, and its capacity (how much heap space is reserved). The characters themselves are on the heap:

```text
 greeting (stack)                heap
+----------+-----+        +---+---+---+---+---+
| ptr      |  o--+------> | h | e | l | l | o |
| len      |  5  |        +---+---+---+---+---+
| capacity |  5  |
+----------+-----+
```

When `greeting` goes out of scope, Rust automatically calls a cleanup function called `drop`, which frees the heap memory. You never write `free` yourself. The owner leaving scope is the signal.

## Moves

Now the interesting part. What happens when you assign one `String` to another variable?

```rust,compile_fail
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;

    println!("{s1}, world!");
}
```

```text
error[E0382]: borrow of moved value: `s1`
 --> src/main.rs:5:16
  |
2 |     let s1 = String::from("hello");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here
4 |
5 |     println!("{s1}, world!");
  |                ^^ value borrowed here after move
  |
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let s2 = s1.clone();
  |                ++++++++
```

`let s2 = s1;` copies the small stack record (pointer, length, capacity) into `s2`. The heap text is *not* copied. For a moment, two records point at the same heap memory:

```text
   s1 (stack)                       heap
+----------+-----+
| ptr      |  o--+------+
| len      |  5  |      |      +---+---+---+---+---+
| capacity |  5  |      +----> | h | e | l | l | o |
+----------+-----+      |      +---+---+---+---+---+
   s2 (stack)           |
+----------+-----+      |
| ptr      |  o--+------+
| len      |  5  |
| capacity |  5  |
+----------+-----+
```

That is dangerous. When both `s1` and `s2` go out of scope, both would try to free the same memory, a bug called a **double free**. Rule 2 prevents it: a value has only one owner. So instead of sharing, Rust **moves** ownership from `s1` to `s2`, and `s1` is no longer usable. Only `s2` will free the memory. If you try to use `s1`, you get error E0382, "use of moved value" (here worded as "borrow of moved value", because `println!` borrows its arguments).

The key facts about a move:

- It is cheap: only the few bytes on the stack are copied, however long the text is.
- The old variable is invalid afterwards, and the compiler enforces it.
- Rust never copies heap data behind your back. Any expensive copy is visible in your code.

## Clone: an explicit deep copy

If you really want two independent strings, ask for a copy with `.clone()`:

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1.clone(); // copies the heap data too

    println!("s1 = {s1}, s2 = {s2}");
}
```

```text
s1 = hello, s2 = hello
```

Now there are two separate heap allocations, each with its own owner, and each is freed once. Cloning costs time and memory in proportion to the size of the data, which is exactly why Rust makes you write it out. When you see `.clone()` in code, you know a copy is being made.

:::tip Don't be afraid of clone while learning
Sprinkling `.clone()` to get past an error is fine while you learn. The next lesson shows how **borrowing** lets you use a value without copying it or taking ownership, which is usually the better fix.
:::

## Copy types

This code looks like it should fail in the same way, but it works:

```rust
fn main() {
    let x = 5;
    let y = x;
    println!("x = {x}, y = {y}");
}
```

```text
x = 5, y = 5
```

An integer has a known, fixed size and lives entirely on the stack. It owns no heap memory, so copying it is as cheap as moving it, and there is nothing to free twice. Types like this implement the **`Copy`** trait (a trait is a shared behaviour; you will learn about them later). When you assign a `Copy` value, it is copied and the original stays valid.

| Copy (duplicated on assignment) | Not Copy (moved on assignment) |
| --- | --- |
| All integers: `i32`, `u8`, `usize`, ... | `String` |
| `f32`, `f64` | Anything that owns heap memory, such as `Vec` |
| `bool`, `char` | Tuples or arrays containing any non-Copy type |
| Tuples and arrays of Copy types, e.g. `(i32, bool)`, `[f64; 3]` | |

A good rule of thumb: if a type owns something on the heap that must be freed, it is not `Copy`.

## Ownership and functions

Passing a value to a function works exactly like assigning it to a variable: a `String` is moved into the function's parameter, while an `i32` is copied.

```rust,compile_fail
fn print_it(text: String) {
    println!("{text}");
} // `text` goes out of scope here, and the String is dropped

fn main() {
    let s = String::from("hello");
    print_it(s); // ownership moves into print_it
    println!("{s}"); // error: `s` was moved
}
```

```text
error[E0382]: borrow of moved value: `s`
 --> src/main.rs:8:16
  |
6 |     let s = String::from("hello");
  |         - move occurs because `s` has type `String`, which does not implement the `Copy` trait
7 |     print_it(s); // ownership moves into print_it
  |              - value moved here
8 |     println!("{s}"); // error: `s` was moved
  |                ^ value borrowed here after move
```

Once `s` is passed to `print_it`, the function owns the string. When the function ends, its parameter goes out of scope and the string is freed. There is nothing left for `main` to use.

Returning a value moves ownership back out to the caller:

```rust
fn add_exclamation(mut text: String) -> String {
    text.push_str("!"); // we own it, so we may change it
    text                // ownership moves out to the caller
}

fn double(n: i32) -> i32 {
    n * 2
}

fn main() {
    let s = String::from("hello");
    let s = add_exclamation(s); // move in, get it back
    println!("{s}");

    let n = 21;
    let d = double(n); // `n` is copied, so it is still usable
    println!("{n} doubled is {d}");
}
```

```text
hello!
21 doubled is 42
```

The `mut` on the parameter is allowed because the function owns `text` outright and can do what it likes with it.

### Handing things back is tedious

Suppose you want a function that tells you how long a string is, and you still want the string afterwards. With only moves, you have to pass the string back along with the answer:

```rust
fn length_of(text: String) -> (String, usize) {
    let length = text.len();
    (text, length) // give the String back, plus the result
}

fn main() {
    let s = String::from("ownership");
    let (s, len) = length_of(s);
    println!("'{s}' has {len} letters");
}
```

```text
'ownership' has 9 letters
```

It works, but it is clumsy. What you really want is to let the function *look at* the string without taking it. That is borrowing, and it is the topic of the next lesson.

## Drop: cleanup at the end of scope

It helps to *see* when values are dropped. The example below defines a small type, `Noisy`, that prints a message when it is dropped. Don't worry about the `struct` and `impl Drop` syntax yet; structs and traits come later in the course. Just watch the order of the output. (The underscores in `_a` and `_b` only silence the unused-variable warning; they are still ordinary variables that own their values until the end of their scope.)

```rust
struct Noisy {
    name: String,
}

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("dropping {}", self.name);
    }
}

fn consume(item: Noisy) {
    println!("consume now owns {}", item.name);
} // `item` goes out of scope: dropped here

fn main() {
    let _a = Noisy { name: String::from("a") };
    {
        let _b = Noisy { name: String::from("b") };
        println!("inner scope ends");
    } // `_b` dropped here

    let c = Noisy { name: String::from("c") };
    consume(c); // ownership of `c` moves into consume

    println!("main ends");
} // `_a` dropped here
```

```text
inner scope ends
dropping b
consume now owns c
dropping c
main ends
dropping a
```

Each value is dropped exactly once, at the end of its owner's scope. `c` was moved into `consume`, so it is dropped when `consume` finishes, not at the end of `main`. When several values go out of scope together, they are dropped in the reverse order they were created.

This pattern, tying cleanup to the owner's scope, works for more than memory. Files close and network connections shut when their owners go out of scope, so you can't forget to release them.

:::exercise Report twice
This program fails with E0382. Fix it in two different ways: first by cloning, then by changing `report` so it gives the string back.

```rust,compile_fail
fn report(dna: String) {
    println!("{dna} has {} bases", dna.len());
}

fn main() {
    let dna = String::from("GATTACA");
    report(dna);
    report(dna);
}
```
:::solution
Fix 1: pass a clone the first time, so `main` keeps its own copy:

```rust
fn report(dna: String) {
    println!("{dna} has {} bases", dna.len());
}

fn main() {
    let dna = String::from("GATTACA");
    report(dna.clone());
    report(dna);
}
```

Fix 2: have `report` return ownership:

```rust
fn report(dna: String) -> String {
    println!("{dna} has {} bases", dna.len());
    dna
}

fn main() {
    let dna = String::from("GATTACA");
    let dna = report(dna);
    report(dna);
}
```

Both print:

```text
GATTACA has 7 bases
GATTACA has 7 bases
```

The next lesson shows the tidiest fix of all: let `report` borrow the string.
:::

:::rosalind RNA Transcribing DNA into RNA
**The biology.** To use a gene, a cell first copies it from DNA into RNA, a step called **transcription**. The RNA copy has the same sequence, except that every `T` (thymine) becomes a `U` (uracil).

**The task.** The input is one DNA string (up to 1000 letters). Print the RNA string you get by replacing every `T` with `U`. For example, `GATTACAGGCTAACGT` becomes `GAUUACAGGCUAACGU`.

Write a function `fn transcribe(dna: String) -> String` that takes ownership of the DNA and returns a brand-new `String` holding the RNA. Two things you haven't seen yet will help:

- `String::new()` creates an empty `String`. Declare it `mut` so you can add to it.
- `rna.push(c)` appends a single `char` to the end, much as `push_str` appends text.

Loop over `dna.chars()` as in the previous lesson, pushing either `'U'` or the base itself. Start `main` with `let dna = String::from("...".trim());`, pasting your dataset between the quotes.
:::solution
```rust
fn transcribe(dna: String) -> String {
    let mut rna = String::new();
    for base in dna.chars() {
        if base == 'T' {
            rna.push('U');
        } else {
            rna.push(base);
        }
    }
    rna // ownership of the new String moves out to the caller
} // `dna` goes out of scope here and its memory is freed

fn main() {
    let dna = String::from("GATTACAGGCTAACGT".trim()); // paste your dataset
    let rna = transcribe(dna);
    println!("{rna}");
}
```

```text
GAUUACAGGCUAACGU
```

Follow the ownership: `dna` moves into `transcribe`, which builds `rna`, moves it back out to `main`, and drops the DNA when it finishes. After the call, `main` can't use `dna` any more, and doesn't need to.

**The one-liner.** Strings have a `replace` method that does the whole job and returns a new `String`:

```rust
fn main() {
    let dna = String::from("GATTACAGGCTAACGT".trim()); // paste your dataset
    let rna = dna.replace('T', "U"); // `dna` is still usable after this line
    println!("{rna}");
}
```

```text
GAUUACAGGCUAACGU
```

Notice that `replace` did *not* take ownership: you could still print `dna` afterwards. That is because `replace` only needs to read the text, so it borrows it instead. Borrowing is exactly what the next lesson is about.
:::

```quiz
? Which of these is one of Rust's three ownership rules?
- Every value must be cloned before it is used twice.
+ When the owner goes out of scope, the value is dropped.
- Heap values have one owner per function.
- Values are freed by a garbage collector when no longer used.
= The rules are: each value has an owner, there is only one owner at a time, and the value is dropped when its owner goes out of scope.

? After `let s1 = String::from("hi"); let s2 = s1;`, what is true?
- `s1` and `s2` both own the same heap data.
- The heap text was copied, so there are two strings.
+ Ownership moved to `s2`, and using `s1` is a compile error.
- `s1` becomes an empty string.
= Assigning a `String` moves it. Only the stack record is copied, and the old variable is invalidated so the memory can't be freed twice.

? Why is `i32` a `Copy` type but `String` is not?
- `String` is too long to copy.
- `i32` values are always constants.
+ `String` owns heap memory that must be freed exactly once; `i32` owns nothing that needs freeing.
- `Copy` is only for numbers.
= A type can be `Copy` only if duplicating its bits is a complete, safe copy. A `String` owns a heap allocation, so a bitwise copy would lead to a double free.

? When is a `String` that was passed by value into a function dropped (assuming the function doesn't return it)?
- At the end of `main`.
+ When the function's body ends.
- Immediately after the call site line.
- Never; it leaks.
= The parameter becomes the new owner, so the string is dropped when the parameter goes out of scope at the end of the function.
```
