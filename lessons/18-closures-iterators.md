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
    let fruits = vec!["apple", "banana"];
    let mut it = fruits.iter();
    println!("{:?}", it.next());
    println!("{:?}", it.next());
    println!("{:?}", it.next());
}
```

```text
Some("apple")
Some("banana")
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
    let names = ["ada", "grace", "linus", "barbara", "dennis"];
    let years = [1815, 1906, 1969, 1939, 1941];

    for (i, (name, year)) in names.iter().zip(years.iter()).enumerate().skip(1).take(3) {
        println!("{i}: {name} ({year})");
    }

    let countdown: Vec<i32> = (1..=3).rev().chain(0..1).collect();
    println!("{countdown:?}");

    let long_names: Vec<String> = names
        .iter()
        .filter(|n| n.len() > 4)
        .map(|n| n.to_uppercase())
        .collect();
    println!("{long_names:?}");
}
```

```text
1: grace (1906)
2: linus (1969)
3: barbara (1939)
[3, 2, 1, 0]
["GRACE", "LINUS", "BARBARA", "DENNIS"]
```

Why the `|n|` in `filter` gets a `&&str`: `names.iter()` yields `&&str` (a reference to each `&str` in the array), and `filter` passes a reference to each item so it doesn't take ownership. Method calls such as `n.len()` see through the extra references automatically, so you rarely have to think about it.

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

This iterator never returns `None`, so it is infinite. That is fine because adapters are lazy: `take(10)` and `take_while` stop asking for items once they have what they need. Just don't call `sum` or `collect` on the raw, unlimited iterator.

## Are iterators slower than loops?

No. Iterator chains are a **zero-cost abstraction**: after optimisation, a chain of `filter`, `map` and `sum` compiles to essentially the same machine code as the hand-written loop. Sometimes it is faster, because the compiler can see that no index can go out of bounds and skip the checks that `v[i]` would need.

So choose based on readability. A short chain that says "keep the valid ones, convert them, add them up" is often clearer than a loop with a mutable accumulator. A long chain with complex closures can be harder to follow than a plain `for` loop, and then the loop is the better choice. Both are fine Rust.

:::note Measure in release mode
If you ever compare performance yourself, use `cargo run --release`. Debug builds skip the optimisations that make iterator chains fast, so timing them is misleading.
:::

:::exercise Word lengths
Given `let text = "the quick brown fox jumps over the lazy dog";`, use a single iterator chain for each of these:

1. A `Vec<usize>` of the length of every word (hint: `split_whitespace`).
2. The longest word (hint: `max_by_key`).
3. The number of words that start with a letter after `m` in the alphabet.
:::solution
```rust
fn main() {
    let text = "the quick brown fox jumps over the lazy dog";

    let lengths: Vec<usize> = text.split_whitespace().map(|w| w.len()).collect();
    println!("{lengths:?}");

    let longest = text.split_whitespace().max_by_key(|w| w.len());
    println!("{longest:?}");

    let late = text
        .split_whitespace()
        .filter(|w| w.chars().next().is_some_and(|c| c > 'm'))
        .count();
    println!("{late} words start after 'm'");
}
```

`max_by_key` returns the *last* of several equally long maximums, so this prints `Some("jumps")`, not `Some("quick")`. The words that start after `m` are the, quick, over and the, so `late` is 4.
:::

:::exercise A counting iterator
Write a struct `Steps` with fields `current` and `end` (both `u32`) and a `step` field. Implement `Iterator` so that `Steps { current: 0, end: 20, step: 5 }` yields `0, 5, 10, 15` and then stops. Then use it with `map` to print the squares of those numbers.
:::solution
```rust
struct Steps {
    current: u32,
    end: u32,
    step: u32,
}

impl Iterator for Steps {
    type Item = u32;

    fn next(&mut self) -> Option<u32> {
        if self.current >= self.end {
            return None;
        }
        let value = self.current;
        self.current += self.step;
        Some(value)
    }
}

fn main() {
    let steps = Steps { current: 0, end: 20, step: 5 };
    let squares: Vec<u32> = steps.map(|n| n * n).collect();
    println!("{squares:?}"); // [0, 25, 100, 225]
}
```
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
