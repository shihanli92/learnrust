---
title: Lifetimes
module: Abstraction
summary: Understand what lifetime annotations like 'a mean, when the compiler needs them, and why you rarely have to write them.
minutes: 35
---

Lifetimes have a reputation as the hardest part of Rust. The syntax looks strange (`&'a str`) and the error messages can be confusing at first. The good news is that the idea behind them is small, and you have been relying on it since the Borrowing lesson without writing a single annotation.

Every reference in Rust is valid for some stretch of the program: its **lifetime**. The borrow checker makes sure no reference is used after the value it points to is gone. Almost always, it works out the lifetimes by itself. Lifetime *annotations* are for the few cases where it can't, and they don't change how long anything lives. They just describe to the compiler how the lifetimes of different references relate.

## Why lifetimes exist: dangling references

Here is the bug the borrow checker is there to prevent:

```rust,compile_fail
fn main() {
    let r;
    {
        let x = 5;
        r = &x;
    }
    println!("r: {r}");
}
```

```text
error[E0597]: `x` does not live long enough
 --> src/main.rs:5:13
  |
4 |         let x = 5;
  |             - binding `x` declared here
5 |         r = &x;
  |             ^^ borrowed value does not live long enough
6 |     }
  |     - `x` dropped here while still borrowed
7 |     println!("r: {r}");
  |                   - borrow later used here
```

`x` is dropped at the end of the inner block, but `r` still points at it and is used afterwards. In C this would compile and read garbage memory. Rust compares the two lifetimes: the reference `r` is used for longer than the value `x` exists, so it rejects the program.

Inside one function, the compiler can see everything and figure this out alone. The trouble starts at function boundaries.

## A function that needs help

Here's a function that returns the longer of two string slices:

```rust,compile_fail
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    println!("{}", longest("apple", "fig"));
}
```

```text
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:33
  |
1 | fn longest(x: &str, y: &str) -> &str {
  |               ----     ----     ^ expected named lifetime parameter
  |
  = help: this function's return type contains a borrowed value, but the signature does not say whether it is borrowed from `x` or `y`
help: consider introducing a named lifetime parameter
  |
1 | fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
  |           ++++     ++          ++          ++
```

The help line nails the problem. The function returns a reference, and a reference must point into *something*. It could be borrowed from `x` or from `y`, depending on which is longer at run time. The caller needs to know how long the result stays valid, and it can't know unless the signature says.

Why not just look at the body? Because Rust checks each call using only the function's **signature**. That's a deliberate design choice: the signature is a contract, so changing a function's body can never break code that calls it, and the compiler never has to analyse your whole program at once.

## Lifetime annotations

The fix is a **lifetime parameter**. Lifetime names start with an apostrophe and are usually short: `'a`, `'b`. You declare them in angle brackets, just like generic type parameters, then attach them to references:

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let a = String::from("a long string");
    let result;
    {
        let b = String::from("short");
        result = longest(a.as_str(), b.as_str());
        println!("longest: {result}");
    }
}
```

```text
longest: a long string
```

Read the signature as: "for some lifetime `'a`, both inputs live at least as long as `'a`, and the output is valid for `'a` too". In practice, the compiler picks `'a` to be the **shorter** of the two input lifetimes. The result is guaranteed valid only while *both* inputs are.

### What 'a really means

This is the part that trips people up, so it's worth being precise:

- `'a` is **not** a duration you choose, and writing it doesn't make anything live longer. Values live until their owner goes out of scope, exactly as before.
- `'a` is a **constraint**, a name for "some region of the program" that ties references together. The compiler finds a region that satisfies all the constraints, or reports an error if none exists.
- Annotations describe relationships: "the output borrows from these inputs". They are like generic type parameters, but for "how long" instead of "what type".

Here's the constraint in action. Using the result after `b` is gone is rejected, even though at run time the result would happen to be `a`:

```rust,compile_fail
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let a = String::from("a long string");
    let result;
    {
        let b = String::from("short");
        result = longest(a.as_str(), b.as_str());
    }
    println!("longest: {result}");
}
```

```text
error[E0597]: `b` does not live long enough
  --> src/main.rs:10:38
   |
 9 |         let b = String::from("short");
   |             - binding `b` declared here
10 |         result = longest(a.as_str(), b.as_str());
   |                                      ^ borrowed value does not live long enough
11 |     }
   |     - `b` dropped here while still borrowed
12 |     println!("longest: {result}");
   |                         ------ borrow later used here
```

The compiler doesn't reason about which string is longer. The signature says the result might borrow from `b`, so it must not outlive `b`. That caution is the point: the check never depends on run-time values.

### Only annotate what's related

Lifetimes describe the relationships that really exist. If the output only ever comes from the first argument, say so, and the second argument is free to live as briefly as it likes:

```rust
fn first_word<'a>(text: &'a str, _separator: &str) -> &'a str {
    text.split_whitespace().next().unwrap_or("")
}

fn main() {
    let text = String::from("hello brave world");
    let word;
    {
        let sep = String::from(" ");
        word = first_word(&text, &sep);
    }
    println!("{word}"); // fine: word only borrows from text
}
```

```text
hello
```

And you can't return a reference to something created inside the function, whatever annotations you add, because that value is dropped when the function returns. Return an owned value such as a `String` instead.

## Structs that hold references

So far every struct owned its data. A struct can also hold references, but then it needs a lifetime parameter, which says "an instance of this struct can't outlive the data it borrows":

```rust
#[derive(Debug)]
struct Excerpt<'a> {
    part: &'a str,
}

impl<'a> Excerpt<'a> {
    fn new(text: &'a str) -> Self {
        let end = text.find('.').map(|i| i + 1).unwrap_or(text.len());
        Excerpt { part: &text[..end] }
    }

    fn word_count(&self) -> usize {
        self.part.split_whitespace().count()
    }
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first = Excerpt::new(&novel);
    println!("{first:?}, {} words", first.word_count());
}
```

```text
Excerpt { part: "Call me Ishmael." }, 3 words
```

The syntax mirrors generic structs: declare `'a` after the struct name, use it in the field, and declare it on the `impl` too. The compiler then ensures `first` isn't used after `novel` is dropped.

:::tip Prefer owning structs at first
A struct holding `&str` can be faster, because it avoids copying, but every user of the struct inherits the lifetime. When you're starting out, give structs owned fields (`String`, `Vec<T>`) and clone when needed. Reach for borrowing structs when they are short-lived views into data, like a parser working over an input string.
:::

## Lifetime elision: why you rarely write them

You've written plenty of functions that take and return references, like `fn first_word(s: &str) -> &str`, without any `'a`. That works because of **lifetime elision**: three rules the compiler applies to fill in the obvious lifetimes itself. In plain language:

1. Each reference parameter gets its own lifetime.
2. If there is exactly one reference parameter, any references in the output borrow from it.
3. If one of the parameters is `&self` or `&mut self` (a method), references in the output borrow from `self`.

If after these rules any output lifetime is still unknown, you get error E0106 and must annotate. That's why `longest` needed help: two reference parameters, no `self`, so rule 2 and rule 3 don't apply.

| Signature as written | What the compiler reads | Annotation needed? |
| --- | --- | --- |
| `fn trim(s: &str) -> &str` | `fn trim<'a>(s: &'a str) -> &'a str` | No (rule 2) |
| `fn name(&self) -> &str` | output borrows from `self` | No (rule 3) |
| `fn pick(a: &str, b: &str) -> &str` | ambiguous | Yes |
| `fn len(a: &str, b: &str) -> usize` | no references returned | No |

## The 'static lifetime

One lifetime has a special name: `'static`. It means "can live for the entire run of the program". String literals are the classic example. Their text is stored in the program binary itself, so a `&'static str` is always valid:

```rust
fn greeting(hour: u32) -> &'static str {
    if hour < 12 { "good morning" } else { "good afternoon" }
}

fn main() {
    let s: &'static str = "I live forever";
    println!("{s}, {}", greeting(9));
}
```

```text
I live forever, good morning
```

That's why earlier lessons could return `&'static str` from functions with no parameters: the literals don't borrow from anything.

:::warning Don't use 'static to silence errors
When the compiler complains about lifetimes, it sometimes suggests `'static`. That's rarely the fix you want. It demands data that lives forever, which borrowed local data can't satisfy. Usually the real fix is to return an owned `String`, or to restructure so the data outlives its references.
:::

You'll also see `'static` as a *bound*, as in `T: 'static` or `dyn Error + 'static`. There it means "this type contains no short-lived references", which is true of all owned types like `String` and `i32`. You met this in the `source()` signature in the Custom Error Types lesson.

## Keep calm

To sum up, most of the time you'll write no lifetime annotations at all. When you do, it'll usually be one of two situations: a function returning a reference borrowed from one of several parameters, or a struct holding a reference. In both cases the compiler's help message usually suggests exactly the annotation you need. If annotating starts to feel like a fight, that's a sign to own the data instead of borrowing it.

:::rosalind LCSM Finding a Shared Motif
A **motif** is a short stretch of DNA that shows up again and again, often because it does something important, such as marking where a protein should bind. One way to hunt for motifs is to take the same region from several related organisms and look for the longest piece of sequence they all share.

Given a FASTA dataset of up to 100 DNA strings (each up to 1000 bases, possibly wrapped over several lines), print one **longest common substring**: a run of consecutive bases that appears in every string and is as long as possible. If several share the longest length, any one of them is accepted.

The heart of the solution returns a slice of one of the input strings, with no copying:

```rust,ignore
fn longest_common_substring<'a>(seqs: &[&'a str]) -> &'a str
```

Here the annotation is required and does real work. The parameter contains *two* references: the outer slice `&[...]` and the `&str`s inside it. Elision can't guess which one the result borrows from, so you say it: the result lives as long as the strings (`'a`), not as long as the temporary list of them. That means the caller can drop the `Vec<&str>` and keep the answer.

A simple approach that is fast enough:

1. Any common substring must appear in the shortest sequence, so take substrings of that one as candidates.
2. Try lengths 1, 2, 3 and so on. For each length, look for any candidate that every sequence `contains`.
3. As soon as a length has no common candidate, stop: if no common substring of length *L* exists, none of length *L* + 1 can, since it would contain one of length *L*. The last one you found is the answer.

For this sample:

```text
>Rosalind_2801
TTAGGCATCGAT
>Rosalind_0539
CATCGGTAGGCA
>Rosalind_6114
GGTAGGCTTCATCG
```

the output is:

```text
TAGGC
```

`CATCG` also appears in all three and has the same length, so it would be accepted too.
:::solution
```rust
use std::error::Error;

struct Record {
    id: String,
    seq: String,
}

fn parse_fasta(text: &str) -> Vec<Record> {
    let mut records: Vec<Record> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(id) = line.strip_prefix('>') {
            records.push(Record { id: id.to_string(), seq: String::new() });
        } else if let Some(last) = records.last_mut() {
            last.seq.push_str(line);
        }
    }
    records
}

/// Is `motif` a substring of every sequence?
fn in_all(motif: &str, seqs: &[&str]) -> bool {
    for s in seqs {
        if !s.contains(motif) {
            return false;
        }
    }
    true
}

/// One longest substring shared by all of `seqs`, borrowed from one of them.
fn longest_common_substring<'a>(seqs: &[&'a str]) -> &'a str {
    if seqs.is_empty() {
        return "";
    }
    // Every common substring is part of the shortest sequence, so search that one.
    let mut shortest = seqs[0];
    for &s in seqs {
        if s.len() < shortest.len() {
            shortest = s;
        }
    }

    let mut best = "";
    for len in 1..=shortest.len() {
        let mut found = None;
        for start in 0..=shortest.len() - len {
            let candidate = &shortest[start..start + len];
            if in_all(candidate, seqs) {
                found = Some(candidate);
                break;
            }
        }
        match found {
            Some(motif) => best = motif,
            // No common substring of this length means none of any longer length either.
            None => break,
        }
    }
    best
}

const SAMPLE: &str = "
>Rosalind_2801
TTAGGCATCGAT
>Rosalind_0539
CATCGGTAGGCA
>Rosalind_6114
GGTAGGCTTCATCG
";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let records = parse_fasta(&input);

    let mut seqs: Vec<&str> = Vec::new();
    for r in &records {
        seqs.push(&r.seq);
    }
    println!("{}", longest_common_substring(&seqs));
    Ok(())
}
```

```text
TAGGC
```

Try deleting the three `'a`s from `longest_common_substring`: you get E0106, "missing lifetime specifier", because the signature has two input lifetimes and elision rule 2 needs exactly one. Inside the function, `shortest`, `candidate` and `best` are all `&'a str` slices pointing into the records' strings, so the answer is never copied. It only becomes an owned `String` if you ask for one. Checking 100 sequences of 1000 bases this way takes well under a second.
:::

:::exercise A zero-copy FASTA view
The FASTA parsers so far copied every ID and sequence into new `String`s. For a big file you might prefer to leave the text where it is and just point into it. Write:

```rust,ignore
struct RecordView<'a> {
    id: &'a str,
    seq: &'a str,
}
```

1. A method `gc_content(&self) -> f64`, as in the Structs lesson.
2. `fn parse_views<'a>(text: &'a str) -> Vec<RecordView<'a>>` for FASTA where every sequence fits on **one** line: for each header line, the ID is the rest of the line after `>` and the sequence is the next line. `while let Some(line) = lines.next()` lets you pull the sequence line out of the same iterator inside the loop.

Print the ID, GC content and debug form of each view. Then try parsing a `String` inside an inner block and using the views after the block ends, and read the compiler's complaint.
:::solution
```rust
/// A record that borrows its ID and sequence from the file's text instead of copying them.
#[derive(Debug)]
struct RecordView<'a> {
    id: &'a str,
    seq: &'a str,
}

impl<'a> RecordView<'a> {
    fn gc_content(&self) -> f64 {
        let mut gc = 0;
        for b in self.seq.bytes() {
            if b == b'G' || b == b'C' {
                gc += 1;
            }
        }
        100.0 * gc as f64 / self.seq.len() as f64
    }
}

/// Parses FASTA where every sequence is on a single line.
fn parse_views<'a>(text: &'a str) -> Vec<RecordView<'a>> {
    let mut views = Vec::new();
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        if let Some(id) = line.strip_prefix('>') {
            let seq = lines.next().unwrap_or("").trim();
            views.push(RecordView { id, seq });
        }
    }
    views
}

fn main() {
    let text = String::from(">Rosalind_0001\nGATTACA\n>Rosalind_0002\nGGCCGCTA\n");
    let views = parse_views(&text);
    for v in &views {
        println!("{} {:.2} {:?}", v.id, v.gc_content(), v);
    }
}
```

```text
Rosalind_0001 28.57 RecordView { id: "Rosalind_0001", seq: "GATTACA" }
Rosalind_0002 75.00 RecordView { id: "Rosalind_0002", seq: "GGCCGCTA" }
```

The views can't outlive the text they point into:

```rust,compile_fail
#[derive(Debug)]
struct RecordView<'a> {
    id: &'a str,
    seq: &'a str,
}

fn parse_views<'a>(text: &'a str) -> Vec<RecordView<'a>> {
    let mut views = Vec::new();
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        if let Some(id) = line.strip_prefix('>') {
            let seq = lines.next().unwrap_or("").trim();
            views.push(RecordView { id, seq });
        }
    }
    views
}

fn main() {
    let views;
    {
        let text = String::from(">Rosalind_0001\nGATTACA\n");
        views = parse_views(&text);
    }
    println!("{views:?}");
}
```

```text
error[E0597]: `text` does not live long enough
  --> src/main.rs:23:29
   |
22 |         let text = String::from(">Rosalind_0001\nGATTACA\n");
   |             ---- binding `text` declared here
23 |         views = parse_views(&text);
   |                             ^^^^^ borrowed value does not live long enough
24 |     }
   |     - `text` dropped here while still borrowed
25 |     println!("{views:?}");
   |                ----- borrow later used here
```

Why only single-line sequences? A `&str` must be one unbroken run of bytes. A wrapped sequence is split by newline characters in the file, so there is no single slice that holds it without the newlines, and joining the pieces means allocating a new `String`. That is the trade-off from the tip above in miniature: borrowing is free when the data already has the shape you need, and owning is the simple answer when it doesn't.
:::

```quiz
? What does writing `'a` in `fn longest<'a>(x: &'a str, y: &'a str) -> &'a str` do at run time?
- It keeps `x` and `y` alive until the result is dropped.
- It copies the longer string so the result is always valid.
+ Nothing; it only tells the compiler how the lifetimes of the references relate.
= Lifetime annotations are purely a compile-time description. They never change when values are dropped.

? Why does `fn pick(a: &str, b: &str) -> &str` need an annotation while `fn trim(s: &str) -> &str` doesn't?
+ With two reference parameters, the elision rules can't tell which one the output borrows from.
- Functions with two parameters always need lifetimes.
- `trim` returns a string literal.
- `pick` might return an owned `String`.
= Elision rule 2 only applies when there's exactly one reference parameter. With two (and no `self`), the compiler asks you to say which the result is tied to.

? In `longest`, the caller passes one string that lives long and one that lives briefly. How long is the result usable?
- As long as the longer-lived string.
+ Only as long as the shorter-lived string.
- Until the end of the program.
= `'a` must fit both inputs, so it's the overlap of their lifetimes. The compiler doesn't know at compile time which one will be returned.

? What does `&'static str` mean?
- A string that can never be changed.
+ A reference that is valid for the whole run of the program, such as a string literal.
- A string stored on the heap.
= String literals live in the program's binary, so references to them are always valid. `'static` is not a tool for silencing borrow errors.
```
