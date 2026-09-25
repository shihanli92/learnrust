---
title: Hello, Cargo
module: Getting started
summary: Install the Rust toolchain, create your first project with Cargo and learn the edit–compile–run loop.
minutes: 25
---

Rust is a systems programming language that promises three things at once: programs that run as fast as C or C++, memory safety without a garbage collector (the background clean-up process many languages rely on), and a compiler that catches whole classes of bugs before your code ever runs. The price is a stricter compiler. Most of this course is about learning to work *with* that compiler instead of fighting it.

By the end of the course you will have built and published a small library crate (Rust's word for a package) that other people can depend on: `dnakit`, a toolkit for working with DNA, RNA and protein sequences. Along the way, most exercises are real bioinformatics problems from the Rosalind site, so every new Rust feature gets put to work on actual data.

## Install the toolchain

Rust is installed with **rustup**, a small tool that manages compiler versions for you. You type the commands in this course into a **terminal**, a window where you run programs by typing their names. On macOS or Linux, run this in a terminal (type everything after the `$`, then press Enter):

```console
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On Windows, download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs).

:::tip Step by step, per system
- **Opening a terminal.** macOS: open the **Terminal** app (search for it with Cmd+Space). Windows: open **Terminal** or **PowerShell** from the Start menu. Linux: open your desktop's **Terminal** app (often Ctrl+Alt+T).
- **Windows:** `rustup-init` offers to install the **Visual Studio C++ Build Tools**. Accept. Rust needs them to turn your code into a program.
- **macOS:** if your first build later fails with an error mentioning `linker` or `cc`, run `xcode-select --install`, let it finish, and build again.
- **During the install**, rustup asks how to proceed. Press Enter to accept the default installation.
- **Afterwards**, close the terminal and open a new one, so it picks up the newly installed tools.
:::

When it finishes, open a new terminal and check that everything is on your `PATH` (the list of places the terminal looks for programs):

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

Cargo creates the `hello` folder inside whatever folder your terminal was in when you ran the command (usually your home folder), and `cd hello` moves the terminal into it.

Open `src/main.rs` in a code editor. A good free choice is [Visual Studio Code](https://code.visualstudio.com) with the **rust-analyzer** extension (install it from the Extensions panel): it colours your code, shows errors as you type and explains what things are when you hover over them. Use **File > Open Folder** and pick the `hello` folder. Cargo has already written a program for you:

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

Only a plain variable name works inside the braces. Something like `{language.len()}` or `{2026 - year}` is a compile error; for anything more than a name, write an empty `{}` and put the expression after the comma, as the second line does.

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

The errors shown in this course are trimmed to the important part. The real ones on your screen are often much longer. Don't let that put you off: read the first line that starts with `error`, then look for a `help:` line. `note:` lines that point into files inside Rust itself (paths you didn't write) can usually be ignored at first.

:::note Formatting and linting
Run `cargo fmt` to format your code the standard way, and `cargo clippy` for extra advice on writing idiomatic Rust. Both come with rustup.
:::

## Practising with Rosalind

[Rosalind](https://rosalind.info) is a free website of bioinformatics puzzles: small programming problems about DNA, RNA and proteins. From the next lesson on, most exercises in this course are Rosalind problems. Each one practises the Rust you have just learned, and you can check your answer against Rosalind's own judge.

To take part, create a free account on the site (an email address is all it takes). The problems we use come from its **Bioinformatics Stronghold** section. Each Rosalind exercise in this course links to its problem page.

Solving a problem works like this:

1. Read the problem page and write a program that solves it. The course gives you a small sample to test with.
2. Click **Download dataset**. You get a text file of input made just for you, and a **5-minute timer** starts.
3. Run your program on that input and submit its output on the problem page before the timer runs out.
4. If the answer is wrong or time runs out, nothing is lost: download a fresh dataset and try again.

Five minutes is plenty if your program already works, so get it right on the sample first, then download. In the early lessons you will paste the dataset straight into your program as text. Once you have learned to read files, your programs will open the downloaded file directly.

### Biology in one minute

You don't need to be a biologist; each exercise explains the little biology it needs. Here is the core. **DNA** is a long chain built from four kinds of building block called nucleotides, written as the letters `A`, `C`, `G` and `T`, so a piece of DNA is simply a string such as `"GATTACA"`. DNA is double-stranded, and the two strands pair up letter by letter: `A` always sits opposite `T`, and `C` opposite `G`. **RNA** is a working copy of DNA that uses the same alphabet, except that `U` takes the place of `T`. A cell reads RNA three letters at a time; each three-letter **codon** stands for one amino acid, or for "stop". A **protein** is a chain of amino acids, and biologists write it as a string too, one letter per amino acid, such as `"MKWVTFISLL"`.

That is enough to start: to a programmer, most of bioinformatics is careful work with strings.

:::exercise Make it yours
Change the program so it prints two lines: a greeting with your name in it, and the length of a short DNA string such as `"GATTACA"`. Use at least one named placeholder such as `{name}`. To get the length, call `.len()` on the string, as in `dna.len()`.
:::solution
```rust
fn main() {
    let name = "Ferris";
    let dna = "GATTACA";
    println!("Hello, {name}!");
    println!("The DNA string {dna} is {} letters long.", dna.len());
}
```

```text
Hello, Ferris!
The DNA string GATTACA is 7 letters long.
```

`.len()` is a **method**: a function that belongs to a value and is called with a dot. You will meet many more of them.
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
- Prints `x` only if it is not empty.
- Asks the user for input.
= `{:?}` uses Debug formatting, a programmer-facing view that works for most values (strings show their quotes, for example). `{}` is meant for polished, user-facing output.
```
