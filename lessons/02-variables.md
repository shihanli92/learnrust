---
title: Variables and Mutability
module: Getting started
summary: Declare variables with let, see why they are immutable by default, and learn when to reach for mut, constants and shadowing.
minutes: 25
---

Every program needs to hold on to values: a user's name, a running total, the current level in a game. In Rust you give a value a name with `let`. That part looks like most other languages. What is different is the default: once you give a name a value, Rust assumes it will not change unless you say otherwise.

This lesson covers how to declare variables, why immutability is the default, and the tools Rust gives you for the times you do need change: `mut`, constants and shadowing.

## Declaring variables with let

A `let` statement binds a value to a name:

```rust
fn main() {
    let apples = 5;
    let cents_per_apple = 40;
    let weight_kg = 1.2;
    let fruit = "apple";
    println!("{apples} {fruit}s weigh {weight_kg} kg and cost {} cents.", apples * cents_per_apple);
}
```

```text
5 apples weigh 1.2 kg and cost 200 cents.
```

Variable names use `snake_case`: lowercase words joined by underscores. The compiler will warn you if you write `centsPerApple` instead.

Notice that none of the variables above say what *type* they are. Rust figured out that `apples` is an integer, `weight_kg` is a number with a decimal point and `fruit` is text. This is called **type inference**, and you will see more of it at the end of this lesson.

## Immutable by default

Try to change a variable after creating it and the compiler stops you:

```rust,compile_fail
fn main() {
    let x = 5;
    println!("x is {x}");
    x = 6;
    println!("x is {x}");
}
```

```text
error[E0384]: cannot assign twice to immutable variable `x`
 --> src/main.rs:4:5
  |
2 |     let x = 5;
  |         - first assignment to `x`
3 |     println!("x is {x}");
4 |     x = 6;
  |     ^^^^^ cannot assign twice to immutable variable
  |
help: consider making this binding mutable
  |
2 |     let mut x = 5;
  |         +++
```

This can feel like an odd restriction at first. Why would a language make variables that cannot vary? There are good reasons:

- **Easier reading.** When you see `let total = ...`, you know `total` holds that value for the rest of the block. You don't have to scan the following fifty lines to check whether something changed it.
- **Fewer bugs.** A lot of bugs come from a value being changed somewhere you did not expect. If a value was never meant to change, the compiler now enforces that for you.
- **Safe sharing.** Data that never changes can be read from many places at once, even from several threads, without any risk. This idea returns in a big way in the Ownership module.

In practice, most variables in a Rust program never change, so the default fits real code well.

## Opting in with mut

When a value really does need to change, add `mut` (short for *mutable*) to the declaration:

```rust
fn main() {
    let mut score = 0;
    println!("Starting score: {score}");

    score = score + 10;
    score += 5; // shorthand for score = score + 5
    println!("Final score: {score}");
}
```

```text
Starting score: 0
Final score: 15
```

`mut` is a signal to anyone reading the code: "keep an eye on this one, it changes." If you add `mut` but never actually change the variable, the compiler warns you that the `mut` is unnecessary. That keeps the signal honest.

:::tip Let the compiler guide you
A good habit is to write `let` without `mut`, and only add `mut` when the compiler tells you it is needed. The `help:` line in the error above even shows you exactly where to put it.
:::

## Constants

A **constant** is a value that is fixed for the whole program. You declare it with `const`:

```rust
const SECONDS_PER_HOUR: u32 = 60 * 60;
const MAX_PLAYERS: u32 = 4;

fn main() {
    let hours = 3;
    println!("{hours} hours is {} seconds", hours * SECONDS_PER_HOUR);
    println!("Up to {MAX_PLAYERS} players can join.");
}
```

```text
3 hours is 10800 seconds
Up to 4 players can join.
```

Constants differ from immutable `let` variables in a few ways:

| | `let` | `const` |
| --- | --- | --- |
| Can be made mutable | Yes, with `mut` | Never |
| Type annotation | Optional (inferred) | Required, e.g. `: u32` |
| Value computed | When the program runs | When the program compiles |
| Where it can live | Inside functions | Anywhere, including outside every function |
| Naming style | `snake_case` | `SCREAMING_SNAKE_CASE` |

Because a constant's value is worked out at compile time, it must be something the compiler can calculate by itself, like `60 * 60`. It cannot depend on anything that only happens while the program runs, such as user input.

Use constants for values with a meaning that you would otherwise sprinkle through your code as "magic numbers". `SECONDS_PER_HOUR` says what `3600` means, and if a value ever has to change, you change it in one place.

## Shadowing

You can declare a new variable with the same name as an earlier one. The new variable **shadows** the old one: from that point on, the name refers to the new value.

```rust
fn main() {
    let x = 5;
    let x = x + 1; // a new `x`, built from the old one

    {
        let x = x * 2; // shadows `x` only inside these braces
        println!("Inner x: {x}");
    }

    println!("Outer x: {x}");
}
```

```text
Inner x: 12
Outer x: 6
```

Curly braces create a new **scope**. The inner `x` exists only until the closing brace, and after that the outer `x` (still `6`) is visible again.

Shadowing is not the same as mutation. Each `let` creates a brand-new variable, and every one of those variables is still immutable. Shadowing is useful when you transform a value in steps and don't need the earlier versions any more.

### Shadowing can change the type

Because shadowing creates a new variable, the new one can have a different type. That is something `mut` can't do:

```rust
fn main() {
    let spaces = "    ";        // text
    let spaces = spaces.len();  // now a number: how many characters
    println!("There are {spaces} spaces.");
}
```

```text
There are 4 spaces.
```

Try the same thing with `mut` and the compiler objects, because a variable's type is fixed when it is created:

```rust,compile_fail
fn main() {
    let mut spaces = "    ";
    spaces = spaces.len();
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:3:14
  |
2 |     let mut spaces = "    ";
  |                      ------ expected due to this value
3 |     spaces = spaces.len();
  |              ^^^^^^^^^^^^ expected `&str`, found `usize`
```

Shadowing saves you from inventing names like `spaces_str` and `spaces_num` for what is really one idea.

| | Shadowing (`let x` again) | Mutation (`let mut x`) |
| --- | --- | --- |
| Creates a new variable | Yes | No, changes the existing one |
| Can change the type | Yes | No |
| Result is mutable | No, unless you write `let mut` | Yes |
| Typical use | Transform a value in steps | A counter or total that changes over time |

## Type annotations and inference

You can write a variable's type yourself with a colon after the name:

```rust
fn main() {
    let count: i32 = 42;
    let ratio: f64 = 0.75;
    let active: bool = true;
    println!("{count} {ratio} {active}");
}
```

```text
42 0.75 true
```

Most of the time you don't need to, because the compiler infers the type from the value and from how you use it. Rust is still **statically typed**: every variable has one definite type, known at compile time. Inference only saves you from typing it out.

There are cases where the compiler cannot work out the type on its own and asks you for an annotation. You will meet those, and the full list of basic types like `i32` and `f64`, in the next lesson.

## Unused variables and the underscore

If you create a variable and never use it, the compiler warns you. The program still compiles, but the warning often points at a real mistake, such as a typo in a name or a value you forgot to print:

```text
warning: unused variable: `temperature`
 --> src/main.rs:2:9
  |
2 |     let temperature = 21;
  |         ^^^^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_temperature`
```

Sometimes an unused variable is deliberate, for example while you are still sketching a program. Starting the name with an underscore tells the compiler "I know this is unused":

```rust
fn main() {
    let _temperature = 21; // no warning: the underscore marks it as intentionally unused
    println!("Still working on the weather report...");
}
```

```text
Still working on the weather report...
```

A lone `_` is special: it is not a name at all, just a placeholder meaning "I don't need this value". You will see it in patterns and loops in later lessons.

:::exercise Fix the counter
This program does not compile. Fix it with the smallest possible change, then run it.

```rust,compile_fail
fn main() {
    let laps = 0;
    laps += 1;
    laps += 1;
    laps += 1;
    println!("You ran {laps} laps.");
}
```
:::solution
The variable changes, so it needs `mut`:

```rust
fn main() {
    let mut laps = 0;
    laps += 1;
    laps += 1;
    laps += 1;
    println!("You ran {laps} laps.");
}
```

```text
You ran 3 laps.
```
:::

:::exercise Shadow in steps
Start with `let word = "ferris";`. Using shadowing (no `mut`), turn `word` into its length, then into double that length, and print the final value. Then add a constant `BONUS: usize = 100` and print the length plus the bonus.
:::solution
```rust
const BONUS: usize = 100;

fn main() {
    let word = "ferris";
    let word = word.len();
    let word = word * 2;
    println!("Doubled length: {word}");
    println!("With bonus: {}", word + BONUS);
}
```

```text
Doubled length: 12
With bonus: 112
```

`len()` returns a `usize`, which is why the constant is declared as `usize` too. Rust does not mix number types automatically; the next lesson explains why.
:::

```quiz
? What happens if you assign a new value to a variable declared with plain `let x = 5;`?
- The value changes and the compiler prints a warning.
+ The program does not compile.
- The program panics when it reaches the assignment.
- A new variable is created automatically.
= Variables are immutable by default. Assigning to one is a compile error (E0384) until you declare it with `let mut`.

? Which of these can change the *type* of a value stored under a name?
- `let mut` followed by an assignment
- `const`
+ Shadowing with a second `let`
- None of them; types can never change
= Shadowing creates a brand-new variable that happens to reuse the name, so it can have a new type. Assigning to a `mut` variable must keep the same type.

? Which declaration is a correctly written constant?
- `const max_speed = 120;`
- `const MAX_SPEED = 120;`
- `let const MAX_SPEED: u32 = 120;`
+ `const MAX_SPEED: u32 = 120;`
= Constants need an explicit type and are conventionally named in `SCREAMING_SNAKE_CASE`.

? Why might you write `let _draft = 3;`?
- To make the variable mutable.
- To make it private.
+ To tell the compiler it is intentionally unused, silencing the warning.
- To make it a constant.
= A leading underscore marks a variable as intentionally unused, so the compiler does not warn about it.
```
