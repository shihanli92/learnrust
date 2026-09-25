---
title: Modules and Visibility
module: Building a package
summary: Organise code into modules, decide what is public, and split a growing project across files in a library-plus-binary package.
minutes: 35
---

So far every program has lived in a single `main.rs`. That works for small things, but the goal of this course is a library that other people can use, and a library needs structure. Which parts are the public interface? Which are private details you are free to change later? How is the code split across files?

Rust answers these questions with **modules**. This lesson starts the "Building a package" module of the course: by the end of it, you will have everything you need to write, test, document and publish a crate of your own.

## Packages, crates and modules

Three words come up constantly, and they mean different things:

| Term | What it is |
| --- | --- |
| **Package** | A folder with a `Cargo.toml`. It is what `cargo new` creates and what you publish. It contains one or more crates. |
| **Crate** | A unit of compilation. Either a *binary crate* (a program with `fn main`) or a *library crate* (code for other crates to use). |
| **Module** | A named container for items (functions, structs, enums, constants, other modules) inside a crate. |

Each crate starts from one file, its **crate root**. Cargo uses a simple convention:

- `src/main.rs` is the root of a binary crate with the same name as the package.
- `src/lib.rs` is the root of a library crate with the same name as the package.

A package may have both. You will see why that is useful at the end of this lesson.

## Modules and privacy

You create a module with `mod` and a block of items. Items inside are reached with a path using `::`:

```rust
mod kitchen {
    pub fn make_toast() -> String {
        let bread = slice_bread();
        format!("toasted {bread}")
    }

    fn slice_bread() -> String {
        String::from("sourdough")
    }

    pub mod fridge {
        pub fn take_butter() -> &'static str {
            "butter"
        }
    }
}

fn main() {
    println!("{}", kitchen::make_toast());
    println!("with {}", kitchen::fridge::take_butter());
}
```

```text
toasted sourdough
with butter
```

Everything in Rust is **private by default**. `slice_bread` has no `pub`, so only code inside `kitchen` (and modules nested inside it) can call it. Try from outside and the compiler stops you:

```rust,compile_fail
mod kitchen {
    fn slice_bread() -> String {
        String::from("sourdough")
    }
}

fn main() {
    println!("{}", kitchen::slice_bread());
}
```

```text
error[E0603]: function `slice_bread` is private
 --> src/main.rs:8:29
  |
8 |     println!("{}", kitchen::slice_bread());
  |                             ^^^^^^^^^^^ private function
```

Why private by default? Because everything you make public is a promise. Once other people call `slice_bread`, you can no longer rename it, change its arguments or delete it without breaking their code. Keeping things private until you have a reason to expose them leaves you free to change your mind.

Two details about the rules:

- Privacy is about *where* the code is, not about the struct or function. Code in a child module can see everything in its ancestors, even private items. Code in a parent can only see the child's `pub` items.
- `pub mod fridge` makes the module itself reachable, but you still need `pub` on each item inside it that should be visible.

## pub on structs and enums

Structs and enums differ in one important way.

A `pub struct` is visible, but **each field is still private** unless you mark it `pub` too. An enum is the opposite: if the enum is `pub`, **all its variants are public** automatically. A variant you couldn't name would be useless for matching, so Rust doesn't make you repeat yourself.

```rust
mod bank {
    pub struct Account {
        pub owner: String,
        balance: u64,
    }

    impl Account {
        pub fn new(owner: &str) -> Account {
            Account { owner: owner.to_string(), balance: 0 }
        }

        pub fn deposit(&mut self, amount: u64) {
            self.balance += amount;
        }

        pub fn balance(&self) -> u64 {
            self.balance
        }
    }

    #[derive(Debug)]
    pub enum Currency {
        Euro,
        Dollar,
    }
}

fn main() {
    let mut acct = bank::Account::new("Mia");
    acct.deposit(50);
    println!("{} has {} in {:?}", acct.owner, acct.balance(), bank::Currency::Euro);
    let _other = bank::Currency::Dollar;
}
```

```text
Mia has 50 in Euro
```

Because `balance` is private, code outside `bank` can't write `acct.balance = 1_000_000`, and it can't build an `Account` with a struct literal either. The only way in is through `new` and `deposit`. This is how Rust libraries protect *invariants*, rules like "the balance only changes through deposits":

```rust,compile_fail
mod bank {
    pub struct Account {
        pub owner: String,
        balance: u64,
    }
}

fn main() {
    let acct = bank::Account { owner: String::from("Mia"), balance: 1_000_000 };
}
```

```text
error[E0451]: field `balance` of struct `Account` is private
 --> src/main.rs:9:60
  |
9 |     let acct = bank::Account { owner: String::from("Mia"), balance: 1_000_000 };
  |                                                            ^^^^^^^ private field
```

## Paths: crate, self and super

A path can start in three special places:

| Path starts with | Means |
| --- | --- |
| `crate::` | the root of the current crate (an *absolute* path) |
| `self::` | the current module |
| `super::` | the parent module, like `..` in a file system |

```rust
mod shop {
    const TAX_RATE: f64 = 0.25;

    fn tax(amount: f64) -> f64 {
        amount * TAX_RATE
    }

    pub mod checkout {
        pub fn total(prices: &[f64]) -> f64 {
            let subtotal: f64 = prices.iter().sum();
            subtotal + super::tax(subtotal)
        }

        pub fn receipt(prices: &[f64]) -> String {
            format!("Total: {:.2}", self::total(prices))
        }
    }
}

fn main() {
    println!("{}", crate::shop::checkout::receipt(&[4.0, 6.0, 2.0]));
    println!("{}", shop::checkout::total(&[10.0]));
}
```

```text
Total: 15.00
12.5
```

`super::tax` works even though `tax` is private, because `checkout` is a child of `shop`. `self::` is usually optional (`total(prices)` would work too). Prefer `crate::` paths when you refer to something far away in your own crate; they keep working if you move the code that uses them.

## use: shorter names

Writing `crate::shop::checkout::total` every time gets old. A `use` declaration creates a shortcut in the current scope:

```rust
use std::collections::HashMap;
use std::fmt::{self, Display};

mod shapes {
    pub struct Square(pub f64);
}

use shapes::Square;

impl Display for Square {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "square with side {}", self.0)
    }
}

fn main() {
    let mut named = HashMap::new();
    named.insert("small", Square(1.0));
    named.insert("big", Square(10.0));
    println!("{}", named["big"]);
}
```

```text
square with side 10
```

A few conventions keep code readable:

- For **types** (structs, enums, traits), import the item itself: `use std::collections::HashMap;` and then write `HashMap`.
- For **functions**, import the parent module and call `module::function()`. Seeing `checkout::total(...)` tells the reader the function is not defined locally.
- Group imports from the same place with braces. `self` inside the braces imports the module itself, as in `use std::fmt::{self, Display};`.
- If two names clash, rename one with `as`: `use std::io::Result as IoResult;`.

## Re-exports with pub use

A plain `use` is private: the shortcut exists only inside that module. `pub use` makes it part of your public interface. This is called a **re-export**, and libraries use it to present a tidy API while organising the code however they like internally:

```rust
mod geometry {
    mod circle {
        pub struct Circle {
            pub radius: f64,
        }

        impl Circle {
            pub fn area(&self) -> f64 {
                std::f64::consts::PI * self.radius * self.radius
            }
        }
    }

    pub use circle::Circle;
}

fn main() {
    let c = geometry::Circle { radius: 2.0 };
    println!("area: {:.2}", c.area());
}
```

```text
area: 12.57
```

The `circle` module is private, so outside code can't write `geometry::circle::Circle`. Users see the short path `geometry::Circle`, and you can later move `Circle` to another internal module without breaking anyone. Well-known crates do this all the time: many of the types you use from the standard library live in private modules and are re-exported.

:::tip pub(crate)
Sometimes an item should be usable anywhere in your crate but not by other crates. Write `pub(crate) fn helper()` for that. It is common for internal helpers in larger libraries.
:::

## Splitting modules into files

Inline `mod name { ... }` blocks are handy for examples, but real projects put each module in its own file. Replace the block with a declaration that ends in a semicolon:

```rust,ignore,file=src/lib.rs
pub mod geometry;
```

That line tells the compiler "there is a module called `geometry`; its contents are in another file". Cargo looks for `src/geometry.rs`. A module can have its own submodules, which live in a folder with the module's name:

```text
shapes/
├── Cargo.toml
└── src/
    ├── lib.rs           # pub mod geometry;
    ├── geometry.rs      # mod circle; mod square; pub use ...
    └── geometry/
        ├── circle.rs
        └── square.rs
```

```rust,ignore,file=src/geometry.rs
mod circle;
mod square;

pub use circle::Circle;
pub use square::Square;
```

```rust,ignore,file=src/geometry/circle.rs
pub struct Circle {
    pub radius: f64,
}

impl Circle {
    pub fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}
```

Notice that `circle.rs` does not contain `mod circle { ... }`. The file *is* the module body. Its name comes from the `mod circle;` line in the parent. A file that isn't declared with `mod` somewhere is simply ignored by the compiler, which is a common beginner surprise.

There is an older layout you will still see in many projects: `src/geometry/mod.rs` instead of `src/geometry.rs`. Both work the same. The newer style is recommended because otherwise every module folder has a file called `mod.rs`, and an editor with five `mod.rs` tabs open is confusing. Pick one style per project.

## A library and a binary in one package

Here is the layout the capstone project will use. The package has *both* `src/lib.rs` and `src/main.rs`, which means it contains two crates: a library and a binary, both named after the package.

```text
area-calc/
├── Cargo.toml       # name = "area-calc"
└── src/
    ├── lib.rs       # the library crate: all the real logic
    └── main.rs      # the binary crate: a thin command-line wrapper
```

```rust,ignore,file=src/lib.rs
pub fn circle_area(radius: f64) -> f64 {
    std::f64::consts::PI * radius * radius
}
```

```rust,ignore,file=src/main.rs
fn main() {
    let area = area_calc::circle_area(3.0);
    println!("A circle of radius 3 has area {area:.2}");
}
```

The binary is a separate crate, so it uses the library **by name**, exactly as any other project would, and it can only see `pub` items. `crate::` in `main.rs` would refer to the binary crate, not the library. Package names may contain hyphens, but crate names in code can't, so `area-calc` becomes `area_calc`.

Why bother splitting? Everything in `lib.rs` can be reused by other programs and is easy to test, while `main.rs` stays small: read the input, call the library, print the result. It also forces you to design a public API, because `main.rs` is your library's first user.

:::exercise Fix the privacy errors
This program doesn't compile. Add the minimum number of `pub` keywords to make it work. Don't make `secret_ingredient` public.

```rust,compile_fail
mod bakery {
    mod oven {
        fn bake(item: &str) -> String {
            format!("freshly baked {item} with {}", super::secret_ingredient())
        }
    }

    fn secret_ingredient() -> &'static str {
        "love"
    }

    struct Order {
        item: String,
    }

    impl Order {
        fn new(item: &str) -> Order {
            Order { item: item.to_string() }
        }

        fn complete(&self) -> String {
            oven::bake(&self.item)
        }
    }
}

fn main() {
    let order = bakery::Order::new("bread");
    println!("{}", order.complete());
}
```
:::solution
```rust
mod bakery {
    mod oven {
        pub fn bake(item: &str) -> String {
            format!("freshly baked {item} with {}", super::secret_ingredient())
        }
    }

    fn secret_ingredient() -> &'static str {
        "love"
    }

    pub struct Order {
        item: String,
    }

    impl Order {
        pub fn new(item: &str) -> Order {
            Order { item: item.to_string() }
        }

        pub fn complete(&self) -> String {
            oven::bake(&self.item)
        }
    }
}

fn main() {
    let order = bakery::Order::new("bread");
    println!("{}", order.complete());
}
```

`oven` itself can stay private, because only code inside `bakery` uses it, but `bake` needs `pub` so its parent can call it. `Order`, `new` and `complete` are used from `main`, so they need `pub`. The `item` field and `secret_ingredient` can stay private: `oven` is a child of `bakery`, so it may call its parent's private function.
:::

:::exercise Move modules into files
Take the `geometry` example from the "Re-exports with pub use" section and turn it into a library package called `shapes`, with `geometry` in its own file and `circle` in its own file inside a folder. Write down the directory tree and the contents of each file.
:::solution
```text
shapes/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── geometry.rs
    └── geometry/
        └── circle.rs
```

```rust,ignore,file=src/lib.rs
pub mod geometry;
```

```rust,ignore,file=src/geometry.rs
mod circle;

pub use circle::Circle;
```

```rust,ignore,file=src/geometry/circle.rs
pub struct Circle {
    pub radius: f64,
}

impl Circle {
    pub fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}
```

Another crate can now write `use shapes::geometry::Circle;`. If you want users to write `shapes::Circle`, add `pub use geometry::Circle;` to `lib.rs`.
:::

```quiz
? A `pub struct` has a field without `pub`. What can code outside the module do with that field?
- Read it but not change it.
+ Nothing: it can neither read nor write it, nor build the struct with a literal.
- Everything, because the struct is public.
- Only change it through a `&mut` reference.
= Struct fields are private unless marked `pub`. Outside code has to go through public methods such as a constructor and getters.

? What does `pub use internal::Widget;` in `lib.rs` do?
- Makes the `internal` module public.
- Copies `Widget` into a new type.
+ Lets users of the crate refer to `Widget` directly from the crate root, even if `internal` is private.
- Nothing; `use` can't be `pub`.
= A re-export adds a public path to an item, so your public API can differ from your internal file layout.

? Inside `src/main.rs` of a package named `word-tools` that also has a `src/lib.rs`, how do you call the library's public function `count`?
- `crate::count()`
- `lib::count()`
- `word-tools::count()`
+ `word_tools::count()`
= The binary is its own crate and uses the library by name, with the hyphen replaced by an underscore.

? You add `src/parser.rs` to a project but its code never seems to get compiled. What is most likely missing?
+ A `mod parser;` line in the crate root (or its parent module).
- A `pub` keyword at the top of `parser.rs`.
- An entry for the file in `Cargo.toml`.
- A `use parser;` line in `main.rs`.
= Files only become modules when a parent declares them with `mod`. Cargo does not compile every file in `src/` automatically.
```
