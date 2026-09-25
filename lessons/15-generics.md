---
title: Generics
module: Abstraction
summary: Write functions, structs and enums that work for many types at once, without losing speed or type safety.
minutes: 30
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

In some languages generics are slower than hand-written code, because values are boxed up and methods looked up at run time. Rust takes a different approach called **monomorphization** (from Greek: "making into one form").

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

:::exercise A generic stack
Write a struct `Stack<T>` that wraps a `Vec<T>`, with methods `new() -> Self`, `push(&mut self, item: T)`, `pop(&mut self) -> Option<T>`, `peek(&self) -> Option<&T>` and `len(&self) -> usize`. In `main`, use one stack of numbers and one of strings.
:::solution
```rust
struct Stack<T> {
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self {
        Stack { items: Vec::new() }
    }

    fn push(&mut self, item: T) {
        self.items.push(item);
    }

    fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }

    fn peek(&self) -> Option<&T> {
        self.items.last()
    }

    fn len(&self) -> usize {
        self.items.len()
    }
}

fn main() {
    let mut numbers = Stack::new();
    numbers.push(1);
    numbers.push(2);
    println!("top: {:?}, len: {}", numbers.peek(), numbers.len());
    println!("popped: {:?}", numbers.pop());

    let mut words: Stack<String> = Stack::new();
    words.push(String::from("hello"));
    println!("popped: {:?}, then {:?}", words.pop(), words.pop());
}
```

```text
top: Some(2), len: 2
popped: Some(2)
popped: Some("hello"), then None
```
:::

:::exercise Min and max together
Write a generic function `fn min_max<T: PartialOrd + Copy>(list: &[T]) -> Option<(T, T)>` that returns `None` for an empty slice and otherwise the smallest and largest values. (`Copy` lets you copy values out of the slice.) Test it on integers, floats and an empty slice.
:::solution
```rust
fn min_max<T: PartialOrd + Copy>(list: &[T]) -> Option<(T, T)> {
    let first = *list.first()?;
    let mut min = first;
    let mut max = first;
    for &item in list {
        if item < min {
            min = item;
        }
        if item > max {
            max = item;
        }
    }
    Some((min, max))
}

fn main() {
    println!("{:?}", min_max(&[3, 9, -2, 7]));
    println!("{:?}", min_max(&[0.5, 0.25, 2.0]));
    let empty: [i32; 0] = [];
    println!("{:?}", min_max(&empty));
}
```

```text
Some((-2, 9))
Some((0.25, 2.0))
None
```
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
