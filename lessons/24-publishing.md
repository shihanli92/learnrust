---
title: Publishing to crates.io
module: Building a package
summary: Prepare your crate's metadata, publish it to crates.io, and release new versions responsibly with semantic versioning.
minutes: 30
---

This is the moment the course has been building towards. Publishing a crate puts it on [crates.io](https://crates.io), Rust's public package registry, where anyone can add it to their project with `cargo add your-crate`. Its documentation appears on [docs.rs](https://docs.rs) automatically.

The mechanics take a few minutes. What deserves more thought is that publishing is **permanent**: a published version can never be changed or deleted. So this lesson covers the commands, and also the habits that let you publish with confidence.

## Choose a name

Crate names on crates.io are **first come, first served**, and a name belongs to its owner forever. Before you get attached to a name, check whether it is free:

```console
$ cargo search wordstat
```

Or search on crates.io itself. A few things to know:

- Names may contain letters, numbers, `-` and `_`. Hyphens and underscores count as the same character, so if `word-stat` exists you can't have `word_stat`. Names are also case-insensitive.
- Pick something descriptive and unlikely to be confused with a popular crate. For a learning project, adding your name (like `wordstat-ferris`) is a perfectly good choice.
- Claiming names you don't intend to use (squatting) is against the crates.io usage policy.

The name in `Cargo.toml` is the name you publish under. If you rename the package, the library's crate name changes too, so update any `use` lines that mention it (with `-` becoming `_`, as you saw in the modules lesson).

## Add the metadata

crates.io needs more information than `cargo new` gives you. Here is a complete `[package]` section:

```toml
[package]
name = "wordstat"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "Count lines, words and characters in text and find the most frequent words."
license = "MIT OR Apache-2.0"
repository = "https://github.com/your-name/wordstat"
readme = "README.md"
keywords = ["text", "words", "statistics", "word-count", "cli"]
categories = ["text-processing", "command-line-utilities"]
```

| Key | Required? | What it is |
| --- | --- | --- |
| `description` | yes | One or two sentences, shown in search results. |
| `license` | yes | An [SPDX](https://spdx.org/licenses/) license expression. |
| `repository` | recommended | Link to the source code, shown on the crate page. |
| `readme` | recommended | The file shown on the crate page. `README.md` is picked up by default if it exists. |
| `keywords` | recommended | Up to five search terms, each at most 20 characters. |
| `categories` | recommended | Up to five, chosen from the [official list](https://crates.io/category_slugs). |
| `rust-version` | recommended | The oldest Rust version your crate supports. Edition 2024 needs at least 1.85. |

**Licenses.** Without a license, nobody is legally allowed to use your code. Most of the Rust ecosystem, including Rust itself, uses the dual license `MIT OR Apache-2.0`, which lets users pick whichever suits them. Unless you have a reason to choose differently, follow that convention: set `license = "MIT OR Apache-2.0"` and add the two license texts as `LICENSE-MIT` and `LICENSE-APACHE` files in the package root. You can copy them from almost any popular Rust project and put your own name in the MIT copyright line.

## Create an account and a token

1. Go to [crates.io](https://crates.io) and log in with your GitHub account. At the time of writing, that is the only way to sign in.
2. In your account settings, add and **verify your email address**. crates.io won't accept a publish without one.
3. Under **API Tokens**, create a new token. Give it a name, the `publish-new` and `publish-update` scopes, and an expiry date. Copy it: it is shown only once.
4. Hand the token to Cargo:

```console
$ cargo login
please paste the token found on https://crates.io/me below
```

Paste the token and press Enter. Cargo stores it in `~/.cargo/credentials.toml`. Treat it like a password: anyone with it can publish versions of your crates. If it leaks, revoke it on crates.io right away.

## Check what will be uploaded

When you publish, Cargo packs your source files into a `.crate` archive and uploads it. First, look at exactly which files will go in:

```console
$ cargo package --list
.cargo_vcs_info.json
Cargo.lock
Cargo.toml
Cargo.toml.orig
LICENSE-APACHE
LICENSE-MIT
README.md
src/config.rs
src/error.rs
src/lib.rs
src/main.rs
src/stats.rs
tests/api.rs
```

Files ignored by Git (such as `target/`) are left out automatically. If something else shouldn't be uploaded, such as large test data or private notes, exclude it in `Cargo.toml` with `exclude = ["notes/", "*.log"]`, or list exactly what to include with `include = [...]`. Uploads are limited to 10 MB. Cargo adds a few files of its own: `Cargo.toml.orig` is your original manifest, `Cargo.toml` is a normalised copy of it, and `.cargo_vcs_info.json` records the Git commit the package was built from.

Then do a full rehearsal:

```console
$ cargo publish --dry-run
    Updating crates.io index
   Packaging wordstat v0.1.0 (/home/you/wordstat)
    Packaged 13 files, 26.4KiB (9.5KiB compressed)
   Verifying wordstat v0.1.0 (/home/you/wordstat)
   Compiling wordstat v0.1.0 (/home/you/wordstat/target/package/wordstat-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.91s
   Uploading wordstat v0.1.0 (/home/you/wordstat)
warning: aborting upload due to dry run
```

The *Verifying* step is important. Cargo unpacks the archive into a fresh folder and builds it from there. If your crate only compiles because of a file that isn't included, you find out now rather than after publishing. Missing metadata is also reported at this stage.

Cargo also refuses to package if you have uncommitted changes in Git, so what you publish matches a commit. Commit first. (`--allow-dirty` overrides this, but it is better not to need it.)

## Publish

```console
$ cargo publish
    Updating crates.io index
   Packaging wordstat v0.1.0 (/home/you/wordstat)
    Packaged 13 files, 26.4KiB (9.5KiB compressed)
   Verifying wordstat v0.1.0 (/home/you/wordstat)
   Compiling wordstat v0.1.0 (/home/you/wordstat/target/package/wordstat-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.91s
   Uploading wordstat v0.1.0 (/home/you/wordstat)
    Uploaded wordstat v0.1.0 to registry `crates-io`
note: waiting for `wordstat v0.1.0` to be available at registry `crates-io`.
You may press ctrl-c to skip waiting; the crate should be available shortly.
   Published wordstat v0.1.0 at registry `crates-io`
```

That's it. Your crate has a page at `https://crates.io/crates/wordstat`, and within a few minutes docs.rs builds the documentation from your doc comments and publishes it at `https://docs.rs/wordstat`. You don't have to do anything for that: every version of every crate gets its docs built. Anyone can now run `cargo add wordstat`, and because the package has a binary, `cargo install wordstat` too.

It is a good habit to tag the release in Git so you can always find the exact source of each version: `git tag v0.1.0` and `git push --tags`.

:::warning Published means permanent
You can't overwrite a version, and you can't delete one. If you publish `0.1.0` with a bug, the fix goes out as `0.1.1`. If you accidentally publish a password or API key, consider it public: revoke it immediately, then yank the version. Check `cargo package --list` before every release.
:::

## Semantic versioning in Rust

Your version number is a promise to your users, and Cargo relies on it. Remember from the Cargo lesson that a dependency written as `wordstat = "1.2.0"` accepts any `1.x.y` from `1.2.0` up. So when you release `1.3.0`, everyone who depends on you gets it with their next `cargo update`. If `1.3.0` breaks their code, you have broken their build without them changing anything.

The rules for `MAJOR.MINOR.PATCH`:

| Change | Bump | Example |
| --- | --- | --- |
| Bug fix, performance, docs, nothing public changes | PATCH | `1.2.0` to `1.2.1` |
| New functionality that doesn't break existing code | MINOR | `1.2.1` to `1.3.0` |
| Anything that could break existing users' code | MAJOR | `1.3.0` to `2.0.0` |

Before 1.0, everything shifts one place to the right. In `0.MINOR.PATCH`, a MINOR bump (`0.1.3` to `0.2.0`) is the breaking one, and a PATCH bump (`0.1.3` to `0.1.4`) is for everything compatible. Starting at `0.1.0` and staying in `0.x` while the design settles is completely normal. Releasing `1.0.0` signals "this API is stable".

What counts as breaking in Rust is sometimes surprising. Some examples:

- **Breaking:** removing or renaming a public item, changing a function's parameters or return type, making a public item private, adding a new required parameter.
- **Breaking:** adding a public field to a struct whose fields are all public, because code that builds it with a struct literal now misses a field.
- **Breaking:** adding a variant to a public enum, because users' exhaustive `match` expressions no longer cover every case.
- **Not breaking:** adding a new public function, type or module, or a new method on your own type.
- **Not breaking:** changing private code, however much you like.

The enum case catches many people out. Here, version 1.0 of a library had two variants, and version 1.1 added `Csv`. A user's code that was fine with 1.0 stops compiling:

```rust,compile_fail
pub enum Format {
    Json,
    Toml,
    Csv, // new in "1.1.0"
}

pub fn extension(format: Format) -> &'static str {
    match format {
        Format::Json => "json",
        Format::Toml => "toml",
    }
}
```

```text
error[E0004]: non-exhaustive patterns: `Format::Csv` not covered
  --> src/lib.rs:8:11
   |
 8 |     match format {
   |           ^^^^^^ pattern `Format::Csv` not covered
```

If you expect to add variants later, mark the enum `#[non_exhaustive]`. Code outside your crate is then forced to include a `_ =>` arm, and adding variants becomes a minor change. The same attribute on a struct prevents outside code from using struct literals, so you can add fields later. The Cargo book has a thorough [SemVer compatibility chapter](https://doc.rust-lang.org/cargo/reference/semver.html), and the `cargo-semver-checks` tool can compare your crate against its last published version and flag breaking changes automatically.

## Releasing a new version

1. Make your changes, with tests and docs.
2. Decide the bump using the table above, and update `version` in `Cargo.toml`.
3. Note what changed. Many crates keep a `CHANGELOG.md` for this.
4. Run the checks: `cargo test`, `cargo clippy`, `cargo fmt --check`, `cargo publish --dry-run`.
5. Commit, `cargo publish`, then tag the commit.

## Yanking a bad release

If you publish a version with a serious bug, you can **yank** it:

```console
$ cargo yank --version 0.1.1
$ cargo yank --version 0.1.1 --undo
```

A yanked version is *not* deleted. Projects whose `Cargo.lock` already uses it keep working. Yanking only stops Cargo from choosing that version for new lock files or during `cargo update`. That way you can steer people away from a broken release without breaking anyone who already depends on it. Always publish the fix as a new version as well.

## Keeping a crate private

You don't have to publish to share code between your own projects. Cargo can depend on a crate directly from a Git repository or from a folder on disk:

```toml
[dependencies]
wordstat = { git = "https://github.com/your-name/wordstat" }
helpers = { git = "https://github.com/your-name/helpers", tag = "v0.2.0" }
shapes = { path = "../shapes" }
```

A Git dependency uses the default branch unless you pick a `branch`, `tag` or `rev` (a commit hash). `Cargo.lock` records the exact commit, so builds stay reproducible. A path dependency is ideal while you develop two crates side by side.

To make sure a private package is never published by accident, add `publish = false` to its `[package]` section. Note the reverse limitation as well: a crate published on crates.io can only depend on other crates.io crates, so you can't publish something that depends on a Git-only or path-only crate.

## Pre-publish checklist

- The name is free on crates.io and it is the one you want forever.
- `description`, `license`, `repository`, `readme`, `keywords` and `categories` are filled in.
- `LICENSE-MIT` and `LICENSE-APACHE` (or your chosen license file) are in the package root.
- `README.md` explains what the crate does and shows an example.
- Every public item has docs; `#![warn(missing_docs)]` is quiet.
- `cargo test` passes, including doc tests.
- `cargo clippy` and `cargo fmt --check` are clean.
- `cargo doc --open` looks right: read the front page as a newcomer would.
- `cargo package --list` contains nothing unexpected, and no secrets.
- `cargo publish --dry-run` succeeds.
- Everything is committed, and the version number is the one you mean.

:::tip Automating releases
Once you publish regularly, you can let GitHub Actions do it. crates.io supports *trusted publishing*, where your repository's workflow gets short-lived credentials automatically, so you don't need to store a long-lived token anywhere. Look for it in your crate's settings on crates.io.
:::

:::exercise Pick the version
Your crate is at version `0.4.2`. For each change, what is the next version number?

1. You fix a bug where `count("")` returned 1 instead of 0.
2. You add a new public function `longest_word`.
3. You rename the public method `top` to `top_words`.
4. Your crate is later at `1.3.0`, and you add a variant to a public enum that isn't `#[non_exhaustive]`.
:::solution
1. `0.4.3`: a compatible bug fix is a PATCH bump.
2. `0.4.3` as well. Before 1.0, compatible additions also go in the PATCH position, because MINOR is reserved for breaking changes. (Some authors bump MINOR for big new features anyway; that is allowed, it just signals a break that isn't there.)
3. `0.5.0`: renaming a public item is breaking, and before 1.0 breaking changes bump the MINOR number.
4. `2.0.0`: adding an enum variant can break users' `match` expressions, so it is a MAJOR change after 1.0.
:::

:::exercise Get ready to publish
Take any library package you have written during the course (or create a tiny one with `cargo new --lib`). Fill in all the metadata from this lesson, add a README, pick a name that is free on crates.io, and run `cargo publish --dry-run` until it succeeds. Publishing for real is optional.
:::solution
A finished `[package]` section looks like this (with your own name and repository):

```toml
[package]
name = "temperature-ferris"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "Convert and parse temperatures in Celsius and Fahrenheit."
license = "MIT OR Apache-2.0"
repository = "https://github.com/ferris/temperature"
readme = "README.md"
keywords = ["temperature", "celsius", "fahrenheit", "units"]
categories = ["science"]
```

Common problems the dry run reports: a missing `description` or `license`, an invalid category (it must match the official list exactly), and uncommitted changes. If the Verifying step fails with a missing file, check `cargo package --list` and your `include`/`exclude` settings.
:::

```quiz
? You published version `0.3.0` and then notice a typo in a doc comment. What do you do?
- Overwrite `0.3.0` with `cargo publish --force`.
- Delete `0.3.0` on crates.io and publish it again.
+ Fix it and publish `0.3.1`.
- Nothing can be done after publishing.
= Published versions are immutable. Fixes, even tiny ones, go out as a new version.

? What does `cargo yank --version 1.0.4` do?
- Deletes version 1.0.4 and its source code from crates.io.
+ Stops Cargo from picking 1.0.4 for new lock files, while existing lock files keep working.
- Downloads version 1.0.4 into your project.
- Transfers ownership of the crate.
= Yanking is a soft removal: nobody who already depends on the version is broken, but new users won't get it.

? Your crate is at `1.2.0`. You add a new public field to a struct whose fields are all public. What kind of change is that?
- PATCH, because it only adds something.
- MINOR, because it is new functionality.
+ MAJOR, because users who build the struct with a struct literal will no longer compile.
= Adding a field breaks struct literals outside your crate. `#[non_exhaustive]` prevents outside struct literals, which makes such additions safe.

? You want to use your crate in another project without publishing it. Which dependency line works?
- `mycrate = "private"`
+ `mycrate = { git = "https://github.com/you/mycrate" }`
- `mycrate = { registry = "github" }`
- `mycrate = { local = true }`
= Cargo can depend on a Git repository or a local folder (`path = "../mycrate"`) directly. Neither requires publishing.
```
