# wordstat

Count lines, words and characters in text, and find the most frequent words.
`wordstat` is both a small Rust library and a command-line tool.

## Command-line tool

Install it with Cargo:

```console
$ cargo install wordstat
```

Then point it at a file, or pipe text into it:

```console
$ wordstat --top 3 notes.txt
$ cat notes.txt | wordstat
```

## Library

Add it to your project with `cargo add wordstat`, then:

```rust
use wordstat::Stats;

let stats = Stats::from_text("The cat sat on the mat.");
assert_eq!(stats.words, 6);
assert_eq!(stats.top_words(1), vec![("the", 2)]);
```

A word is a run of non-whitespace characters, compared without regard to
case and with punctuation at either end removed.

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or
[MIT license](LICENSE-MIT) at your option.
