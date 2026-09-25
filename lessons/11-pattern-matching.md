---
title: Pattern Matching
module: Modelling data
summary: Use match, if let, let else and while let to take values apart and branch on their shape.
minutes: 35
---

In the last lesson you used `match` to find out which variant an enum was and pull out its data. That was a small taste. **Patterns** are a little language of their own for describing the *shape* of a value: "a tuple whose first element is zero", "a `Some` holding a number between 1 and 9", "a `Point` on the x axis". Rust uses them in `match`, in `if let`, in `let` itself and in function parameters.

Once patterns click, a lot of code that would be a tangle of `if` statements in other languages becomes a short, flat list of cases that the compiler checks for you.

## match, exhaustiveness and the wildcard

A `match` tries its arms from top to bottom and runs the first one whose pattern fits. It must be **exhaustive**: every possible value has to be covered by some arm. For an enum that means every variant. For a type like `i32`, with billions of values, you need a catch-all:

```rust
fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1 => "one",
        2 => "two",
        _ => "many",
    }
}

fn main() {
    for n in [0, 2, 7] {
        println!("{n}: {}", describe(n));
    }
}
```

```text
0: zero
2: two
7: many
```

`_` is the **wildcard** pattern. It matches anything and binds nothing. Because arms are tried in order, a wildcard must come last; any arm after it could never run, and the compiler warns you about that.

If you want to match anything *and* use the value, write a variable name instead of `_`. The name is a pattern that always matches and binds the value:

```rust
fn main() {
    let n = 42;
    match n {
        0 => println!("nothing"),
        other => println!("got {other}"),
    }
}
```

```text
got 42
```

## Several values, ranges and guards

Use `|` to mean "this pattern *or* that one", and `..=` for an inclusive range of numbers or characters:

```rust
fn classify(c: char) -> &'static str {
    match c {
        'a' | 'e' | 'i' | 'o' | 'u' => "vowel",
        'a'..='z' => "consonant",
        '0'..='9' => "digit",
        ' ' | '\t' | '\n' => "whitespace",
        _ => "other",
    }
}

fn main() {
    for c in ['e', 'x', '7', ' ', '!'] {
        println!("{c:?}: {}", classify(c));
    }
}
```

```text
'e': vowel
'x': consonant
'7': digit
' ': whitespace
'!': other
```

The order matters here: vowels are also in `'a'..='z'`, but the vowel arm comes first and wins.

Sometimes a pattern alone can't express the condition you need. A **match guard** adds an extra `if` after the pattern. The arm only runs if both the pattern fits and the guard is true:

```rust
fn sign(n: i32) -> &'static str {
    match n {
        0 => "zero",
        x if x < 0 => "negative",
        _ => "positive",
    }
}

fn main() {
    println!("{} {} {}", sign(-5), sign(0), sign(12));
}
```

```text
negative zero positive
```

:::note Guards and exhaustiveness
The compiler does not look inside guards when checking exhaustiveness, because a guard can be any expression. That is why the example still needs the final `_` arm, even though "zero, negative, otherwise positive" obviously covers everything.
:::

## Destructuring

Patterns can take compound values apart. This is called **destructuring**, and it works on tuples, structs, enums and any combination of them.

### Tuples

```rust
fn main() {
    let point = (0, 7);
    match point {
        (0, 0) => println!("at the origin"),
        (0, y) => println!("on the y axis at {y}"),
        (x, 0) => println!("on the x axis at {x}"),
        (x, y) => println!("at ({x}, {y})"),
    }
}
```

```text
on the y axis at 7
```

Each arm mixes literal values (which must be equal) with names (which match anything and capture it).

### Structs

For structs you name the fields. `Point { x, y }` is shorthand for `Point { x: x, y: y }`, and `..` skips the fields you don't care about:

```rust
struct Point {
    x: i32,
    y: i32,
    z: i32,
}

fn main() {
    let p = Point { x: 3, y: 0, z: -2 };

    match p {
        Point { y: 0, x, .. } => println!("y is zero, x is {x}"),
        Point { x, y, z } => println!("({x}, {y}, {z})"),
    }

    // Patterns also work in plain `let` statements.
    let Point { x, z: depth, .. } = p;
    println!("x = {x}, depth = {depth}");
}
```

```text
y is zero, x is 3
x = 3, depth = -2
```

`z: depth` binds the `z` field to a variable with a different name. The last two lines show that `let` itself takes a pattern. You have been using that all along with `let (a, b) = (1, 2);`.

### Nested enums and structs

Patterns nest as deeply as your data does:

```rust
enum Color {
    Rgb(u8, u8, u8),
    Named(String),
}

enum Shape {
    Dot { color: Color },
    Line { length: u32, color: Color },
}

fn describe(shape: &Shape) -> String {
    match shape {
        Shape::Dot { color: Color::Rgb(0, 0, 0) } => String::from("a black dot"),
        Shape::Dot { color: Color::Named(name) } => format!("a {name} dot"),
        Shape::Dot { .. } => String::from("a coloured dot"),
        Shape::Line { length: 0, .. } => String::from("an empty line"),
        Shape::Line { length, color: Color::Rgb(r, g, b) } => {
            format!("a line of length {length} in rgb({r}, {g}, {b})")
        }
        Shape::Line { length, color: Color::Named(name) } => {
            format!("a {name} line of length {length}")
        }
    }
}

fn main() {
    let shapes = [
        Shape::Dot { color: Color::Rgb(0, 0, 0) },
        Shape::Dot { color: Color::Named(String::from("red")) },
        Shape::Line { length: 0, color: Color::Rgb(1, 2, 3) },
        Shape::Line { length: 5, color: Color::Rgb(9, 9, 9) },
        Shape::Line { length: 8, color: Color::Named(String::from("blue")) },
    ];
    for s in &shapes {
        println!("{}", describe(s));
    }
}
```

```text
a black dot
a red dot
an empty line
a line of length 5 in rgb(9, 9, 9)
a blue line of length 8
```

Since `describe` receives `&Shape`, Rust matches *through* the reference and the names it binds (`name`, `length`, `r`...) are references too. This convenience is called **match ergonomics**. It means you rarely need to write `&` or `ref` in patterns yourself.

## Binding with @

Occasionally you want to test a value against a pattern *and* keep the whole value. The `@` operator does both: `name @ pattern`.

```rust
fn main() {
    for age in [4, 15, 30] {
        match age {
            child @ 0..=12 => println!("{child} is a child"),
            teen @ 13..=19 => println!("{teen} is a teenager"),
            adult => println!("{adult} is an adult"),
        }
    }
}
```

```text
4 is a child
15 is a teenager
30 is an adult
```

## if let: when you care about one case

A `match` with one interesting arm and a `_ => {}` arm is common enough that Rust has a shortcut. `if let` runs its block only if the pattern matches:

```rust
fn main() {
    let config_max: Option<u8> = Some(3);

    // The long way
    match config_max {
        Some(max) => println!("max is {max}"),
        _ => {}
    }

    // The same thing with if let
    if let Some(max) = config_max {
        println!("max is {max}");
    }

    let nothing: Option<u8> = None;
    if let Some(n) = nothing {
        println!("got {n}");
    } else {
        println!("got nothing");
    }
}
```

```text
max is 3
max is 3
got nothing
```

Read `if let PATTERN = VALUE` as "if `VALUE` fits `PATTERN`, then...". The trade-off is that you lose exhaustiveness checking, so use `match` when you really do need to handle every case.

## let else: match or leave

`let else` is the mirror image. It binds variables from a pattern for the *rest* of the function, and if the pattern doesn't match, the `else` block runs and must leave: `return`, `break`, `continue` or panic. This keeps the "happy path" unindented:

```rust
fn parse_pair(input: &str) -> Option<(i32, i32)> {
    let Some((left, right)) = input.split_once(',') else {
        return None;
    };
    let Ok(a) = left.trim().parse::<i32>() else {
        return None;
    };
    let Ok(b) = right.trim().parse::<i32>() else {
        return None;
    };
    Some((a, b))
}

fn main() {
    println!("{:?}", parse_pair("3, 4"));
    println!("{:?}", parse_pair("3 4"));
    println!("{:?}", parse_pair("x, 4"));
}
```

```text
Some((3, 4))
None
None
```

`split_once` returns an `Option` containing the text on either side of the separator. `parse` returns a `Result`, another enum with variants `Ok` and `Err`, which you will study in the Error Handling lesson.

## while let: loop while a pattern fits

`while let` keeps looping as long as the pattern matches. The classic use is draining a stack, where `pop` returns `Some(item)` until the stack is empty and then `None`:

```rust
fn main() {
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("popped {top}");
    }
    println!("stack is empty: {}", stack.is_empty());
}
```

```text
popped 3
popped 2
popped 1
stack is empty: true
```

`vec!` creates a `Vec`, a growable list. The next lesson covers it properly.

## matches!: a pattern as a boolean

Sometimes you just want `true` or `false`: "is this value shaped like that?". The `matches!` macro takes a value and a pattern (optionally with a guard) and returns a `bool`:

```rust
#[derive(Debug)]
enum Token {
    Number(i64),
    Plus,
    Minus,
    Word(String),
}

fn main() {
    let tokens = [Token::Number(4), Token::Plus, Token::Word(String::from("x")), Token::Minus];

    for t in &tokens {
        let is_operator = matches!(t, Token::Plus | Token::Minus);
        let is_small_number = matches!(t, Token::Number(n) if *n < 10);
        println!("{t:?}: operator={is_operator}, small number={is_small_number}");
    }
}
```

```text
Number(4): operator=false, small number=true
Plus: operator=true, small number=false
Word("x"): operator=false, small number=false
Minus: operator=true, small number=false
```

In the guard `*n < 10`, `n` is a reference (because `t` is), so `*n` reads the number it points to.

## Which tool to use

| You want to... | Use |
| --- | --- |
| Handle every possible case | `match` |
| Do something only in one case | `if let` |
| Get values out or bail early | `let else` |
| Loop until a pattern stops matching | `while let` |
| Get a `bool` from a pattern | `matches!` |

:::rosalind PROT Translating RNA into Protein
Cells build proteins from instructions in messenger RNA (the U-for-T copy of DNA from the RNA problem). A molecular machine reads the RNA three bases at a time. Each triple, called a **codon**, stands for one of 20 amino acids, written as single letters, and the protein is the chain of those amino acids. Three of the 64 codons, `UAA`, `UAG` and `UGA`, are **stop codons**: they mean "the protein ends here".

Given an RNA string, print the protein it encodes as one line of letters. Translate codon by codon from the start and stop at the first stop codon (don't print anything for the stop itself).

This is the standard codon table:

| Letter | Codons | Letter | Codons |
| --- | --- | --- | --- |
| A | GCU GCC GCA GCG | M | AUG |
| C | UGU UGC | N | AAU AAC |
| D | GAU GAC | P | CCU CCC CCA CCG |
| E | GAA GAG | Q | CAA CAG |
| F | UUU UUC | R | CGU CGC CGA CGG AGA AGG |
| G | GGU GGC GGA GGG | S | UCU UCC UCA UCG AGU AGC |
| H | CAU CAC | T | ACU ACC ACA ACG |
| I | AUU AUC AUA | V | GUU GUC GUA GUG |
| K | AAA AAG | W | UGG |
| L | UUA UUG CUU CUC CUA CUG | Y | UAU UAC |

Write `fn amino_acid(codon: &[u8]) -> Option<char>` as one big `match`, returning `None` for stop codons. A byte string literal such as `b"UUU"` works as a pattern against a byte slice, and `|` lets one arm list several codons:

```rust,ignore
match codon {
    b"UUU" | b"UUC" => Some('F'),
    b"UUA" | b"UUG" | b"CUU" | b"CUC" | b"CUA" | b"CUG" => Some('L'),
    // ...
}
```

Then write `fn translate(rna: &str) -> String`. `rna.as_bytes().chunks_exact(3)` hands you the codons one at a time as `&[u8]` slices of length 3 (and ignores any leftover bytes at the end). Paste the dataset into a string constant and `.trim()` it, as in earlier lessons. For the sample `AUGGCAUCGACUGAACGGCCAAUCGAGUGCGAAUAAGGCUUA` the output is:

```text
MASTERPIECE
```
:::solution
```rust
fn amino_acid(codon: &[u8]) -> Option<char> {
    match codon {
        b"UUU" | b"UUC" => Some('F'),
        b"UUA" | b"UUG" | b"CUU" | b"CUC" | b"CUA" | b"CUG" => Some('L'),
        b"AUU" | b"AUC" | b"AUA" => Some('I'),
        b"AUG" => Some('M'),
        b"GUU" | b"GUC" | b"GUA" | b"GUG" => Some('V'),
        b"UCU" | b"UCC" | b"UCA" | b"UCG" | b"AGU" | b"AGC" => Some('S'),
        b"CCU" | b"CCC" | b"CCA" | b"CCG" => Some('P'),
        b"ACU" | b"ACC" | b"ACA" | b"ACG" => Some('T'),
        b"GCU" | b"GCC" | b"GCA" | b"GCG" => Some('A'),
        b"UAU" | b"UAC" => Some('Y'),
        b"CAU" | b"CAC" => Some('H'),
        b"CAA" | b"CAG" => Some('Q'),
        b"AAU" | b"AAC" => Some('N'),
        b"AAA" | b"AAG" => Some('K'),
        b"GAU" | b"GAC" => Some('D'),
        b"GAA" | b"GAG" => Some('E'),
        b"UGU" | b"UGC" => Some('C'),
        b"UGG" => Some('W'),
        b"CGU" | b"CGC" | b"CGA" | b"CGG" | b"AGA" | b"AGG" => Some('R'),
        b"GGU" | b"GGC" | b"GGA" | b"GGG" => Some('G'),
        b"UAA" | b"UAG" | b"UGA" => None, // stop codons
        _ => None,                        // not a valid codon at all
    }
}

fn translate(rna: &str) -> String {
    let mut protein = String::new();
    for codon in rna.as_bytes().chunks_exact(3) {
        let Some(aa) = amino_acid(codon) else {
            break; // a stop codon ends the protein
        };
        protein.push(aa);
    }
    protein
}

const RNA: &str = "
AUGGCAUCGACUGAACGGCCAAUCGAGUGCGAAUAAGGCUUA
";

fn main() {
    println!("{}", translate(RNA.trim()));
}
```

```text
MASTERPIECE
```

The `match` is exhaustive only thanks to the final `_` arm: a `&[u8]` could be any bytes at all, and the compiler cannot know your data only contains A, C, G and U. The stop codons get their own arm anyway, so a reader can see that they were handled on purpose. `let else` keeps the loop flat: either you get an amino acid, or the loop ends. The `GGCUUA` after the stop codon in the sample is never translated.
:::

:::exercise Sorting sequencing reads
A DNA sequencer produces millions of short fragments called **reads**. Alignment software then tries to place each read at a position on a chromosome and gives it a quality score. Given this enum, write `fn describe(read: &Read) -> String` using a single `match` that returns:

1. `"low quality (Q), skipped"` for any mapped read with a quality from 0 to 19. Use `@` to bind the quality.
2. `"chrX at POSITION"` for a mapped read on chromosome 23 (the X chromosome).
3. `"chrN at POSITION"` for any other mapped read.
4. `"too short to place"` for an unmapped read with fewer than 20 bases (use a guard), and `"unmapped, N bases"` for any other unmapped read.

```rust,ignore
enum Read {
    Mapped { chromosome: u8, position: u64, quality: u8 },
    Unmapped { sequence: String },
}
```
:::solution
```rust
enum Read {
    Mapped { chromosome: u8, position: u64, quality: u8 },
    Unmapped { sequence: String },
}

fn describe(read: &Read) -> String {
    match read {
        Read::Mapped { quality: q @ 0..=19, .. } => format!("low quality ({q}), skipped"),
        Read::Mapped { chromosome: 23, position, .. } => format!("chrX at {position}"),
        Read::Mapped { chromosome, position, .. } => format!("chr{chromosome} at {position}"),
        Read::Unmapped { sequence } if sequence.len() < 20 => String::from("too short to place"),
        Read::Unmapped { sequence } => format!("unmapped, {} bases", sequence.len()),
    }
}

fn main() {
    let reads = [
        Read::Mapped { chromosome: 7, position: 117_559_590, quality: 60 },
        Read::Mapped { chromosome: 23, position: 1_000_000, quality: 42 },
        Read::Mapped { chromosome: 1, position: 5_000, quality: 12 },
        Read::Unmapped { sequence: String::from("GATTACA") },
        Read::Unmapped { sequence: String::from("ACGTACGTACGTACGTACGTACGT") },
    ];
    for r in &reads {
        println!("{}", describe(r));
    }
}
```

```text
chr7 at 117559590
chrX at 1000000
low quality (12), skipped
too short to place
unmapped, 24 bases
```

The order of the arms matters: the low-quality arm must come first, otherwise the read on chromosome 1 would be described by the general "chrN" arm. Underscores in `117_559_590` are just digit separators for readability.
:::

```quiz
? Why does this `match` on an `i32` need a final `_` arm even though it has arms for `x if x < 0`, `0` and `x if x > 0`?
- Because `i32` values can be `null`.
+ Because the compiler ignores guards when checking exhaustiveness.
- It doesn't; the code compiles without it.
- Because `_` must always be the last arm of every `match`.
= Guards can contain any expression, so the compiler cannot reason about them. Without a guard-free catch-all it reports non-exhaustive patterns.

? What does `n @ 1..=9` do in a pattern?
- It matches the numbers 1 to 8.
+ It matches the numbers 1 to 9 and binds the matched value to `n`.
- It assigns 1 to 9 to `n`.
= `@` binds a name to a value while also testing it against a pattern. `..=` is inclusive, so 9 is included.

? What must the `else` block of a `let else` statement do?
- Return a default value for the variable.
- Nothing; it is optional.
+ Diverge: `return`, `break`, `continue` or panic.
- Print an error message.
= The variables bound by `let else` are used after the statement, so if the pattern fails, execution must not continue past it.

? Which expression is `true` when `t` is `Token::Plus`?
- `matches!(t, Token::Minus)`
- `matches!(t, Token::Number(_))`
+ `matches!(t, Token::Plus | Token::Minus)`
= `matches!` returns a `bool` telling you whether the value fits the pattern. Inside a pattern, `|` means "or", so `Token::Plus | Token::Minus` matches either variant.
```
