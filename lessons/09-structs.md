---
title: Structs and Methods
module: Modelling data
summary: Group related values into your own types with structs, and give them behaviour with methods and associated functions.
minutes: 30
---

So far every value you have worked with has been a number, a boolean, a string or a tuple. Real programs deal with *things*: users, orders, points on a map. A **struct** lets you bundle several related values under one name and give each value a label, so the compiler (and the next person reading your code) knows what they mean.

Structs are also where Rust code starts to look organised. Once you have a type, you can attach functions to it, called **methods**, and call them with the familiar `value.method()` syntax.

## Defining and creating a struct

A struct definition lists its **fields**, each with a name and a type:

```rust
struct User {
    name: String,
    email: String,
    age: u32,
    active: bool,
}

fn main() {
    let user = User {
        name: String::from("Ada"),
        email: String::from("ada@example.com"),
        age: 36,
        active: true,
    };

    println!("{} <{}> is {} years old.", user.name, user.email, user.age);
    println!("Active: {}", user.active);
}
```

```text
Ada <ada@example.com> is 36 years old.
Active: true
```

You create an **instance** by writing the struct name and a value for every field, in any order. Leaving a field out is a compile error: Rust has no "uninitialised" or `null` fields. You read fields with a dot.

To change a field, the whole binding must be mutable. Rust does not let you mark individual fields as `mut`:

```rust
struct Counter {
    count: u32,
}

fn main() {
    let mut c = Counter { count: 0 };
    c.count += 1;
    c.count += 1;
    println!("count = {}", c.count);
}
```

```text
count = 2
```

Notice that `User` stores `String`, not `&str`. That is deliberate: the struct **owns** its data, so it stays valid for as long as the struct does. Structs can hold references too, but that needs lifetimes, which you will meet in a later lesson.

## Shorthand for building structs

### Field init shorthand

When a variable has the same name as a field, you can write the name once. This is very common in constructor-style functions:

```rust
struct User {
    name: String,
    age: u32,
}

fn build_user(name: String, age: u32) -> User {
    // Same as User { name: name, age: age }
    User { name, age }
}

fn main() {
    let u = build_user(String::from("Grace"), 45);
    println!("{} is {}", u.name, u.age);
}
```

```text
Grace is 45
```

### Struct update syntax

To create a new instance that mostly copies another, list the fields that change and then write `..other` to take the rest from `other`:

```rust
struct Settings {
    volume: u8,
    brightness: u8,
    dark_mode: bool,
}

fn main() {
    let defaults = Settings { volume: 50, brightness: 80, dark_mode: false };
    let night = Settings { dark_mode: true, brightness: 30, ..defaults };

    println!("night: volume {}, brightness {}, dark {}", night.volume, night.brightness, night.dark_mode);
    println!("defaults still usable: volume {}", defaults.volume);
}
```

```text
night: volume 50, brightness 30, dark true
defaults still usable: volume 50
```

:::warning Update syntax moves
`..other` works like assignment, so ownership rules apply. Here every copied field is a `u8` or `bool`, which are `Copy`, so `defaults` is still usable. If a copied field were a `String`, it would be *moved* into the new struct and you could no longer use that field of the old one.
:::

## Tuple structs and unit structs

Sometimes naming every field is overkill. A **tuple struct** has a name but its fields are positional, accessed with `.0`, `.1` and so on:

```rust
struct Rgb(u8, u8, u8);
struct Meters(f64);
struct Feet(f64);

fn to_feet(m: Meters) -> Feet {
    Feet(m.0 * 3.28084)
}

fn main() {
    let orange = Rgb(255, 165, 0);
    println!("red = {}, green = {}, blue = {}", orange.0, orange.1, orange.2);

    let height = Meters(2.0);
    let f = to_feet(height);
    println!("2 m is {:.2} ft", f.0);
}
```

```text
red = 255, green = 165, blue = 0
2 m is 6.56 ft
```

`Meters` and `Feet` show the **newtype** idea: wrapping a single value in its own type. Both hold an `f64`, but they are different types, so passing `Feet` where `Meters` is expected is a compile error. A mix-up between metric and imperial units once destroyed a real Mars probe. Newtypes cost nothing at run time; the wrapper disappears after compilation.

A **unit struct** has no fields at all: `struct Marker;`. It sounds useless, but it becomes handy once you learn about traits, where you sometimes need a type that carries behaviour but no data.

## Printing structs with Debug

Try to print a struct with `{:?}` and the compiler refuses:

```rust,compile_fail
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };
    println!("{:?}", p);
}
```

```text
error[E0277]: `Point` doesn't implement `Debug`
 --> src/main.rs:8:22
  |
8 |     println!("{:?}", p);
  |               ----   ^ `Point` cannot be formatted using `{:?}` because it doesn't implement `Debug`
  |               |
  |               required by this formatting parameter
  |
  = help: the trait `Debug` is not implemented for `Point`
  = note: add `#[derive(Debug)]` to `Point` or manually `impl Debug for Point`
```

Rust does not guess how your type should be shown. The fix is in the note: put `#[derive(Debug)]` above the struct and the compiler writes the formatting code for you. Use `{:#?}` for a "pretty" multi-line version, which is easier to read for bigger structs:

```rust
#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };
    println!("{:?}", p);
    println!("{p:#?}");
}
```

```text
Point { x: 1, y: 2 }
Point {
    x: 1,
    y: 2,
}
```

`#[derive(...)]` is an **attribute** that asks the compiler to generate code. You will see it a lot, with other names inside the parentheses, once you reach the lesson on traits.

## Methods

A **method** is a function defined inside an `impl` block (short for *implementation*) for a type. Its first parameter is always some form of `self`, the value the method is called on:

```rust
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let big = Rectangle { width: 30, height: 50 };
    let small = Rectangle { width: 10, height: 40 };

    println!("area of big: {}", big.area());
    println!("big can hold small: {}", big.can_hold(&small));
    println!("small can hold big: {}", small.can_hold(&big));
}
```

```text
area of big: 1500
big can hold small: true
small can hold big: false
```

`&self` is short for `self: &Self`, and inside an `impl` block `Self` means "the type this block is for", here `Rectangle`. So `area` *borrows* the rectangle immutably, exactly like a function taking `&Rectangle` would. When you write `big.area()`, Rust automatically borrows `big` for you. You never need to write `(&big).area()`.

### Choosing the kind of self

The first parameter decides what the method is allowed to do with the value, using the ownership rules you already know:

| First parameter | Meaning | Use it when |
| --- | --- | --- |
| `&self` | Borrow immutably | You only need to read. This is the most common. |
| `&mut self` | Borrow mutably | You need to change fields. |
| `self` | Take ownership | You are transforming or consuming the value, and the caller should not use it afterwards. |

```rust
#[derive(Debug)]
struct Account {
    owner: String,
    balance: i64,
}

impl Account {
    fn deposit(&mut self, amount: i64) {
        self.balance += amount;
    }

    fn balance(&self) -> i64 {
        self.balance
    }

    fn close(self) -> String {
        format!("Closed account of {} with {}", self.owner, self.balance)
    }
}

fn main() {
    let mut acct = Account { owner: String::from("Lin"), balance: 0 };
    acct.deposit(100);
    acct.deposit(25);
    println!("balance: {}", acct.balance());

    let receipt = acct.close();
    println!("{receipt}");
    // acct.deposit(5); // error: `acct` was moved by `close`
}
```

```text
balance: 125
Closed account of Lin with 125
```

A method may have the same name as a field. `acct.balance()` with parentheses calls the method, and `acct.balance` without them reads the field. Getter methods like this are common when you later make fields private.

## Associated functions and constructors

Functions in an `impl` block that do *not* take `self` are **associated functions**. You call them with `Type::name()`. You have been doing this all along with `String::from`.

Rust has no special constructor syntax. By convention, a type gets an associated function called `new` that returns `Self`:

```rust
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }

    fn square(size: u32) -> Self {
        Self { width: size, height: size }
    }
}

// You may split methods across several impl blocks.
impl Rectangle {
    fn is_square(&self) -> bool {
        self.width == self.height
    }
}

fn main() {
    let r = Rectangle::new(3, 4);
    let s = Rectangle::square(5);
    println!("{r:?} square? {}", r.is_square());
    println!("{s:?} square? {}", s.is_square());
}
```

```text
Rectangle { width: 3, height: 4 } square? false
Rectangle { width: 5, height: 5 } square? true
```

Writing `Self` instead of repeating `Rectangle` means you only have one place to change if you rename the type. Multiple `impl` blocks are allowed, and are the same as one big block. You will mostly use a single block, but splitting them becomes useful with generics and traits.

:::tip Constructors can validate
Because `new` is an ordinary function, it can check its inputs, round values or fill in defaults. That lets a type guarantee its fields are always sensible, something a bare struct literal can't do.
:::

:::exercise A temperature type
Define a struct `Temperature` with one field `celsius: f64`, deriving `Debug`. Give it:

1. An associated function `new(celsius: f64) -> Self`.
2. A method `fahrenheit(&self) -> f64` (the formula is `c * 9.0 / 5.0 + 32.0`).
3. A method `warm_by(&mut self, degrees: f64)` that increases the temperature.

In `main`, create a temperature of 20 °C, print it in Fahrenheit, warm it by 5 degrees, then print the struct with `{:?}`.
:::solution
```rust
#[derive(Debug)]
struct Temperature {
    celsius: f64,
}

impl Temperature {
    fn new(celsius: f64) -> Self {
        Self { celsius }
    }

    fn fahrenheit(&self) -> f64 {
        self.celsius * 9.0 / 5.0 + 32.0
    }

    fn warm_by(&mut self, degrees: f64) {
        self.celsius += degrees;
    }
}

fn main() {
    let mut t = Temperature::new(20.0);
    println!("{} °F", t.fahrenheit());
    t.warm_by(5.0);
    println!("{t:?}");
}
```

```text
68 °F
Temperature { celsius: 25.0 }
```
:::

:::exercise Consuming a builder
Write a struct `Pizza` with fields `size: u32` and `toppings: Vec<String>`. Add `new(size: u32) -> Self` (no toppings), and a method `with(self, topping: &str) -> Self` that takes the pizza by value, adds the topping and returns it. This lets you chain calls: `Pizza::new(30).with("cheese").with("olives")`. Print the result with `{:#?}`.

`Vec` is Rust's growable list, covered properly in the Collections lesson. For now you only need `Vec::new()` to make an empty one and `.push(value)` to add to it.
:::solution
```rust
#[derive(Debug)]
struct Pizza {
    size: u32,
    toppings: Vec<String>,
}

impl Pizza {
    fn new(size: u32) -> Self {
        Self { size, toppings: Vec::new() }
    }

    fn with(mut self, topping: &str) -> Self {
        self.toppings.push(topping.to_string());
        self
    }
}

fn main() {
    let pizza = Pizza::new(30).with("cheese").with("olives");
    println!("{pizza:#?}");
}
```

Taking `mut self` means the method owns the pizza and may change it before handing it back. This "builder" pattern is common in Rust libraries.
:::

```quiz
? Inside `impl Rectangle { ... }`, what does `Self` refer to?
- The current instance of the rectangle
+ The type `Rectangle`
- The module the struct is defined in
= `Self` (capital S) is the type the `impl` block is for. `self` (lowercase) is the instance a method was called on.

? A method needs to change one of the struct's fields but the caller should keep using the value afterwards. Which first parameter fits?
- `self`
- `&self`
+ `&mut self`
- no `self` parameter at all
= `&mut self` borrows the value mutably for the duration of the call. `self` would take ownership, so the caller could not use it afterwards.

? How do you call an associated function `new` on a type `Config`?
- `Config.new()`
- `new Config()`
+ `Config::new()`
= Associated functions have no `self`, so they are called on the type with `::`. Methods are called on a value with `.`.

? What is the main benefit of a newtype like `struct Meters(f64);`?
+ The compiler stops you from mixing it up with other values that are also `f64`.
- It makes arithmetic on the number faster.
- It lets the value be `null`.
- It allocates the number on the heap.
= A newtype is a distinct type with zero run-time cost, so passing `Feet` where `Meters` is expected becomes a compile error.
```
