---
title: Traits
module: Abstraction
summary: Describe shared behaviour with traits, use them to constrain generics, and choose between static and dynamic dispatch.
minutes: 40
---

A **trait** is a named set of behaviour that types can promise to provide. "Can be printed for users" is a trait (`Display`). "Can be compared with `<`" is a trait (`PartialOrd`). "Can be duplicated" is a trait (`Clone`). You've been deriving and implementing a few already; this lesson shows how to define your own and how to use them to write flexible code.

If you know other languages, traits are close to *interfaces* in Java, C# or Go, with a few extra powers. They are the main way Rust code achieves abstraction: rather than asking "what type is this?", generic code asks "what can this do?".

## Defining and implementing a trait

A trait definition lists method **signatures**: names, parameters and return types, without bodies. Each type that implements the trait supplies the bodies:

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    title: String,
    author: String,
    words: u32,
}

struct Post {
    username: String,
    text: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}, by {} ({} words)", self.title, self.author, self.words)
    }
}

impl Summary for Post {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.username, self.text)
    }
}

fn main() {
    let article = Article {
        title: String::from("Rust 2024 released"),
        author: String::from("The Rust Team"),
        words: 1200,
    };
    let post = Post {
        username: String::from("ferris"),
        text: String::from("just learned traits!"),
    };
    println!("{}", article.summarize());
    println!("{}", post.summarize());
}
```

```text
Rust 2024 released, by The Rust Team (1200 words)
@ferris: just learned traits!
```

`impl Summary for Article` reads naturally: "implement `Summary` for `Article`". The compiler checks that every required method is present with exactly the right signature. Once a type implements a trait, you call the trait's methods like any other method.

## Default methods

A trait can provide a **default** body for a method. Implementors get it for free and may override it. Default methods can call the other methods of the trait, even required ones that have no body yet:

```rust
trait Summary {
    fn author(&self) -> String;

    fn summarize(&self) -> String {
        format!("(Read more from {}...)", self.author())
    }
}

struct Post {
    username: String,
}

struct Book {
    title: String,
    author: String,
}

impl Summary for Post {
    fn author(&self) -> String {
        format!("@{}", self.username)
    }
    // uses the default summarize
}

impl Summary for Book {
    fn author(&self) -> String {
        self.author.clone()
    }

    fn summarize(&self) -> String {
        format!("{} by {}", self.title, self.author)
    }
}

fn main() {
    let post = Post { username: String::from("ferris") };
    let book = Book { title: String::from("The Rust Book"), author: String::from("Klabnik & Nichols") };
    println!("{}", post.summarize());
    println!("{}", book.summarize());
}
```

```text
(Read more from @ferris...)
The Rust Book by Klabnik & Nichols
```

This is a powerful pattern: implementors write one small method, and the trait builds a lot of functionality on top of it. The standard library's `Iterator` trait has one required method, `next`, and over seventy default methods built on it.

## Traits as bounds

In the Generics lesson you wrote `T: PartialOrd` to say "any type that can be compared". That's a **trait bound**, and it works the same with your own traits:

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Post {
    text: String,
}

impl Summary for Post {
    fn summarize(&self) -> String {
        format!("post: {}", self.text)
    }
}

fn notify<T: Summary>(item: &T) {
    println!("Breaking news! {}", item.summarize());
}

fn main() {
    notify(&Post { text: String::from("traits are neat") });
}
```

```text
Breaking news! post: traits are neat
```

Inside `notify`, the only things you can do with `item` are the things `Summary` promises. In return, `notify` works with every type that implements `Summary`, including types written years later by someone else.

### Multiple bounds and where clauses

Use `+` when a type must implement several traits. When the bounds get long, move them into a `where` clause after the signature, which reads more easily:

```rust
use std::fmt::{Debug, Display};

fn describe<T: Display + Debug>(value: T) {
    println!("display: {value}, debug: {value:?}");
}

fn compare_and_show<T, U>(a: T, b: U) -> String
where
    T: Display + PartialOrd,
    U: Debug,
{
    format!("{a} with note {b:?}")
}

fn main() {
    describe("hi");
    describe(3.5);
    println!("{}", compare_and_show(10, vec!["x", "y"]));
}
```

```text
display: hi, debug: "hi"
display: 3.5, debug: 3.5
10 with note ["x", "y"]
```

The two styles mean exactly the same thing. Most people use inline bounds for one short bound and `where` for anything longer.

## impl Trait

For the common case of "an argument of some type that implements this trait", there's a shorter syntax, `impl Trait`:

```rust,ignore
fn notify(item: &impl Summary) {
    println!("Breaking news! {}", item.summarize());
}
```

This is sugar for the generic version `fn notify<T: Summary>(item: &T)`. Use whichever reads better; `impl Trait` is nice for simple cases.

`impl Trait` in the **return** position means something slightly different: "this function returns some specific type that implements the trait, but I'm not telling you which". The caller can only use the trait's methods:

```rust
use std::fmt::Display;

fn make_greeting(formal: bool) -> impl Display {
    if formal {
        String::from("Good evening.")
    } else {
        String::from("Hey!")
    }
}

fn evens_up_to(n: u32) -> impl Iterator<Item = u32> {
    (0..=n).filter(|x| x % 2 == 0)
}

fn main() {
    println!("{}", make_greeting(true));
    for e in evens_up_to(8) {
        print!("{e} ");
    }
    println!();
}
```

```text
Good evening.
0 2 4 6 8 
```

The second function shows why this matters: iterator types can have enormously long names, and closures have types that can't be written down at all. `impl Iterator<Item = u32>` just says "an iterator of `u32`s". You'll use this a lot in the Closures and Iterators lesson.

One rule: every return path must produce the *same* concrete type. Returning a `String` in one branch and an `i32` in another won't compile, even though both implement `Display`. For that you need trait objects, covered below.

## Derivable traits

The standard library has several traits so mechanical that the compiler can write the implementation for you with `#[derive(...)]`, as long as every field implements them too:

| Trait | Gives you | Notes |
| --- | --- | --- |
| `Debug` | `{:?}` formatting | Derive it on almost everything. |
| `Clone` | `.clone()`, an explicit deep copy | |
| `Copy` | Implicit copies instead of moves | Only for small types whose fields are all `Copy`; requires `Clone`. No `String` or `Vec` fields. |
| `PartialEq`, `Eq` | `==` and `!=` | `Eq` promises that every value equals itself, which floats (`NaN`) don't satisfy. |
| `PartialOrd`, `Ord` | `<`, `>`, sorting | Derived ordering compares fields top to bottom, or variants in declaration order. `Ord` needs `Eq`. |
| `Hash` | Use as a `HashMap` key or in a `HashSet` | Usually together with `Eq`. |
| `Default` | `Type::default()` with "empty" values | Zero for numbers, empty for strings and collections. |

```rust
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

#[derive(Debug, Default, Clone, PartialEq)]
struct Settings {
    volume: u8,
    name: String,
    tags: Vec<String>,
}

fn main() {
    let mut hand = vec![Suit::Spades, Suit::Clubs, Suit::Hearts, Suit::Clubs];
    hand.sort();
    println!("sorted: {hand:?}");

    let unique: HashSet<Suit> = hand.iter().copied().collect();
    println!("{} different suits", unique.len());
    println!("hearts > diamonds? {}", Suit::Hearts > Suit::Diamonds);

    let s = Settings::default();
    let t = Settings { volume: 7, ..s.clone() };
    println!("{s:?}");
    println!("equal? {}", s == t);
}
```

```text
sorted: [Clubs, Clubs, Hearts, Spades]
3 different suits
hearts > diamonds? true
Settings { volume: 0, name: "", tags: [] }
equal? false
```

## Implementing Display yourself

`Display` can't be derived, because only you know how a value should look to users. You implemented it for errors in the Custom Error Types lesson; the recipe is the same for any type, and once you have it, `{}`, `format!` and `.to_string()` all work:

```rust
use std::fmt;

struct Money {
    cents: i64,
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "${}.{:02}", self.cents / 100, self.cents % 100)
    }
}

fn main() {
    let price = Money { cents: 1999 };
    println!("Price: {price}");
    let label: String = price.to_string();
    println!("{} characters", label.len());
}
```

```text
Price: $19.99
6 characters
```

## Trait objects and dynamic dispatch

Generics have a limit. A `Vec<T>` holds one type `T`, so you can't put a `Circle` and a `Square` in the same `Vec<T>` even if both implement `Shape`. The Enums lesson solved this with an enum listing every shape, which is great when you know all the variants up front. When you don't (for example, users of your library should be able to add their own shapes), you use a **trait object**.

`dyn Shape` means "some type that implements `Shape`, decided at run time". Because different shapes have different sizes, a trait object always lives behind a pointer, such as `&dyn Shape` or `Box<dyn Shape>`. A `Box` owns a value on the heap; the Smart Pointers lesson covers it in detail.

```rust
trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String;
}

struct Circle {
    radius: f64,
}

struct Square {
    side: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        3.14159 * self.radius * self.radius
    }
    fn name(&self) -> String {
        String::from("circle")
    }
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.side * self.side
    }
    fn name(&self) -> String {
        String::from("square")
    }
}

fn total_area(shapes: &[Box<dyn Shape>]) -> f64 {
    let mut total = 0.0;
    for s in shapes {
        total += s.area();
    }
    total
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { radius: 1.0 }),
        Box::new(Square { side: 2.0 }),
        Box::new(Circle { radius: 0.5 }),
    ];
    for s in &shapes {
        println!("{} with area {:.2}", s.name(), s.area());
    }
    println!("total: {:.2}", total_area(&shapes));
}
```

```text
circle with area 3.14
square with area 4.00
circle with area 0.79
total: 7.93
```

When you call `s.area()` on a trait object, Rust doesn't know at compile time which `area` to run. The trait object carries a small hidden table of function pointers (a **vtable**) and looks the method up when called. This is **dynamic dispatch**. With generics, the compiler knows the exact type and calls the right function directly. That is **static dispatch**.

| | Generics (`T: Shape`, `impl Shape`) | Trait objects (`dyn Shape`) |
| --- | --- | --- |
| Dispatch | Static: chosen at compile time | Dynamic: looked up at run time |
| Speed | Fastest; calls can be inlined | A small indirection per call |
| Mixed types in one collection | No | Yes |
| Code size | One copy per type used | One copy in total |

Prefer generics by default. Reach for `dyn Trait` when you need a collection of different types, or want to keep compile times and binary size down.

:::note Not every trait can be a trait object
A trait used with `dyn` must be **dyn compatible** (formerly called "object safe"). Roughly: its methods can't be generic and can't return `Self`, because the caller wouldn't know the concrete type. The compiler tells you clearly if you hit this.
:::

## The orphan rule

You can implement a trait for a type only if the trait *or* the type is defined in your own crate. So you may implement your `Summary` for the standard library's `Vec<T>`, or the standard `Display` for your own `Money`. But you may not implement the standard `Display` for the standard `Vec<T>`: both are foreign.

This is called the **orphan rule**. It guarantees that two crates can never both provide conflicting implementations of the same trait for the same type. If you really need it, wrap the foreign type in a newtype (`struct Wrapper(Vec<String>);`), which is your own type, and implement the trait for that.

:::exercise Describe yourself
Define a trait `Describe` with a required method `name(&self) -> String` and a default method `describe(&self) -> String` that returns `"This is NAME."`. Implement it for two structs, `Dog` and `Robot`, overriding `describe` for `Robot` only. Then write `fn introduce_all(items: &[Box<dyn Describe>])` that prints every description.
:::solution
```rust
trait Describe {
    fn name(&self) -> String;

    fn describe(&self) -> String {
        format!("This is {}.", self.name())
    }
}

struct Dog {
    name: String,
}

struct Robot {
    model: u32,
}

impl Describe for Dog {
    fn name(&self) -> String {
        self.name.clone()
    }
}

impl Describe for Robot {
    fn name(&self) -> String {
        format!("unit {}", self.model)
    }

    fn describe(&self) -> String {
        format!("BEEP. I AM {}.", self.name().to_uppercase())
    }
}

fn introduce_all(items: &[Box<dyn Describe>]) {
    for item in items {
        println!("{}", item.describe());
    }
}

fn main() {
    let things: Vec<Box<dyn Describe>> = vec![
        Box::new(Dog { name: String::from("Rex") }),
        Box::new(Robot { model: 42 }),
    ];
    introduce_all(&things);
}
```

```text
This is Rex.
BEEP. I AM UNIT 42.
```
:::

:::exercise Display for a matrix
Write a struct `Grid { cells: Vec<Vec<u8>> }` and implement `Display` so that each row is printed on its own line with values separated by spaces. Use `write!` for values and `writeln!(f)` for line breaks, and use `?` after each call so errors propagate. Print a 2×3 grid.
:::solution
```rust
use std::fmt;

struct Grid {
    cells: Vec<Vec<u8>>,
}

impl fmt::Display for Grid {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for row in &self.cells {
            for (i, cell) in row.iter().enumerate() {
                if i > 0 {
                    write!(f, " ")?;
                }
                write!(f, "{cell}")?;
            }
            writeln!(f)?;
        }
        Ok(())
    }
}

fn main() {
    let g = Grid { cells: vec![vec![1, 2, 3], vec![4, 5, 6]] };
    print!("{g}");
}
```

```text
1 2 3
4 5 6
```
:::

```quiz
? A trait has a required method `name` and a default method `describe` that calls `name`. What must an implementor write?
+ Only `name`; `describe` comes for free unless they choose to override it.
- Both methods, always.
- Only `describe`.
- Nothing; all trait methods are optional.
= Required methods have no body in the trait and must be implemented. Default methods can be used as-is or overridden.

? What is the difference between `fn f(x: &impl Summary)` and `fn f<T: Summary>(x: &T)`?
- The first uses dynamic dispatch, the second static.
- The first only accepts types from the standard library.
+ Nothing important; `impl Trait` in argument position is shorthand for a generic parameter.
= Both are generic and use static dispatch. `dyn Summary` is what you'd write for dynamic dispatch.

? You need a `Vec` holding circles, squares and user-defined shapes that you don't know in advance. What should the element type be?
- `impl Shape`
- `T` where `T: Shape`
+ `Box<dyn Shape>`
= A trait object lets different concrete types sit in one collection, with methods looked up at run time. A generic `T` or `impl Shape` is always one concrete type.

? Which `impl` does the orphan rule forbid in your crate?
- `impl std::fmt::Display for MyType`
- `impl MyTrait for Vec<i32>`
+ `impl std::fmt::Display for Vec<i32>`
= You need to own either the trait or the type. In the last option both are defined in the standard library.
```
