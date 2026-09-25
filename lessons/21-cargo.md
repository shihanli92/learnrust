---
title: Cargo and Dependencies
module: Building a package
summary: Read and write Cargo.toml, add crates from crates.io, understand version requirements and Cargo.lock, and use features, profiles and workspaces.
minutes: 30
---

You have been using Cargo since the first lesson to build and run code. Cargo is also Rust's package manager: it downloads other people's crates, picks compatible versions, and builds everything in the right order. Using a well-tested crate for a solved problem (random numbers, JSON, command-line parsing) is normal and encouraged in Rust.

This lesson looks at Cargo from the point of view of someone about to write a crate: what goes in `Cargo.toml`, how dependencies and versions work, and which commands help you along the way.

## Anatomy of Cargo.toml

`Cargo.toml` is the package's **manifest**, written in TOML: `[section]` headers followed by `key = value` lines. A new library looks like this:

```console
$ cargo new --lib temperature
    Creating library `temperature` package
```

```toml
[package]
name = "temperature"
version = "0.1.0"
edition = "2024"

[dependencies]
```

| Key | Meaning |
| --- | --- |
| `name` | The package name. It is also the default crate name, with `-` replaced by `_`. |
| `version` | Your package's own version, in `MAJOR.MINOR.PATCH` form. |
| `edition` | Which *edition* of the language to use. Editions (2015, 2018, 2021, 2024) let Rust make small breaking changes without breaking old code: each crate opts in, and crates of different editions work together fine. Use the newest for new code. |
| `[dependencies]` | The crates your code uses, and which versions are acceptable. |

`cargo new --lib` creates `src/lib.rs` instead of `src/main.rs`. Without `--lib` you get a binary package. As you saw in the previous lesson, you can add the other file later to have both.

There are many more `[package]` keys, such as `description`, `license` and `repository`. They matter when you publish, so they are covered in the publishing lesson.

## Adding a dependency

The quickest way to add a dependency is `cargo add`, which finds the latest version on [crates.io](https://crates.io) and edits `Cargo.toml` for you:

```console
$ cargo new dice
$ cd dice
$ cargo add rand
    Updating crates.io index
      Adding rand v0.10.3 to dependencies
             Features:
             + alloc
             + std
             + std_rng
             + sys_rng
             + thread_rng
             - chacha
             - log
             - serde
             - simd_support
             - unbiased
```

Your version numbers will probably be newer. `Cargo.toml` now contains:

```toml
[dependencies]
rand = "0.10.3"
```

The crate is now available in your code under its name:

```rust,ignore,file=src/main.rs
fn main() {
    let roll: u8 = rand::random_range(1..=6);
    println!("You rolled a {roll}");
}
```

```console
$ cargo run
   Compiling libc v0.2.189
   Compiling rand_core v0.10.1
   Compiling cfg-if v1.0.5
   Compiling getrandom v0.4.3
   Compiling cpufeatures v0.3.1
   Compiling chacha20 v0.10.2
   Compiling rand v0.10.3
   Compiling dice v0.1.0 (/home/you/dice)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.45s
     Running `target/debug/dice`
You rolled a 5
```

The first build downloads and compiles `rand` and the crates *it* depends on. After that they are cached, so later builds only recompile your own code. You can remove a dependency with `cargo remove rand`.

:::tip Finding good crates
Search [crates.io](https://crates.io) for crates and check download counts, recent releases and the linked repository. Every crate published there gets its documentation built automatically on [docs.rs](https://docs.rs), for example `https://docs.rs/rand`. Read the docs before you add a dependency: a clear API and good examples are a sign of a well-maintained crate.
:::

## Version requirements

`rand = "0.10.3"` does *not* mean "exactly 0.10.3". It is a **version requirement** that says "any version compatible with 0.10.3". Compatibility follows [Semantic Versioning](https://semver.org) (semver): the first non-zero number in the version is the one that signals breaking changes.

| Requirement | Allows | Notes |
| --- | --- | --- |
| `"1.2.3"` or `"^1.2.3"` | `>=1.2.3, <2.0.0` | the default, called a caret requirement |
| `"0.10.3"` | `>=0.10.3, <0.11.0` | for `0.x`, the minor number is the breaking one |
| `"~1.2.3"` | `>=1.2.3, <1.3.0` | tilde: only patch updates |
| `"=1.2.3"` | exactly `1.2.3` | rarely a good idea in a library |
| `"*"` | any version | not allowed for crates published on crates.io |
| `">=1.2, <1.5"` | a custom range | comparison operators can be combined |

The default caret requirement is almost always what you want. It lets you pick up bug fixes automatically while protecting you from breaking changes. The next few lessons will look at semver from the other side, when you decide the version numbers of your own crate.

## Cargo.lock

When Cargo resolves your requirements, it writes the exact versions it picked into `Cargo.lock`:

```text
[[package]]
name = "rand"
version = "0.10.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "..."
```

You never edit this file by hand. Its job is to make builds **reproducible**: as long as the lock file doesn't change, everyone who builds the project (you next month, a teammate, a CI server) gets exactly the same dependency versions, even if newer compatible versions have been released in the meantime.

- For applications, always commit `Cargo.lock` to version control.
- For libraries, the current recommendation is to commit it too. It only affects your own builds and tests: when someone depends on your library, *their* `Cargo.lock` decides the versions, and yours is ignored.

To move to newer compatible versions deliberately, run `cargo update` (everything) or `cargo update rand` (one crate). It changes `Cargo.lock`, not `Cargo.toml`.

## Features

Many crates have optional parts called **features** that you switch on when you need them. This keeps compile times and binary sizes down for everyone who doesn't. In the `cargo add rand` output above, `+` marks the features enabled by default and `-` the optional ones.

```console
$ cargo add serde --features derive
    Updating crates.io index
      Adding serde v1.0.229 to dependencies
             Features:
             + derive
             + serde_derive
```

```toml
[dependencies]
serde = { version = "1.0.229", features = ["derive"] }
rand = { version = "0.10.3", default-features = false, features = ["alloc"] }
```

The second line shows how to switch off a crate's **default features** and pick only the ones you need, which is common in libraries that want to stay lightweight.

Your own crate can offer features too. A typical use is an **optional dependency** that users only pay for if they ask for it:

```toml
[dependencies]
serde = { version = "1", features = ["derive"], optional = true }

[features]
default = []
serde = ["dep:serde"]
```

Inside the crate, code that needs serde is marked `#[cfg(feature = "serde")]` so it only compiles when the feature is on. Users would enable it with `cargo add temperature --features serde`. You won't need features for your first crate, but you will see them in every larger crate's docs.

## Dev-dependencies

Some crates are only needed for tests, examples and benchmarks. Put them under `[dev-dependencies]` (or use `cargo add --dev`):

```toml
[dev-dependencies]
pretty_assertions = "1"
```

Dev-dependencies are not built when someone else depends on your crate, so they don't slow down or bloat your users' builds.

## Build profiles

A **profile** is a set of compiler settings. You have used both built-in ones already:

| Profile | Used by | Optimised | Debug checks |
| --- | --- | --- | --- |
| `dev` | `cargo build`, `cargo run`, `cargo test` | no, so it compiles quickly | yes, including integer overflow panics |
| `release` | `cargo build --release`, `cargo run --release` | yes, so it runs quickly | overflow checks off |

You can tweak them in `Cargo.toml`, though the defaults are good:

```toml
[profile.dev]
opt-level = 1   # a little optimisation, for code that is too slow in debug builds

[profile.release]
lto = true      # link-time optimisation: slower builds, sometimes faster programs
```

Always measure speed with a release build. Debug builds can be 10 to 100 times slower.

## Workspaces, briefly

When a project grows into several related packages (say a library, a command-line tool and a web server that share code), you can group them in a **workspace**. A root `Cargo.toml` lists the members:

```toml
[workspace]
members = ["core", "cli"]
resolver = "3"
```

All members share one `Cargo.lock` and one `target/` directory, so shared dependencies are built only once, and `cargo test` at the root tests everything. One package can depend on another in the workspace by path, for example `core = { path = "../core" }` in `cli/Cargo.toml`. For a single crate you don't need a workspace at all.

## Commands worth knowing

| Command | What it does |
| --- | --- |
| `cargo add name` / `cargo remove name` | Add or remove a dependency. |
| `cargo tree` | Show the full dependency tree, including dependencies of dependencies. |
| `cargo update` | Update `Cargo.lock` to the newest compatible versions. |
| `cargo doc --open` | Build docs for your crate *and all its dependencies* and open them in a browser. Works offline. |
| `cargo search name` | Search crates.io from the terminal. |
| `cargo install name` | Install a binary crate (a tool) from crates.io into `~/.cargo/bin`. |
| `cargo clean` | Delete `target/`, forcing a full rebuild. |

`cargo tree` is especially useful when you want to know why a crate you never added is in your build:

```console
$ cargo tree
dice v0.1.0 (/home/you/dice)
└── rand v0.10.3
    ├── chacha20 v0.10.2
    │   ├── cfg-if v1.0.5
    │   ├── cpufeatures v0.3.1
    │   └── rand_core v0.10.1
    ├── getrandom v0.4.3
    │   ├── cfg-if v1.0.5
    │   ├── libc v0.2.189
    │   └── rand_core v0.10.1
    └── rand_core v0.10.1
```

:::note Every dependency is code you trust
A dependency runs with the same permissions as your own code. Prefer popular, maintained crates, keep the list short, and don't add a crate for something you can write in ten lines.
:::

:::exercise Read the requirements
For each line of this `[dependencies]` section, write down which versions Cargo may choose.

```toml
[dependencies]
alpha = "2.4"
beta = "0.3.1"
gamma = "~1.7.2"
delta = "=0.9.0"
epsilon = "0.0.4"
```
:::solution
- `alpha = "2.4"`: `>=2.4.0, <3.0.0`.
- `beta = "0.3.1"`: `>=0.3.1, <0.4.0`, because for `0.x` versions the minor number is the breaking one.
- `gamma = "~1.7.2"`: `>=1.7.2, <1.8.0`.
- `delta = "=0.9.0"`: exactly `0.9.0`.
- `epsilon = "0.0.4"`: exactly `0.0.4` (`>=0.0.4, <0.0.5`). For `0.0.x`, every release counts as potentially breaking.
:::

:::exercise Roll some dice
Create a new binary package, add `rand` with `cargo add`, and write a program that rolls two six-sided dice five times and prints each pair and its total. Then run `cargo tree` and find `rand_core` in the output.
:::solution
```rust,ignore,file=src/main.rs
fn main() {
    for round in 1..=5 {
        let a: u8 = rand::random_range(1..=6);
        let b: u8 = rand::random_range(1..=6);
        println!("round {round}: {a} + {b} = {}", a + b);
    }
}
```

This needs the `rand` crate, so it can't run in the course's checker or the Playground as is. Run it with `cargo run` in your own project. Older versions of `rand` spell this differently (0.8 used `rand::thread_rng().gen_range(1..=6)` together with `use rand::Rng;`), so always check the docs for the version you actually have.
:::

```quiz
? Your `Cargo.toml` says `serde = "1.0.200"`. Which version could Cargo pick?
- Only `1.0.200`.
+ `1.0.229`
- `2.0.0`
- `0.9.9`
= The default caret requirement allows any version from `1.0.200` up to, but not including, `2.0.0`.

? What is `Cargo.lock` for?
- It lists the dependencies you want and their version ranges.
+ It records the exact versions that were resolved, so builds are reproducible.
- It stops other people from publishing a crate with the same name.
- It prevents `cargo` from downloading anything.
= `Cargo.toml` says what is acceptable. `Cargo.lock` records what was actually chosen. `cargo update` changes the lock file.

? Where should a crate you only use in tests go?
+ `[dev-dependencies]`
- `[dependencies]` with `optional = true`
- `[features]`
- `[profile.dev]`
= Dev-dependencies are available to tests, examples and benchmarks, and are not built for people who depend on your crate.

? A number-crunching program is slow with `cargo run` but fast with `cargo run --release`. Why?
- `--release` skips the borrow checker.
- `--release` runs the program on several cores.
+ The default `dev` profile doesn't optimise, to keep compile times short.
- The `dev` profile adds a delay for debugging.
= The `release` profile turns on optimisations. Compiling takes longer, but the program can be many times faster.
```
