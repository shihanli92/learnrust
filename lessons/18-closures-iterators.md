---
title: Closures and Iterators
module: Abstraction
summary: Write small anonymous functions that capture their surroundings, and process collections with lazy iterator chains instead of hand-written loops.
minutes: 40
---

A **closure** is a function without a name that you can store in a variable or pass to another function. Unlike a normal `fn`, a closure can use variables from the place where it was written. An **iterator** is anything that hands out a sequence of values one at a time.

The two go together. Most iterator methods take a closure that says what to do with each item, and that combination replaces a large share of the `for` loops you would otherwise write. This is some of the most idiomatic Rust there is, so it is worth getting comfortable with.

## Closure syntax

A closure's parameters go between vertical bars, followed by an expression for its body:

```rust
fn main() {
    let add_one = |x| x + 1;
    let square = |x: i32| -> i32 { x * x };
    let greet = || println!("Hello from a closure!");

    println!("{}", add_one(4));
    println!("{}", square(7));
    greet();
}
```

```text
5
49
Hello from a closure!
```

Type annotations are optional. The compiler infers the types from how you use the closure, because closures are usually short and used right where they are defined. The braces are optional too if the body is a single expression.

Inference picks *one* type per parameter. Once the compiler has decided, the closure cannot be used with a different type:

```rust,compile_fail
fn main() {
    let echo = |x| x;
    let s = echo(String::from("hi"));
    let n = echo(5);
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:4:18
  |
4 |     let n = echo(5);
  |             ---- ^ expected `String`, found integer
  |             |
  |             arguments to this function are incorrect
```

If you need something that works for many types, write a generic `fn` instead.

## Capturing the environment

The big difference from `fn` is that closures can use variables from the surrounding scope. The compiler looks at what the body *does* with each variable and captures it in the least demanding way that works:

- **By shared reference** if the closure only reads the value.
- **By mutable reference** if it changes the value.
- **By value (move)** if it needs to own the value, for example to drop it or return it.

```rust
fn main() {
    let name = String::from("Ferris");
    let say_hi = || println!("Hi, {name}!"); // borrows `name`
    say_hi();
    println!("{name} is still usable here");

    let mut count = 0;
    let mut bump = || count += 1; // mutably borrows `count`
    bump();
    bump();
    println!("count = {count}");
}
```

```text
Hi, Ferris!
Ferris is still usable here
count = 2
```

Notice that `bump` itself has to be declared `let mut`. Calling it changes something it has captured, so calling it counts as a mutation. The normal borrowing rules still apply: `bump` holds a mutable borrow of `count` until its last use, and until then you cannot read `count` anywhere else. That is why the `println!` comes after the last call.

### The move keyword

Sometimes a closure must outlive the variables it uses. Put `move` in front of it to make it take ownership of everything it captures:

```rust
fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n
}

fn make_greeting(name: String) -> impl Fn() -> String {
    move || format!("Welcome back, {name}!")
}

fn main() {
    let add_ten = make_adder(10);
    println!("{}", add_ten(5));

    let greeting = make_greeting(String::from("Ada"));
    println!("{}", greeting());
}
```

```text
15
Welcome back, Ada!
```

Without `move`, the closure in `make_adder` would borrow `n`, a local variable that disappears when the function returns. The borrow checker would refuse that. With `move`, the closure owns its own copy of `n` and can live as long as it likes. You will also need `move` when you hand a closure to another thread.

The return type `impl Fn(i32) -> i32` means "some type that implements the `Fn(i32) -> i32` trait". Every closure has its own unique, unnameable type, so `impl Trait` is how you return one.

## Fn, FnMut and FnOnce

Every closure automatically implements one or more of three traits, depending on what it does with its captured values. These traits are how functions describe the kind of closure they accept.

| Trait | The closure... | Can be called |
| --- | --- | --- |
| `Fn` | only reads what it captured | any number of times, even at the same time |
| `FnMut` | changes what it captured | any number of times, one call at a time |
| `FnOnce` | consumes (moves out) what it captured | once |

They form a ladder. Every `Fn` closure is also `FnMut`, and every closure is `FnOnce`. So when you write a function that takes a closure, ask for the *least* you need: `FnOnce` if you call it once, `FnMut` if you call it repeatedly, and `Fn` only if you really need shared, repeatable calls.

```rust
fn apply_twice<F: FnMut()>(mut f: F) {
    f();
    f();
}

fn run_once<F: FnOnce() -> String>(f: F) -> String {
    f()
}

fn transform(values: &[i32], f: impl Fn(i32) -> i32) -> Vec<i32> {
    let mut out = Vec::new();
    for &v in values {
        out.push(f(v));
    }
    out
}

fn double(x: i32) -> i32 {
    x * 2
}

fn main() {
    let mut log = Vec::new();
    apply_twice(|| log.push("tick"));
    println!("{log:?}");

    let message = String::from("consumed");
    println!("{}", run_once(move || message));

    println!("{:?}", transform(&[1, 2, 3], |x| x * 10));
    println!("{:?}", transform(&[1, 2, 3], double));
}
```

```text
["tick", "tick"]
consumed
[10, 20, 30]
[2, 4, 6]
```

The last line shows that a plain function name can be passed wherever a closure is expected, as long as the signature matches. The two spellings `F: FnMut()` with a generic and `impl Fn(i32) -> i32` in argument position mean the same thing; use whichever reads better.

## The Iterator trait

An iterator is any type that implements the standard library's `Iterator` trait. Stripped down to its core, the trait looks like this:

```rust,ignore
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // ...plus dozens of provided methods such as map, filter and sum
}
```

`type Item` is an *associated type*: each iterator says what kind of value it produces. `next` returns `Some(item)` until the sequence is exhausted, then `None`. It takes `&mut self` because the iterator has to remember where it is.

You can call `next` by hand to see what a `for` loop does behind the scenes:

```rust
fn main() {
    let codons = vec!["AUG", "UAA"];
    let mut it = codons.iter();
    println!("{:?}", it.next());
    println!("{:?}", it.next());
    println!("{:?}", it.next());
}
```

```text
Some("AUG")
Some("UAA")
None
```

A `for` loop is just a tidy way of calling `next` until it returns `None`.

## iter, iter_mut and into_iter

Collections offer three ways to iterate, and they map directly onto ownership:

| Method | Yields | The collection afterwards |
| --- | --- | --- |
| `iter()` | `&T`, shared references | unchanged, still usable |
| `iter_mut()` | `&mut T`, mutable references | changed in place, still usable |
| `into_iter()` | `T`, owned values | moved, gone |

```rust
fn main() {
    let mut scores = vec![70, 85, 92];

    for s in scores.iter_mut() {
        *s += 5; // curve everyone's score
    }

    let total: i32 = scores.iter().sum();
    println!("{scores:?}, total {total}");

    let names = vec![String::from("Ann"), String::from("Bo")];
    for name in names.into_iter() {
        println!("took ownership of {name}");
    }
    // `names` has been moved and can't be used here
}
```

```text
[75, 90, 97], total 262
took ownership of Ann
took ownership of Bo
```

`for x in &v` is shorthand for `v.iter()`, `for x in &mut v` for `v.iter_mut()`, and `for x in v` for `v.into_iter()`.

## Adapters are lazy

An **adapter** is a method that takes an iterator and returns a new iterator that transforms the items somehow. The common ones:

| Adapter | What it does |
| --- | --- |
| `map(f)` | applies `f` to each item |
| `filter(p)` | keeps items for which `p` returns `true` |
| `enumerate()` | pairs each item with its index: `(0, a), (1, b)` |
| `zip(other)` | pairs items from two iterators, stopping at the shorter |
| `take(n)` / `skip(n)` | keeps only the first `n` / drops the first `n` |
| `rev()` | walks backwards |
| `chain(other)` | continues with a second iterator when the first is done |

Adapters are **lazy**: building a chain does no work at all. Nothing happens until something asks for items. The compiler even warns you if you forget:

```text
warning: unused `Map` that must be used
 = note: iterators are lazy and do nothing unless consumed
```

Here is a chain that reads almost like a sentence:

```rust
fn main() {
    let ids = ["seq_a", "seq_b", "seq_c", "seq_d", "seq_e"];
    let lengths = [1520, 87, 3011, 452, 2210];

    for (i, (id, len)) in ids.iter().zip(lengths.iter()).enumerate().skip(1).take(3) {
        println!("{i}: {id} ({len} bases)");
    }

    let countdown: Vec<i32> = (1..=3).rev().chain(0..1).collect();
    println!("{countdown:?}");

    let reads = ["acgt", "gattaca", "cc", "ttagggtta", "gcgc"];
    let long_reads: Vec<String> = reads
        .iter()
        .filter(|r| r.len() > 4)
        .map(|r| r.to_uppercase())
        .collect();
    println!("{long_reads:?}");
}
```

```text
1: seq_b (87 bases)
2: seq_c (3011 bases)
3: seq_d (452 bases)
[3, 2, 1, 0]
["GATTACA", "TTAGGGTTA"]
```

Why the `|r|` in `filter` gets a `&&str`: `reads.iter()` yields `&&str` (a reference to each `&str` in the array), and `filter` passes a reference to each item so it doesn't take ownership. Method calls such as `r.len()` see through the extra references automatically, so you rarely have to think about it.

## Consumers

A **consumer** pulls items out of an iterator and produces a final result. Calling one is what makes a lazy chain actually run.

```rust
fn main() {
    let numbers = vec![3, 8, 1, 9, 4];

    let sum: i32 = numbers.iter().sum();
    let evens = numbers.iter().filter(|&&n| n % 2 == 0).count();
    let product = numbers.iter().fold(1, |acc, &n| acc * n);
    let any_big = numbers.iter().any(|&n| n > 8);
    let all_positive = numbers.iter().all(|&n| n > 0);
    let first_even = numbers.iter().find(|&&n| n % 2 == 0);
    let max = numbers.iter().max();
    let min = numbers.iter().min();
    let doubled = numbers.iter().map(|n| n * 2).collect::<Vec<i32>>();

    println!("sum={sum} evens={evens} product={product}");
    println!("any_big={any_big} all_positive={all_positive}");
    println!("first_even={first_even:?} max={max:?} min={min:?}");
    println!("doubled={doubled:?}");
}
```

```text
sum=25 evens=2 product=864
any_big=true all_positive=true
first_even=Some(8) max=Some(9) min=Some(1)
doubled=[6, 16, 2, 18, 8]
```

A few things worth knowing:

- `collect` can build many different collections (`Vec`, `String`, `HashMap`, ...), so you must say which one. Either annotate the variable (`let v: Vec<i32> = ...`) or use the **turbofish** syntax `collect::<Vec<i32>>()`. You can let the compiler fill in the element type with `Vec<_>`.
- `sum` also needs to know its result type, for the same reason.
- `find`, `min` and `max` return an `Option` because the iterator might be empty.
- `fold` is the general-purpose consumer: it starts with an initial value and combines it with each item in turn. `sum` and `count` are special cases of it.
- Patterns such as `|&n|` and `|&&n|` destructure references in the closure's parameter so the body gets a plain number.

:::tip Collecting Results
If each item is a `Result`, you can collect into `Result<Vec<T>, E>`. You get `Ok` with all the values, or the first `Err`. For example, `"1 2 x".split(' ').map(|s| s.parse::<i32>()).collect::<Result<Vec<_>, _>>()` returns an error because of the `x`.
:::

## Implementing Iterator for your own type

To make your own iterator, write a struct that holds the current state and implement `next`. Everything else comes for free.

```rust
struct Fibonacci {
    current: u64,
    next: u64,
}

impl Fibonacci {
    fn new() -> Self {
        Fibonacci { current: 0, next: 1 }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<u64> {
        let value = self.current;
        self.current = self.next;
        self.next += value;
        Some(value)
    }
}

fn main() {
    let first_ten: Vec<u64> = Fibonacci::new().take(10).collect();
    println!("{first_ten:?}");

    let even_sum: u64 = Fibonacci::new()
        .take_while(|&n| n < 1000)
        .filter(|n| n % 2 == 0)
        .sum();
    println!("sum of even Fibonacci numbers below 1000: {even_sum}");
}
```

```text
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
sum of even Fibonacci numbers below 1000: 798
```

This iterator never returns `None`, so it is infinite. That is fine because adapters are lazy: `take(10)` and `take_while` stop asking for items once they have what they need. Just don't call `sum` or `collect` on the raw, unlimited iterator. (These are also the rabbit-pair counts from FIB with *k* = 1, shifted by a month: 1, 1, 2, 3, 5...)

## Are iterators slower than loops?

No. Iterator chains are a **zero-cost abstraction**: after optimisation, a chain of `filter`, `map` and `sum` compiles to essentially the same machine code as the hand-written loop. Sometimes it is faster, because the compiler can see that no index can go out of bounds and skip the checks that `v[i]` would need.

So choose based on readability. A short chain that says "keep the valid ones, convert them, add them up" is often clearer than a loop with a mutable accumulator. A long chain with complex closures can be harder to follow than a plain `for` loop, and then the loop is the better choice. Both are fine Rust.

:::note Measure in release mode
If you ever compare performance yourself, use `cargo run --release`. Debug builds skip the optimisations that make iterator chains fast, so timing them is misleading.
:::

:::rosalind PROB Introduction to Random Strings
How surprised should you be to find a particular sequence in a genome? A simple model treats DNA as random letters, with the odds set by the genome's GC content *x*: each position is a G with probability *x*/2, a C with probability *x*/2, and an A or T with probability (1 − *x*)/2 each. The chance that a random string matches a given sequence exactly is the product of the chances for each position. Those numbers get tiny very quickly, so biologists work with their base-10 **logarithms**, which turn the product into a sum.

The dataset has two lines: a DNA string *s* of up to 100 bases, and up to 20 GC contents (numbers between 0 and 1) separated by spaces. For each GC content, print the common logarithm of the probability that a random string with that GC content equals *s*. Print the answers on one line, separated by spaces; three decimal places are plenty.

This is a natural fit for closures and iterators:

1. Write `fn log_probability(dna: &str, gc_content: f64) -> f64`. Work out `log10` of the G/C and A/T probabilities once, then `map` each base to the right one and `sum()` the results. (`f64` has a `.log10()` method.)
2. Parse the numbers with `split_whitespace().map(|s| s.parse::<f64>())` and collect into a `Result<Vec<f64>, _>`, as in the tip above, so a malformed number becomes an error for `?`.
3. `map` each GC content to a formatted string, `collect` into a `Vec<String>`, and `join(" ")` them.

For this sample:

```text
GATTACAGC
0.200 0.450 0.730
```

the output is:

```text
-5.990 -5.395 -6.099
```
:::solution
```rust
use std::error::Error;

const SAMPLE: &str = "GATTACAGC
0.200 0.450 0.730
";

/// log10 of the probability that a random string with this GC content equals `dna`.
fn log_probability(dna: &str, gc_content: f64) -> f64 {
    let log_gc = (gc_content / 2.0).log10(); // chance of one particular base, G or C
    let log_at = ((1.0 - gc_content) / 2.0).log10(); // chance of A or T
    dna.chars()
        .map(|base| if base == 'G' || base == 'C' { log_gc } else { log_at })
        .sum()
}

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let mut lines = input.lines();
    let dna = lines.next().ok_or("missing DNA line")?.trim();
    let gc_contents = lines
        .next()
        .ok_or("missing GC-content line")?
        .split_whitespace()
        .map(|s| s.parse::<f64>())
        .collect::<Result<Vec<f64>, _>>()?;

    let answers: Vec<String> = gc_contents
        .iter()
        .map(|&gc| format!("{:.3}", log_probability(dna, gc)))
        .collect();
    println!("{}", answers.join(" "));
    Ok(())
}
```

```text
-5.990 -5.395 -6.099
```

`log_probability` works out the two logarithms once, outside the closure, and the closure captures them by reference. Each answer is negative because each probability is less than 1. The middle one is the least negative, which makes sense: the sample has 4 G or C out of 9 bases, and a GC content of 0.45 is the closest of the three to that. Adding logarithms instead of multiplying probabilities also avoids a subtle bug: for a 100-base string, the raw product can be around 10⁻⁶⁰, and much longer strings would underflow an `f64` to zero.
:::

:::rosalind ORF Open Reading Frames
Before a biologist even knows where the genes are, they can look for stretches of DNA that *could* code for a protein. An **open reading frame** (ORF) starts at a start codon, `ATG`, and continues codon by codon until the first stop codon (`TAA`, `TAG` or `TGA`, the DNA spellings of the RNA stops from PROT). A gene can sit on either strand, so ORFs must be searched for on the DNA as given and on its reverse complement (REVC), starting at any position.

Given a DNA string of up to 1000 bases in FASTA format, print every **distinct** protein that an ORF could encode, one per line. Every `ATG` starts its own ORF, even one that lies inside another ORF. A start codon that never reaches a stop codon before the sequence ends does not count. Rosalind accepts any order; print the proteins sorted, so your output is deterministic.

Iterator adapters keep this short:

- The ORF start positions on a strand are `(0..len).filter(|&i| bytes[i..].starts_with(b"ATG"))`. Scanning every position covers all three reading frames at once.
- `filter_map` is `map` and `filter` in one: its closure returns an `Option`, and only the `Some` values come out. Use it with `fn translate_orf(dna: &[u8]) -> Option<String>`, which returns `None` if there is no stop codon.
- The reverse complement is `chars().rev().map(...)` collected into a `String`.
- `chain` the proteins from both strands and `collect` them into a `BTreeSet<String>`. A `BTreeSet` is to `HashSet` what `BTreeMap` is to `HashMap`: it removes duplicates **and** keeps its items sorted.

For the codon table, adapt the compact version from SPLC in the Custom Errors lesson to DNA letters (base order T, C, A, G), or your `match` from the Pattern Matching lesson with `T` in place of `U`. For this sample:

```text
>Rosalind_3812
CCATGCCCATGAAATAGGTCACCACA
TTATGGGGCATGAAATGA
```

the output is:

```text
MK
MPMK
MW
```
:::solution
```rust
use std::collections::BTreeSet;
use std::error::Error;

/// The standard codon table for DNA codons, numbered in base order T, C, A, G
/// (TTT is 0, TTC is 1, ... GGG is 63). '*' marks the stop codons.
const AMINO_ACIDS: &[u8; 64] =
    b"FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

fn amino_acid(codon: &[u8]) -> char {
    let index = codon.iter().fold(0, |acc, &base| {
        let digit = match base {
            b'T' => 0,
            b'C' => 1,
            b'A' => 2,
            _ => 3, // b'G'
        };
        acc * 4 + digit
    });
    AMINO_ACIDS[index] as char
}

/// Translates from the start of `dna` up to the first stop codon.
/// Returns None if the sequence runs out before a stop codon: that's not an ORF.
fn translate_orf(dna: &[u8]) -> Option<String> {
    let mut protein = String::new();
    for codon in dna.chunks_exact(3) {
        match amino_acid(codon) {
            '*' => return Some(protein),
            aa => protein.push(aa),
        }
    }
    None
}

/// Every protein from an ORF that starts somewhere on this strand.
fn orf_proteins(strand: &str) -> Vec<String> {
    let bytes = strand.as_bytes();
    (0..bytes.len())
        .filter(|&i| bytes[i..].starts_with(b"ATG"))
        .filter_map(|i| translate_orf(&bytes[i..]))
        .collect()
}

fn reverse_complement(dna: &str) -> String {
    dna.chars()
        .rev()
        .map(|base| match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            other => other,
        })
        .collect()
}

const SAMPLE: &str = "
>Rosalind_3812
CCATGCCCATGAAATAGGTCACCACA
TTATGGGGCATGAAATGA
";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let dna: String = input
        .lines()
        .filter(|line| !line.starts_with('>'))
        .map(|line| line.trim())
        .collect();
    let reverse = reverse_complement(&dna);

    let proteins: BTreeSet<String> = orf_proteins(&dna)
        .into_iter()
        .chain(orf_proteins(&reverse))
        .collect();
    for protein in &proteins {
        println!("{protein}");
    }
    Ok(())
}
```

```text
MK
MPMK
MW
```

`MPMK` starts at the first `ATG`, and the `ATG` inside it starts `MK`. A second `MK` appears near the end (`ATGAAATGA`), and the set quietly drops the duplicate. `MW` is on the reverse strand: `TCACCACAT` in the sample (across the line break) reads `ATGTGGTGA` backwards and complemented. The `ATG` of `ATGGGGCAT...` never reaches a stop codon in its frame, so `translate_orf` returns `None` and `filter_map` leaves it out. `fold` in `amino_acid` turns three bases into a number from 0 to 63, the same arithmetic as the SPLC loop, written as a single consumer.
:::

```quiz
? What does `let v = vec![1, 2, 3]; v.iter().map(|x| x * 2);` do on its own?
- Doubles every element of `v` in place.
- Creates a new `Vec` with the doubled values.
+ Nothing useful: the iterator is lazy and never consumed.
- It does not compile.
= Adapters like `map` only describe work. Without a consumer such as `collect` or `sum`, no items are processed, and the compiler warns that the iterator is unused.

? A function takes a closure and calls it exactly once. Which bound is the most flexible for callers?
- `F: Fn()`
- `F: FnMut()`
+ `F: FnOnce()`
= Every closure implements `FnOnce`, so asking for it accepts all closures, including ones that move captured values out.

? Why does `make_adder` need `move |x| x + n`?
+ Without `move` the closure would borrow `n`, which is dropped when `make_adder` returns.
- `move` makes the closure run faster.
- Closures can't use integer parameters without `move`.
- `move` turns the closure into an `FnOnce`.
= `move` makes the closure own its captured values, so it can outlive the function that created it. It can still be `Fn` if it only reads them.

? What must you add to `let v = (1..4).map(|x| x * x).collect();` for it to compile?
- Nothing, it compiles as is.
- A call to `.iter()` after `collect`.
+ A type, for example `let v: Vec<i32>` or `collect::<Vec<_>>()`.
- The `move` keyword on the closure.
= `collect` can build many kinds of collections, so the compiler needs you to name the one you want.
```
