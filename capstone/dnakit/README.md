# dnakit

Small, dependency-free tools for DNA, RNA and protein sequences: read FASTA
files, count bases, measure GC content, transcribe, reverse-complement and
translate. `dnakit` is both a Rust library and a command-line tool that
solves [Rosalind](https://rosalind.info) problems.

## Command-line tool

Install it with Cargo:

```console
$ cargo install dnakit
```

Then give it a Rosalind problem ID and a downloaded dataset file. The answer
is printed in the format Rosalind expects:

```console
$ dnakit revc rosalind_revc.txt
$ dnakit gc rosalind_gc.txt
```

Supported problems: `dna`, `rna`, `revc`, `gc`, `hamm` and `prot`.

## Library

Add it to your project with `cargo add dnakit`, then:

```rust
use dnakit::{fasta, gc_content, reverse_complement};

let records = fasta::parse(">demo\nATGGC\nCTGAA\n").unwrap();
let dna = &records[0].seq;
assert_eq!(gc_content(dna).unwrap(), 50.0);
assert_eq!(reverse_complement(dna).unwrap(), "TTCAGGCCAT");
```

Sequences must be uppercase. Functions return an error rather than panic
when they meet a character that is not a valid base.

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or
[MIT license](LICENSE-MIT) at your option.
