---
title: Generics
module: Abstraction
summary: Write functions, structs and enums that work for many types at once, without losing speed or type safety.
minutes: 35
---

You have already used generic types without writing any: `Vec<i32>` and `Vec<String>` are the same `Vec` code holding different types, and `Option<T>` works for any `T`. **Generics** are how that works. They let you write code once with a placeholder type, and have the compiler fill in the real types wherever the code is used.

This lesson shows how to write your own generic functions, structs, enums and methods, and why doing so costs nothing at run time. Generics and the next lesson's topic, traits, go hand in hand, so you'll get a first taste of traits here too.

## The problem: duplicated code

Here are two functions that find the largest item in a slice:

```rust
fn largest_i32(list: &[i32]) -> &i32 {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn largest_char(list: &[char]) -> &char {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    println!("{}", largest_i32(&[34, 50, 25, 100, 65]));
    println!("{}", largest_char(&['y', 'm', 'a', 'q']));
}
```

```text
100
y
```

The bodies are identical; only the types differ. Copy-pasting like this means every bug fix has to be made twice. Generics let you write the function once.

## Generic functions

You declare a **type parameter** in angle brackets after the function name, then use it like any other type. By convention type parameters are short, capitalised names, usually starting with `T` for "type".

A first attempt fails, and the error is instructive:

```rust,compile_fail
fn largest<T>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    println!("{}", largest(&[1, 2, 3]));
}
```

```text
error[E0369]: binary operation `>` cannot be applied to type `&T`
 --> src/main.rs:4:17
  |
4 |         if item > largest {
  |            ---- ^ ------- &T
  |            |
  |            &T
  |
help: consider restricting type parameter `T` with trait `PartialOrd`
  |
1 | fn largest<T: std::cmp::PartialOrd>(list: &[T]) -> &T {
  |             ++++++++++++++++++++++
```

`T` could be *any* type, including ones that can't be compared, such as a struct you just defined. Rust checks a generic function once, for every possible `T`, so it refuses to let you use `>` unless you promise that `T` supports it.

You make that promise with a **trait bound**. `PartialOrd` is the standard trait for types that can be compared with `<` and `>`. Writing `T: PartialOrd` means "any type `T`, as long as it implements `PartialOrd`":

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    println!("{}", largest(&[34, 50, 25, 100, 65]));
    println!("{}", largest(&['y', 'm', 'a', 'q']));
    println!("{}", largest(&[1.5, -2.0, 0.25]));
    println!("{}", largest(&["pear", "apple", "zucchini"]));
}
```

```text
100
y
1.5
zucchini
```

One function now works for integers, characters, floats and strings. You didn't have to say which `T` to use at each call; the compiler **infers** it from the argument. The bound is also the function's contract with its callers: pass something that isn't `PartialOrd` and you get a clear error at the call site.

One caveat: `&list[0]` panics if the slice is empty, so calling `largest` on an empty slice crashes the program. A more careful version would return `Option<&T>` (`None` for an empty slice); this lesson keeps the simple version so the focus stays on generics.

:::note Coming from C++ or Java
A generic body is type-checked once, against its bounds, like a C++20 concept or a Java bounded generic (`<T extends Comparable<T>>`), not at each instantiation like a C++ template. But unlike Java's type erasure, the compiled code is monomorphized like a C++ template (see below), so `T` can be a plain `i32` with no boxing.
:::

Traits and bounds are the subject of the next lesson. For now, remember that a bare `T` lets you do almost nothing with a value except move it around, and bounds unlock more operations.

## Generic structs

Structs can have type parameters too. The parameter goes after the struct name, and the fields use it:

```rust
#[derive(Debug)]
struct Point<T> {
    x: T,
    y: T,
}

fn main() {
    let integer = Point { x: 5, y: 10 };
    let float = Point { x: 1.0, y: 4.5 };
    println!("{integer:?} {float:?}");
}
```

```text
Point { x: 5, y: 10 } Point { x: 1.0, y: 4.5 }
```

Both fields use the same `T`, so they must have the same type. `Point { x: 5, y: 4.5 }` won't compile, because `T` can't be an integer and a float at the same time:

```rust,compile_fail
struct Point<T> {
    x: T,
    y: T,
}

fn main() {
    let wont_work = Point { x: 5, y: 4.5 };
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:7:38
  |
7 |     let wont_work = Point { x: 5, y: 4.5 };
  |                                      ^^^ expected integer, found floating-point number
```

If you want the fields to be allowed to differ, use two type parameters:

```rust
#[derive(Debug)]
struct Pair<T, U> {
    first: T,
    second: U,
}

fn main() {
    let a = Pair { first: 5, second: 4.5 };
    let b = Pair { first: "id", second: 'x' };
    println!("{a:?}\n{b:?}");
}
```

```text
Pair { first: 5, second: 4.5 }
Pair { first: "id", second: 'x' }
```

You can have as many type parameters as you like, but more than two or three usually means the type is trying to do too much.

## Generic enums

You've been using generic enums since the Enums lesson. Now their definitions should make complete sense:

```rust,ignore
enum Option<T> {
    Some(T),
    None,
}

enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

`Option<T>` is "a `T`, or nothing", for any `T`. `Result<T, E>` has two type parameters because the success and error types are independent. Your own enums can do the same. Here is a small enum that holds either one item or two of the same type:

```rust
#[derive(Debug)]
enum OneOrTwo<T> {
    One(T),
    Two(T, T),
}

fn main() {
    let a = OneOrTwo::One("solo");
    let b = OneOrTwo::Two(3, 4);
    println!("{a:?} {b:?}");
}
```

```text
One("solo") Two(3, 4)
```

## Methods on generic types

To write methods for a generic struct, declare the type parameter on the `impl` as well:

```rust
#[derive(Debug)]
struct Point<T> {
    x: T,
    y: T,
}

impl<T> Point<T> {
    fn new(x: T, y: T) -> Self {
        Point { x, y }
    }

    fn x(&self) -> &T {
        &self.x
    }

    fn swap(self) -> Point<T> {
        Point { x: self.y, y: self.x }
    }
}

// Only for Point<f64>: other Point types don't get this method.
impl Point<f64> {
    fn distance_from_origin(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

fn main() {
    let p = Point::new(3.0, 4.0);
    println!("x = {}, distance = {}", p.x(), p.distance_from_origin());

    let q = Point::new('a', 'b').swap();
    println!("{q:?}");
    // q.distance_from_origin(); // error: no such method for Point<char>
}
```

```text
x = 3, distance = 5
Point { x: 'b', y: 'a' }
```

Read `impl<T> Point<T>` as "for every type `T`, here are methods on `Point<T>`". The first `<T>` *declares* the parameter; the second *uses* it. Without the first one, Rust would look for a concrete type actually named `T`.

The second block, `impl Point<f64>`, has no `<T>` because it isn't generic: it adds methods only to points of `f64`. That's useful when a method only makes sense for some types, such as `sqrt`, which exists on floats but not integers. You can have both kinds of `impl` block for the same struct, which is one reason Rust allows multiple `impl` blocks.

You can also put bounds on an `impl` block, so the methods only exist when `T` supports what they need:

```rust
struct Pair<T> {
    a: T,
    b: T,
}

impl<T: PartialOrd + std::fmt::Display> Pair<T> {
    fn print_larger(&self) {
        if self.a >= self.b {
            println!("the larger is {}", self.a);
        } else {
            println!("the larger is {}", self.b);
        }
    }
}

fn main() {
    Pair { a: 3, b: 9 }.print_larger();
    Pair { a: "kiwi", b: "fig" }.print_larger();
}
```

```text
the larger is 9
the larger is kiwi
```

`PartialOrd + std::fmt::Display` means `T` must implement *both* traits: one to compare, one to print with `{}`.

## Zero cost: monomorphization

In some languages, such as Java, generic code can be slower than hand-written code, because values are boxed up and methods looked up at run time. Rust takes a different approach called **monomorphization** (from Greek: "making into one form").

When the compiler sees `largest(&[1, 2, 3])` and `largest(&['a', 'b'])`, it generates a separate, specialised copy of `largest` for each type actually used, much as if you'd written `largest_i32` and `largest_char` by hand, as you did at the start of the lesson. Each copy is optimised for its type.

| | Generic code in Rust |
| --- | --- |
| Run-time speed | Same as hand-written code for each type |
| Type checking | At compile time, once, against the bounds |
| Cost | Longer compile times and a somewhat larger binary, since each used type gets its own copy |

That's the deal Rust usually offers: abstractions that are free at run time, paid for at compile time. The Traits lesson will show the alternative, **dynamic dispatch**, for the cases where you want one copy of the code instead.

:::tip You rarely need turbofish
Type inference usually works out the type parameters. When it can't, you can say them explicitly with the turbofish, as you did with `parse::<i32>()`: for example `Vec::<u8>::new()` or `largest::<f64>(&values)`.
:::

:::rosalind PERM Enumerating Gene Orders
Genomes get rearranged over evolutionary time: whole blocks of genes are cut out, flipped and moved. Comparing the order of the same genes in two species (say, humans and mice) tells biologists how their genomes have been shuffled since they split. A first step is simply listing every possible order of *n* genes, which is every **permutation** of the numbers 1 to *n*.

Given a positive integer *n* ≤ 7, print the total number of permutations of 1, 2, ..., *n* on the first line, followed by every permutation on its own line, with the numbers separated by spaces. Any order of the permutations is accepted.

Make the core of the solution generic, because nothing about reordering depends on the items being numbers:

```rust,ignore
fn permutations<T: Clone>(items: &[T]) -> Vec<Vec<T>>
```

A neat way to build it is **recursion**, a function calling itself on a smaller problem. The permutations of an empty slice are just one empty list. Otherwise, for each position `i`, put `items[i]` first and follow it with every permutation of the remaining items. `items.to_vec()` makes an owned copy you can `remove(i)` from, which is why `T` must be `Clone`.

For printing, write a second small generic function `fn join<T: Display>(items: &[T], separator: &str) -> String`, which works for anything printable with `{}`. Read the dataset with the file-or-sample pattern from the Errors lesson. For `n = 3` the output is:

```text
6
1 2 3
1 3 2
2 1 3
2 3 1
3 1 2
3 2 1
```
:::solution
```rust
use std::error::Error;
use std::fmt::Display;

const SAMPLE: &str = "3\n";

/// Every ordering of `items`. Works for any element type that can be cloned.
fn permutations<T: Clone>(items: &[T]) -> Vec<Vec<T>> {
    if items.is_empty() {
        return vec![Vec::new()]; // exactly one way to order nothing
    }
    let mut result = Vec::new();
    for i in 0..items.len() {
        // Pick items[i] to go first, then order the remaining items every possible way.
        let mut rest = items.to_vec();
        let first = rest.remove(i);
        for mut perm in permutations(&rest) {
            perm.insert(0, first.clone());
            result.push(perm);
        }
    }
    result
}

/// Joins any printable items with a separator: [1, 2, 3] -> "1 2 3".
fn join<T: Display>(items: &[T], separator: &str) -> String {
    let mut text = String::new();
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            text.push_str(separator);
        }
        text.push_str(&item.to_string());
    }
    text
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let n: u32 = input.trim().parse()?;

    let mut numbers = Vec::new();
    for k in 1..=n {
        numbers.push(k);
    }

    let perms = permutations(&numbers);
    println!("{}", perms.len());
    for p in &perms {
        println!("{}", join(p, " "));
    }
    Ok(())
}
```

```text
6
1 2 3
1 3 2
2 1 3
2 3 1
3 1 2
3 2 1
```

Nothing in `permutations` mentions numbers: `permutations(&['A', 'C', 'G'])` or `permutations(&["gene1", "gene2"])` would work just as well, and the compiler generates a specialised copy for each element type you use. The bound `T: Clone` is exactly what the body needs (to copy `first` into each result), and nothing more. With *n* = 7 there are 5040 permutations, so the recursion does plenty of copying, but it still finishes in a blink.
:::

:::rosalind LEXF Enumerating k-mers Lexicographically
A **k-mer** is a short string of length *k* taken from some alphabet. Listing every possible k-mer is a common building block: for example, counting how often each 3-letter DNA word appears in a genome starts from the list of all 64 of them.

The dataset has two lines. The first is an ordered alphabet of at most 10 symbols, separated by spaces. The second is a positive integer *n* ≤ 10. Print every string of length *n* that can be formed from the alphabet, one per line, in **lexicographic order**: sorted like a dictionary, but using the order of the alphabet as given, not the usual A to Z. So if the alphabet is `T A G`, then `T` comes before `A`.

Write it as a generic function over the symbol type:

```rust,ignore
fn kmers<T: Clone>(alphabet: &[T], n: usize) -> Vec<Vec<T>>
```

Build the strings up one symbol at a time. Start with a list holding one empty sequence. Then, *n* times, replace the list with a longer one: for each existing sequence, in order, and each symbol, in alphabet order, add the sequence with that symbol appended. Because the outer loop keeps the old order and the inner loop follows the alphabet, the result comes out in lexicographic order with no sorting needed.

Use `join` from the PERM exercise with an empty separator to print each k-mer. For this sample:

```text
T A G
2
```

the output is:

```text
TT
TA
TG
AT
AA
AG
GT
GA
GG
```
:::solution
```rust
use std::error::Error;
use std::fmt::Display;

const SAMPLE: &str = "T A G\n2\n";

/// All sequences of length `n` over `alphabet`, in the alphabet's order.
fn kmers<T: Clone>(alphabet: &[T], n: usize) -> Vec<Vec<T>> {
    let mut result: Vec<Vec<T>> = vec![Vec::new()]; // one sequence of length 0
    for _ in 0..n {
        let mut longer = Vec::new();
        for prefix in &result {
            for symbol in alphabet {
                let mut next = prefix.clone();
                next.push(symbol.clone());
                longer.push(next);
            }
        }
        result = longer;
    }
    result
}

fn join<T: Display>(items: &[T], separator: &str) -> String {
    let mut text = String::new();
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            text.push_str(separator);
        }
        text.push_str(&item.to_string());
    }
    text
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let mut lines = input.lines();
    let alphabet_line = lines.next().ok_or("missing alphabet line")?;
    let alphabet: Vec<&str> = alphabet_line.split_whitespace().collect();
    let n: usize = lines.next().ok_or("missing length line")?.trim().parse()?;

    for kmer in kmers(&alphabet, n) {
        println!("{}", join(&kmer, ""));
    }
    Ok(())
}
```

```text
TT
TA
TG
AT
AA
AG
GT
GA
GG
```

Here `T` is `&str`, because the symbols are slices of the input text, so each k-mer is a `Vec<&str>` such as `["T", "A"]` and `join` glues it into `"TA"`. `kmers(&['A', 'C', 'G', 'T'], 3)` would give all 64 DNA codons as `Vec<char>`s with no change to the function. Keeping every k-mer in memory is fine for the small datasets Rosalind actually hands out, but the count is the alphabet size to the power *n*, so memory use explodes quickly; for bigger inputs you would instead produce one k-mer at a time, counting through positions like a car's odometer, and print each as you go. `lines.next()` returns an `Option`, and `ok_or` turns a missing line into an error message that `?` can pass up from `main`.
:::

```quiz
? Why does `fn largest<T>(list: &[T]) -> &T` fail to compile when its body uses `>`?
- Generic functions can't take slices.
+ Nothing says that `T` supports comparison; it needs a bound like `T: PartialOrd`.
- `>` only works on integers.
- The function must return `T`, not `&T`.
= The body must be valid for every possible `T`. A trait bound restricts `T` to types that support the operations you use.

? What does `impl Point<f64> { ... }` do?
- Adds methods to every `Point<T>`.
+ Adds methods only to `Point<f64>`.
- Converts any `Point` into `Point<f64>`.
= Without `<T>` after `impl`, the block is for one concrete type. `impl<T> Point<T>` would be for all of them.

? What is monomorphization?
- Boxing generic values so one copy of the code handles every type.
- A run-time check that the type parameters are correct.
+ Generating a specialised copy of generic code for each concrete type used.
= Because each type gets its own optimised copy, generic Rust code runs as fast as hand-written code. The cost is compile time and binary size.

? Which definition lets `x` and `y` have different types?
- `struct Point<T> { x: T, y: T }`
+ `struct Point<T, U> { x: T, y: U }`
- `struct Point { x: T, y: U }`
= Each independent type needs its own parameter. The last option doesn't declare any type parameters, so `T` and `U` are unknown names.
```
