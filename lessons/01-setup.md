---
title: Hello, Cargo
module: Getting started
summary: Install the Rust toolchain, create your first project with Cargo and learn the edit–compile–run loop.
minutes: 20
---

Rust is a systems programming language that promises three things at once: programs that run as fast as C or C++, memory safety without a garbage collector, and a compiler that catches whole classes of bugs before your code ever runs. The price is a stricter compiler. Most of this course is about learning to work *with* that compiler instead of fighting it.

By the end of the course you will have built and published a small library crate (Rust's word for a package) that other people can depend on.

## Install the toolchain

Rust is installed with **rustup**, a small tool that manages compiler versions for you. On macOS or Linux, run this in a terminal:

```console
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On Windows, download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs). When it finishes, open a new terminal and check that everything is on your `PATH`:

```console
$ rustc --version
rustc 1.94.1 (e408947bf 2026-03-25)
$ cargo --version
cargo 1.94.1 (29ea6fb6a 2026-03-24)
```

Your version numbers will differ, and that is fine. Rust ships a new stable release every six weeks, and `rustup update` upgrades you.

You now have three tools:

| Tool | What it does |
| --- | --- |
| `rustc` | The compiler. You rarely call it directly. |
| `cargo` | The build tool and package manager. You will use it constantly. |
| `rustup` | Installs and updates `rustc` and `cargo`. |

:::tip No install? No problem.
Every complete program in this course has a **Run in Playground** button. It opens the official [Rust Playground](https://play.rust-lang.org) in a new tab with the code already loaded, so you can experiment from any browser.
:::

## Your first project

Cargo creates new projects with a sensible layout:

```console
$ cargo new hello
    Creating binary (application) `hello` package
$ cd hello
```

That gives you this:

```text
hello/
├── Cargo.toml     # the manifest: name, version, dependencies
└── src/
    └── main.rs    # your code
```

Open `src/main.rs`. Cargo has already written a program for you:

```rust
fn main() {
    println!("Hello, world!");
}
```

A few things to notice:

- `fn main()` declares the function where every Rust program starts.
- The body lives inside curly braces `{ }`.
- `println!` ends with `!` because it is a **macro**, not a function. Macros can do things functions can't, such as take a variable number of arguments. For now, just remember that a `!` means macro.
- Statements end with a semicolon `;`.

## Build and run

```console
$ cargo run
   Compiling hello v0.1.0 (/home/you/hello)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.52s
     Running `target/debug/hello`
Hello, world!
```

`cargo run` compiles your code and then runs it. There are a few siblings worth knowing now:

| Command | What it does |
| --- | --- |
| `cargo run` | Compile and run. |
| `cargo build` | Compile only. The binary lands in `target/debug/`. |
| `cargo check` | Type-check without producing a binary. Much faster, so use it while you work. |
| `cargo build --release` | Compile with optimisations, into `target/release/`. |

## Printing values

`println!` takes a *format string* with `{}` placeholders that are filled in from the remaining arguments. You can also name a variable directly inside the braces:

```rust
fn main() {
    let language = "Rust";
    let year = 2015;
    println!("{} 1.0 was released in {}.", language, year);
    println!("{language} is {} years old.", 2026 - year);
    println!("Debug formatting shows quotes: {:?}", language);
}
```

```text
Rust 1.0 was released in 2015.
Rust is 11 years old.
Debug formatting shows quotes: "Rust"
```

`{:?}` uses **Debug** formatting. It works on far more types than `{}`, which makes it the one to reach for when you want to inspect a value.

## Reading compiler errors

Rust's compiler is famous for its error messages. Here is a typo:

```rust,compile_fail
fn main() {
    printn!("Hello");
}
```

```text
error: cannot find macro `printn` in this scope
 --> src/main.rs:2:5
  |
2 |     printn!("Hello");
  |     ^^^^^^ help: a macro with a similar name exists: `println`
```

Read errors from the top. The first line says *what* went wrong, the `-->` line says *where*, and a `help:` line often tells you exactly how to fix it. Many errors also come with a code such as `E0382`. Running `rustc --explain E0382` prints a longer explanation with examples.

:::note Formatting and linting
Run `cargo fmt` to format your code the standard way, and `cargo clippy` for extra advice on writing idiomatic Rust. Both come with rustup.
:::

:::exercise Make it yours
Change the program so it prints two lines: a greeting with your name in it, and the result of multiplying 6 by 7. Use at least one named placeholder such as `{name}`.
:::solution
```rust
fn main() {
    let name = "Ferris";
    println!("Hello, {name}!");
    println!("6 × 7 = {}", 6 * 7);
}
```
:::

```quiz
? Which command type-checks your project fastest, without producing a binary?
- `cargo build`
+ `cargo check`
- `cargo run`
- `rustc --explain`
= `cargo check` skips code generation, so it is the fastest way to find out whether your code compiles.

? Why does `println!` end with an exclamation mark?
- It prints in bold.
- It is a function that can panic.
+ It is a macro.
= The `!` marks a macro call. Macros expand into other code at compile time, which lets `println!` take any number of arguments.

? In `println!("{:?}", x)`, what does `{:?}` do?
+ Formats `x` with its Debug representation.
- Prints `x` only if it is an `Option`.
- Asks the user for input.
= `{:?}` uses the `Debug` trait, which most types implement. `{}` uses `Display`, which is meant for user-facing output.
```
