---
title: Enums and Option
module: Modelling data
summary: Model values that can be one of several variants with enums, and meet Option, Rust's safe replacement for null.
minutes: 30
---

A struct says "a value has *all* of these fields". An **enum** (short for *enumeration*) says "a value is *one* of these possibilities". A traffic light is red, amber *or* green. A network request is pending, succeeded *or* failed. Enums let you write that down precisely, and the compiler then makes sure you handle every case.

Rust's enums are more powerful than the ones in many languages, because each variant can carry its own data. That one feature replaces a surprising number of patterns, including `null`.

## A simple enum

The simplest enum just lists its **variants**:

```rust
#[derive(Debug)]
enum Direction {
    North,
    East,
    South,
    West,
}

fn main() {
    let heading = Direction::North;
    let other = Direction::West;
    println!("{heading:?} and {other:?}");
}
```

```text
North and West
```

Variants are namespaced under the enum's name, so you write `Direction::North`. A value of type `Direction` is always exactly one of the four; there is no fifth "unset" state. `#[derive(Debug)]` works on enums just like on structs.

## Doing something with each variant: match

To act on an enum you use `match`. It compares a value against a list of **patterns** and runs the code for the first one that fits. Here is a first look; the next lesson covers `match` in depth.

```rust
enum Light {
    Red,
    Amber,
    Green,
}

fn action(light: Light) -> &'static str {
    match light {
        Light::Red => "stop",
        Light::Amber => "get ready",
        Light::Green => "go",
    }
}

fn main() {
    println!("{}", action(Light::Red));
    println!("{}", action(Light::Green));
}
```

```text
stop
go
```

Each line inside `match` is an **arm**: a pattern, `=>`, and an expression. `match` is itself an expression, so its value becomes the function's return value here. (The `&'static str` return type means "a string slice that lives for the whole program", which is what string literals are. You will learn exactly what `'static` means in the Lifetimes lesson.)

The key rule is that a `match` must be **exhaustive**. Delete the `Light::Green` arm and the program no longer compiles:

```rust,compile_fail
enum Light {
    Red,
    Amber,
    Green,
}

fn action(light: Light) -> &'static str {
    match light {
        Light::Red => "stop",
        Light::Amber => "get ready",
    }
}

fn main() {
    println!("{}", action(Light::Green));
}
```

```text
error[E0004]: non-exhaustive patterns: `Light::Green` not covered
 --> src/main.rs:8:11
  |
8 |     match light {
  |           ^^^^^ pattern `Light::Green` not covered
```

This is one of Rust's best features. If you add a new variant to an enum later, the compiler points at every `match` that needs updating.

## Variants that carry data

A variant can hold data, and different variants can hold different kinds of data. Some look like tuple structs, some like normal structs, some have nothing:

```rust
#[derive(Debug)]
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

fn describe(msg: &Message) -> String {
    match msg {
        Message::Quit => String::from("quit"),
        Message::Move { x, y } => format!("move to ({x}, {y})"),
        Message::Write(text) => format!("write {text:?}"),
        Message::ChangeColor(r, g, b) => format!("colour #{r:02x}{g:02x}{b:02x}"),
    }
}

fn main() {
    let messages = [
        Message::Move { x: 3, y: -1 },
        Message::Write(String::from("hello")),
        Message::ChangeColor(255, 128, 0),
        Message::Quit,
    ];
    for m in &messages {
        println!("{}", describe(m));
    }
}
```

```text
move to (3, -1)
write "hello"
colour #ff8000
quit
```

The patterns pull the data *out* of the variant and give it names (`x`, `y`, `text`, `r`...). Those names are only available inside that arm. That is the heart of enums: you can only get at the `String` inside `Write` after you have checked that the message really is a `Write`. You cannot accidentally read data that isn't there.

Because `describe` takes `&Message`, the names in each arm are references into the message rather than copies. That is why the function can borrow `messages` without moving anything out.

Doing the same with structs would need four separate types, or one struct with lots of optional fields where most combinations make no sense. The enum lists exactly the valid shapes and nothing else.

## Methods on enums

Enums get `impl` blocks just like structs. Inside a method, `self` is the enum value, and you usually `match` on it:

```rust
#[derive(Debug)]
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
            Shape::Rectangle { width, height } => width * height,
            Shape::Triangle { base, height } => 0.5 * base * height,
        }
    }

    fn name(&self) -> &'static str {
        match self {
            Shape::Circle { .. } => "circle",
            Shape::Rectangle { .. } => "rectangle",
            Shape::Triangle { .. } => "triangle",
        }
    }
}

fn main() {
    let shapes = [
        Shape::Circle { radius: 1.0 },
        Shape::Rectangle { width: 3.0, height: 4.0 },
        Shape::Triangle { base: 6.0, height: 2.0 },
    ];
    let mut total = 0.0;
    for s in &shapes {
        println!("{:<9} area {:.2}", s.name(), s.area());
        total += s.area();
    }
    println!("total area {total:.2}");
}
```

```text
circle    area 3.14
rectangle area 12.00
triangle  area 6.00
total area 21.14
```

`{ .. }` in a pattern means "I don't care about the fields". Notice that an array can hold circles, rectangles and triangles side by side, because they are all the same type: `Shape`.

## Option: a value that might be missing

Many languages have `null`, a special value meaning "nothing here". Its inventor, Tony Hoare, called it his "billion-dollar mistake", because any reference might secretly be null, and forgetting to check crashes the program.

Rust has no `null`. Instead, the standard library defines an ordinary enum:

```rust,ignore
enum Option<T> {
    None,
    Some(T),
}
```

The `<T>` means "for any type T". You will learn how to write types like that in the Generics lesson; for now read `Option<i32>` as "maybe an `i32`". `Option`, `Some` and `None` are so common that you can use them without the `Option::` prefix.

```rust
fn find_even(numbers: &[i32]) -> Option<i32> {
    for &n in numbers {
        if n % 2 == 0 {
            return Some(n);
        }
    }
    None
}

fn main() {
    let a = find_even(&[1, 3, 4, 7]);
    let b = find_even(&[1, 3, 5]);

    for result in [a, b] {
        match result {
            Some(n) => println!("found {n}"),
            None => println!("no even number"),
        }
    }
}
```

```text
found 4
no even number
```

Looping over `numbers`, a slice, gives you a reference `&i32` for each element. Writing `for &n` instead of `for n` is a small pattern that unpacks the reference, so `n` is a plain `i32`. The Pattern Matching lesson explains patterns like this.

The important part is that `Option<i32>` and `i32` are **different types**. You cannot add `1` to an `Option<i32>`, because it might be `None`:

```rust,compile_fail
fn main() {
    let maybe: Option<i32> = Some(5);
    let total = maybe + 1;
}
```

```text
error[E0369]: cannot add `{integer}` to `Option<i32>`
 --> src/main.rs:3:23
  |
3 |     let total = maybe + 1;
  |                 ----- ^ - {integer}
  |                 |
  |                 Option<i32>
```

So wherever a value might be missing, the type says so, and the compiler forces you to deal with the `None` case before you can use it. Everywhere else, a plain `i32` or `String` is guaranteed to be there. That is the whole trick, and it removes null-pointer crashes from safe Rust entirely.

## Handy Option methods

Writing a full `match` every time gets tedious, so `Option` comes with many helper methods. A few you will use constantly:

| Method | What it does | `Some(4)` gives | `None` gives |
| --- | --- | --- | --- |
| `is_some()` / `is_none()` | Test which variant it is | `true` / `false` | `false` / `true` |
| `unwrap_or(d)` | The value, or a default `d` | `4` | `d` |
| `map(f)` | Apply `f` to the value inside, if any | `Some(f(4))` | `None` |
| `unwrap()` | The value, or crash the program | `4` | panic |

```rust
fn main() {
    let present: Option<i32> = Some(4);
    let missing: Option<i32> = None;

    println!("{} {}", present.is_some(), missing.is_some());
    println!("{} {}", present.unwrap_or(0), missing.unwrap_or(0));
    println!("{:?} {:?}", present.map(|n| n * 10), missing.map(|n| n * 10));

    // Many standard library functions return Option.
    println!("{:?} {:?}", "GATTACA".find("TA"), "GATTACA".find("GG"));
}
```

```text
true false
4 0
Some(40) None
Some(3) None
```

The `|n| n * 10` syntax is a **closure**, a small anonymous function. You will study closures properly later; for now read it as "given `n`, produce `n * 10`".

:::warning Go easy on unwrap
`unwrap()` turns a `None` into a crash. It is fine in quick experiments and tests, but in real code prefer `match`, `unwrap_or`, or the tools you will learn in the Error Handling lesson.
:::

## A small state machine

Enums shine when a value moves through a series of states. Here is a door that can be opened, closed and locked, where some transitions are not allowed:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Door {
    Open,
    Closed,
    Locked,
}

#[derive(Debug, Clone, Copy)]
enum Action {
    Open,
    Close,
    Lock,
    Unlock,
}

impl Door {
    fn next(self, action: Action) -> Option<Door> {
        match (self, action) {
            (Door::Closed, Action::Open) => Some(Door::Open),
            (Door::Open, Action::Close) => Some(Door::Closed),
            (Door::Closed, Action::Lock) => Some(Door::Locked),
            (Door::Locked, Action::Unlock) => Some(Door::Closed),
            _ => None, // every other combination is not allowed
        }
    }
}

fn main() {
    let mut door = Door::Open;
    for action in [Action::Lock, Action::Close, Action::Lock, Action::Open] {
        match door.next(action) {
            Some(new_state) => {
                println!("{action:?}: {door:?} -> {new_state:?}");
                door = new_state;
            }
            None => println!("{action:?}: not possible while {door:?}"),
        }
    }
}
```

```text
Lock: not possible while Open
Close: Open -> Closed
Lock: Closed -> Locked
Open: not possible while Locked
```

Matching on a tuple `(self, action)` checks both values at once, and `_` is a catch-all pattern. Both are covered properly in the next lesson. The `derive` line adds `Clone`, `Copy` and `PartialEq` so that `Door` values can be copied like integers; the Traits lesson explains these.

:::exercise A safe Base type
DNA is written with four letters, so it is a perfect fit for an enum. Define `enum Base { A, C, G, T }` (derive `Debug, Clone, Copy, PartialEq`) and give it:

1. An associated function `from_char(c: char) -> Option<Base>` that accepts upper- or lowercase letters and returns `None` for anything else. Real sequencing data contains other letters, such as `N` for "unknown base".
2. A method `complement(self) -> Base`. In a DNA double helix, A always pairs with T and C with G, so the complement of `A` is `T`, and so on. (This is the pairing you used for REVC in lesson 07.)

Then write `fn first_invalid(dna: &str) -> Option<usize>` that returns the index of the first character that is not a base, or `None` if the whole string is valid. Test it on `"GATTACA"`, `"GATNACA"` and `"gattaca"`, and print `Base::from_char('c').map(|b| b.complement())`.
:::solution
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Base {
    A,
    C,
    G,
    T,
}

impl Base {
    fn from_char(c: char) -> Option<Base> {
        match c {
            'A' | 'a' => Some(Base::A),
            'C' | 'c' => Some(Base::C),
            'G' | 'g' => Some(Base::G),
            'T' | 't' => Some(Base::T),
            _ => None,
        }
    }

    fn complement(self) -> Base {
        match self {
            Base::A => Base::T,
            Base::T => Base::A,
            Base::C => Base::G,
            Base::G => Base::C,
        }
    }
}

fn first_invalid(dna: &str) -> Option<usize> {
    let mut position = 0;
    for c in dna.chars() {
        if Base::from_char(c).is_none() {
            return Some(position);
        }
        position += 1;
    }
    None
}

fn main() {
    println!("{:?} {:?} {:?}", Base::from_char('G'), Base::from_char('t'), Base::from_char('N'));
    println!("{:?}", Base::from_char('c').map(|b| b.complement()));

    for dna in ["GATTACA", "GATNACA", "gattaca"] {
        match first_invalid(dna) {
            Some(i) => println!("{dna}: bad character at index {i}"),
            None => println!("{dna}: all valid"),
        }
    }
}
```

```text
Some(G) Some(T) None
Some(G)
GATTACA: all valid
GATNACA: bad character at index 3
gattaca: all valid
```

`complement` takes `self` by value, which is fine because `Base` is `Copy`: calling it copies a tiny value instead of moving anything. Its `match` has no `_` arm, so if you ever added a fifth variant (say `N`), the compiler would point straight at this function.
:::

:::rosalind TRAN Transitions and Transversions
A **point mutation** replaces one base with another. Biologists split them into two kinds. The bases A and G are **purines** (bigger, two-ring molecules) and C and T are **pyrimidines** (smaller, one ring). Swapping a purine for a purine, or a pyrimidine for a pyrimidine (A↔G, C↔T), is a **transition**. Swapping across the groups is a **transversion**. Transitions keep the molecule's shape similar, so they happen more often, and the ratio of transitions to transversions is a useful statistic when comparing genomes.

You get a FASTA dataset with two DNA strings of equal length (their sequences may be wrapped over several lines). Print one number: the number of transitions divided by the number of transversions between them, as a decimal. Printing an `f64` with `{}` is precise enough.

Model it with enums:

1. The `Base` enum from the previous exercise, with `from_char` and a method `is_purine(self) -> bool`.
2. `enum Mutation { Transition, Transversion }`, and `fn classify(from: Base, to: Base) -> Option<Mutation>` that returns `None` when the bases are equal (no mutation at all).
3. The `parse_fasta` function from the GC exercise in the Structs lesson.

Walk both sequences by index. `seq.as_bytes()` gives you the bytes, and `b as char` turns one into a `char` for `from_char`. For this sample:

```text
>Rosalind_3310
GATTACAGGCTTAC
CGTA
>Rosalind_0072
AATCACTGGGTCAC
CTTG
```

there are 4 transitions and 3 transversions, so the output is:

```text
1.3333333333333333
```
:::solution
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Base {
    A,
    C,
    G,
    T,
}

impl Base {
    fn from_char(c: char) -> Option<Base> {
        match c {
            'A' => Some(Base::A),
            'C' => Some(Base::C),
            'G' => Some(Base::G),
            'T' => Some(Base::T),
            _ => None,
        }
    }

    fn is_purine(self) -> bool {
        match self {
            Base::A | Base::G => true,
            Base::C | Base::T => false,
        }
    }
}

#[derive(Debug, PartialEq)]
enum Mutation {
    Transition,
    Transversion,
}

fn classify(from: Base, to: Base) -> Option<Mutation> {
    if from == to {
        None
    } else if from.is_purine() == to.is_purine() {
        Some(Mutation::Transition)
    } else {
        Some(Mutation::Transversion)
    }
}

// The FASTA parser from the Structs lesson.
struct Record {
    id: String,
    seq: String,
}

fn parse_fasta(text: &str) -> Vec<Record> {
    let mut records: Vec<Record> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('>') {
            records.push(Record { id: line[1..].to_string(), seq: String::new() });
        } else {
            let last = records.len() - 1;
            records[last].seq.push_str(line);
        }
    }
    records
}

const DATASET: &str = "
>Rosalind_3310
GATTACAGGCTTAC
CGTA
>Rosalind_0072
AATCACTGGGTCAC
CTTG
";

fn main() {
    let records = parse_fasta(DATASET.trim());
    let s1 = records[0].seq.as_bytes();
    let s2 = records[1].seq.as_bytes();

    let mut transitions = 0;
    let mut transversions = 0;
    for i in 0..s1.len() {
        let from = Base::from_char(s1[i] as char);
        let to = Base::from_char(s2[i] as char);
        match (from, to) {
            (Some(a), Some(b)) => match classify(a, b) {
                Some(Mutation::Transition) => transitions += 1,
                Some(Mutation::Transversion) => transversions += 1,
                None => {} // same base: no mutation
            },
            _ => {} // skip anything that is not A, C, G or T
        }
    }

    println!("{}", transitions as f64 / transversions as f64);
}
```

```text
1.3333333333333333
```

Matching on the tuple `(from, to)` handles both `Option`s at once: the arm `(Some(a), Some(b))` only runs when both characters were valid bases. `is_purine` puts two variants in one arm with `|`, which you will see more of in the next lesson. Because each question ("is it a purine?", "what kind of mutation?") has its own small function, `main` reads almost like the biology description.
:::

```quiz
? What happens if a `match` on an enum forgets one of the variants?
- It compiles, and the missing variant is silently skipped.
- The program panics when that variant appears.
+ The program does not compile.
= `match` must be exhaustive. The compiler lists the variants you have not covered, which is a big help when you add a variant later.

? Why can't you write `let y = x + 1;` when `x` is an `Option<i32>`?
- Because `Option` values are immutable.
+ Because `Option<i32>` is a different type from `i32`, and it might be `None`.
- Because you must call `x.clone()` first.
- Because `+` only works on floats.
= The type system forces you to handle the "missing" case (with `match`, `unwrap_or` and friends) before you can use the value inside.

? What does `Some(3).map(|n| n + 1)` evaluate to?
- `4`
- `None`
+ `Some(4)`
- `Some(3)`
= `map` applies the closure to the value inside a `Some` and wraps the result back up. On `None` it returns `None`.

? Which statement about enum variants is true?
- Every variant must hold the same type of data.
+ Different variants can hold different data, or none at all.
- Variants can only hold numbers.
= A single enum can mix unit variants like `Quit`, tuple-like variants like `Write(String)` and struct-like variants like `Move { x: i32, y: i32 }`.
```
