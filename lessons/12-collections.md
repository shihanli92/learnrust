---
title: Collections
module: Modelling data
summary: Store any number of values with Vec, look things up by key with HashMap, and meet HashSet and BTreeMap.
minutes: 35
---

Arrays and tuples have a size fixed at compile time. Most programs need to hold a number of things they only discover while running: lines in a file, users who signed up, words in a document. The standard library's **collections** handle this. Their data lives on the heap, so they can grow and shrink as needed.

You will use three collections far more than any others: `Vec<T>` for a list, `String` for text (which you already know), and `HashMap<K, V>` for looking up values by key. This lesson covers those, plus two useful relatives.

## Vec: a growable list

A `Vec<T>` (say "vector") holds any number of values of one type `T`, next to each other in memory. The `vec!` macro creates one with initial contents, and `Vec::new()` creates an empty one:

```rust
fn main() {
    let mut scores: Vec<i32> = Vec::new();
    scores.push(72);
    scores.push(95);
    scores.push(88);

    let primes = vec![2, 3, 5, 7, 11];

    println!("scores = {scores:?}, len = {}", scores.len());
    println!("primes = {primes:?}");
    println!("first prime = {}", primes[0]);
    println!("last score = {:?}", scores.pop());
    println!("after pop = {scores:?}");
}
```

```text
scores = [72, 95, 88], len = 3
primes = [2, 3, 5, 7, 11]
first prime = 2
last score = Some(88)
after pop = [72, 95]
```

A vector must be `mut` for `push` and `pop` to work, because they change it. `pop` returns an `Option`, since an empty vector has nothing to give back. With `Vec::new()` Rust needs to know the element type; here the annotation `Vec<i32>` tells it, though usually it can work it out from the first `push`.

### Reading elements: indexing vs get

There are two ways to read an element, and the difference matters:

```rust,should_panic
fn main() {
    let v = vec![10, 20, 30];

    // get returns an Option: Some(&value) or None
    match v.get(7) {
        Some(x) => println!("element 7 is {x}"),
        None => println!("there is no element 7"),
    }

    // indexing returns the value directly, and panics if out of bounds
    let x = v[7];
    println!("never printed: {x}");
}
```

```text
there is no element 7

thread 'main' panicked at src/main.rs:11:14:
index out of bounds: the len is 3 but the index is 7
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

Use `v[i]` when an out-of-range index would be a bug in your program; crashing loudly is then the right response. Use `v.get(i)` when the index comes from outside (user input, a file) and "not there" is a normal situation you want to handle.

### Iterating

A `for` loop over `&v` borrows each element in turn. Over `&mut v` it gives you mutable references, so you can change elements in place:

```rust
fn main() {
    let mut prices = vec![100, 250, 80];

    for p in &mut prices {
        *p += *p / 10; // add 10%
    }

    let mut total = 0;
    for p in &prices {
        total += p;
    }
    println!("{prices:?}, total {total}");

    for (i, p) in prices.iter().enumerate() {
        println!("item {i}: {p}");
    }
}
```

```text
[110, 275, 88], total 473
item 0: 110
item 1: 275
item 2: 88
```

The `*` in `*p += ...` **dereferences** the mutable reference: it means "the value `p` points at", not the reference itself. `enumerate()` pairs each element with its position; you will see much more of this style in the Closures and Iterators lesson.

Writing `for p in prices` (no `&`) would *move* the vector into the loop, and you could not use `prices` afterwards. That's occasionally what you want, but borrowing is the usual choice.

### Vectors and the borrow rules

The borrow checker applies to vectors with a twist that surprises everyone once:

```rust,compile_fail
fn main() {
    let mut v = vec![1, 2, 3];
    let first = &v[0];
    v.push(4);
    println!("first is {first}");
}
```

```text
error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
 --> src/main.rs:4:5
  |
3 |     let first = &v[0];
  |                  - immutable borrow occurs here
4 |     v.push(4);
  |     ^^^^^^^^^ mutable borrow occurs here
5 |     println!("first is {first}");
  |                         ----- immutable borrow later used here
```

Why should adding to the *end* affect a reference to the *start*? Because a vector keeps its elements in one block of memory. When that block is full, `push` allocates a bigger one, copies everything over and frees the old block. `first` would then point at freed memory. The borrow rules make that bug impossible. The fix is to finish using `first` before the `push`, or to copy the value out with `let first = v[0];`.

### Storing different kinds of value

A `Vec` holds one type only. When you need a list of mixed things, define an enum with a variant for each kind, as you did with `Shape` in the Enums lesson, and store the enum.

## String, revisited

A `String` is really a `Vec<u8>` of UTF-8 bytes with a promise that the bytes are valid text. That is why it behaves so much like a vector: `push_str` to grow it, `len()` for its size *in bytes*, and no indexing by position with `s[0]`, because one character can take several bytes.

```rust
fn main() {
    let mut s = String::from("crab");
    s.push_str("s are ");
    s += "great";
    println!("{s} ({} bytes)", s.len());

    for word in s.split_whitespace() {
        print!("[{word}] ");
    }
    println!();
    println!("chars in 'héllo': {}", "héllo".chars().count());
}
```

```text
crabs are great (15 bytes)
[crabs] [are] [great] 
chars in 'héllo': 5
```

## HashMap: look things up by key

A `HashMap<K, V>` stores **key-value pairs**, and finds the value for a key quickly no matter how many entries there are. Think of a phone book or a dictionary. It is not imported automatically, so you bring it in with `use`:

```rust
use std::collections::HashMap;

fn main() {
    let mut stock: HashMap<String, u32> = HashMap::new();
    stock.insert(String::from("apples"), 12);
    stock.insert(String::from("pears"), 4);
    stock.insert(String::from("apples"), 20); // replaces the old value

    match stock.get("apples") {
        Some(n) => println!("apples: {n}"),
        None => println!("no apples"),
    }

    let plums = stock.get("plums").copied().unwrap_or(0);
    println!("plums: {plums}");

    if stock.contains_key("pears") {
        println!("we sell pears");
    }

    stock.remove("pears");
    println!("{} kind(s) left", stock.len());
}
```

```text
apples: 20
plums: 0
we sell pears
1 kind(s) left
```

`get` returns `Option<&V>` because the key might be missing. `copied()` turns an `Option<&u32>` into an `Option<u32>`, so you can use `unwrap_or` with a plain number. Notice you can look up a `String` key with a `&str` like `"apples"`; the map is clever enough to compare them.

:::note Ownership and maps
`insert` takes ownership of the key and value. After `map.insert(name, score)`, a `String` variable `name` has been moved into the map. For `Copy` types like `u32`, the value is simply copied.
:::

### The entry API: counting words

A very common task is "update the value for this key, or start it off if the key is new". The **entry API** does this in one step. `entry(key)` looks up the slot for a key, and `or_insert(default)` fills it if empty and returns a mutable reference to the value:

```rust
use std::collections::HashMap;

fn main() {
    let text = "the cat sat on the mat the end";
    let mut counts: HashMap<&str, u32> = HashMap::new();

    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }

    let mut words: Vec<&str> = counts.keys().copied().collect();
    words.sort();
    for w in words {
        println!("{w}: {}", counts[w]);
    }
}
```

```text
cat: 1
end: 1
mat: 1
on: 1
sat: 1
the: 3
```

The line `*counts.entry(word).or_insert(0) += 1;` reads: find the slot for `word`, put `0` there if it's new, then add one to whatever is there. The `*` dereferences the `&mut u32` that `or_insert` returns.

:::warning Hash maps have no order
Iterating over a `HashMap` visits entries in an **unspecified order**, which can differ between runs of the same program. That is why the example collects the keys into a vector and sorts them before printing. If you want entries kept in sorted order, use a `BTreeMap` (below).
:::

`collect()` gathers the keys into a `Vec`; you'll learn how it works in the Closures and Iterators lesson. You can also loop over a map directly with `for (key, value) in &map`, as long as the order doesn't matter to you.

## HashSet: unique values

A `HashSet<T>` is like a `HashMap` with keys but no values. It stores each value at most once and answers "is this in the set?" quickly:

```rust
use std::collections::HashSet;

fn main() {
    let mut seen = HashSet::new();
    for n in [3, 1, 3, 2, 1, 3] {
        if !seen.insert(n) {
            println!("{n} is a duplicate");
        }
    }
    println!("{} unique values", seen.len());
    println!("contains 2? {}", seen.contains(&2));
}
```

```text
3 is a duplicate
1 is a duplicate
3 is a duplicate
3 unique values
contains 2? true
```

`insert` returns `false` if the value was already there, which makes duplicate detection a one-liner.

## BTreeMap: sorted keys

`BTreeMap<K, V>` has the same core methods as `HashMap` (`insert`, `get`, `entry`, `remove`), but keeps its keys **sorted**. Iterating over it always goes in key order, so output is predictable:

```rust
use std::collections::BTreeMap;

fn main() {
    // Approximate genome sizes, in base pairs.
    let mut genome_size = BTreeMap::new();
    genome_size.insert("yeast", 12_000_000_u64);
    genome_size.insert("human", 3_100_000_000);
    genome_size.insert("E. coli", 4_600_000);

    for (organism, bases) in &genome_size {
        println!("{organism}: {bases}");
    }
}
```

```text
E. coli: 4600000
human: 3100000000
yeast: 12000000
```

## Choosing a collection

| Collection | Use it for | Order |
| --- | --- | --- |
| `Vec<T>` | A list of items, accessed by position or in sequence | Insertion order |
| `String` | Growable text | As written |
| `HashMap<K, V>` | Fast lookup of values by key | Unspecified |
| `BTreeMap<K, V>` | Lookup by key when you also need sorted iteration | Sorted by key |
| `HashSet<T>` | Unique values and fast "is it in here?" checks | Unspecified |

When in doubt, start with a `Vec`. It is the simplest and, for small amounts of data, often the fastest.

:::rosalind CONS Consensus and Profile
When biologists line up the same gene from several related organisms, they often summarise the alignment in two ways. The **profile** counts, for every column (position), how many of the strings have an A, a C, a G and a T there. The **consensus string** takes the most common base in each column: a best guess at the ancestral sequence the others descend from.

You get a FASTA dataset of up to 10 DNA strings, all the same length (up to 1000 bases, possibly wrapped over several lines). Print the consensus string on the first line, then four lines of the profile in exactly this format, each count separated by a single space:

```text
A: 0 2 0 ...
C: 1 1 1 ...
G: 3 1 0 ...
T: 0 0 3 ...
```

If several bases tie for the most common in a column, any of them is accepted.

A good shape for the profile is a `Vec<[u32; 4]>`: one entry per column, each holding the four counts in the order A, C, G, T. `vec![[0; 4]; len]` makes `len` columns of zeros in one go. Parse the input with your FASTA parser from the Structs lesson; now that you know `if let`, the "append to the newest record" step can be `if let Some(last) = records.last_mut() { ... }`, which does nothing instead of panicking if a sequence line comes before any header.

For this sample:

```text
>Rosalind_0118
GCTTCAGT
TC
>Rosalind_5521
GACTCAGT
AC
>Rosalind_7340
CATTGAGA
TG
>Rosalind_2206
GGTTCACA
TC
```

the output is:

```text
GATTCAGATC
A: 0 2 0 0 0 4 0 2 1 0
C: 1 1 1 0 3 0 1 0 0 3
G: 3 1 0 0 1 0 3 0 0 1
T: 0 0 3 4 0 0 0 2 3 0
```
:::solution
```rust
struct Record {
    id: String,
    seq: String,
}

fn parse_fasta(text: &str) -> Vec<Record> {
    let mut records: Vec<Record> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('>') {
            records.push(Record { id: line[1..].to_string(), seq: String::new() });
        } else if let Some(last) = records.last_mut() {
            last.seq.push_str(line);
        }
    }
    records
}

const DATASET: &str = "
>Rosalind_0118
GCTTCAGT
TC
>Rosalind_5521
GACTCAGT
AC
>Rosalind_7340
CATTGAGA
TG
>Rosalind_2206
GGTTCACA
TC
";

fn main() {
    let records = parse_fasta(DATASET.trim());
    let len = records[0].seq.len();

    // profile[column] = [count of A, count of C, count of G, count of T]
    let mut profile: Vec<[u32; 4]> = vec![[0; 4]; len];
    for rec in &records {
        for (col, base) in rec.seq.bytes().enumerate() {
            let row = match base {
                b'A' => 0,
                b'C' => 1,
                b'G' => 2,
                b'T' => 3,
                _ => continue, // ignore anything that isn't a base
            };
            profile[col][row] += 1;
        }
    }

    let letters = ['A', 'C', 'G', 'T'];

    let mut consensus = String::new();
    for counts in &profile {
        let mut best = 0;
        for row in 1..4 {
            if counts[row] > counts[best] {
                best = row;
            }
        }
        consensus.push(letters[best]);
    }
    println!("{consensus}");

    for row in 0..4 {
        let mut line = format!("{}:", letters[row]);
        for counts in &profile {
            line.push_str(&format!(" {}", counts[row]));
        }
        println!("{line}");
    }
}
```

```text
GATTCAGATC
A: 0 2 0 0 0 4 0 2 1 0
C: 1 1 1 0 3 0 1 0 0 3
G: 3 1 0 0 1 0 3 0 0 1
T: 0 0 3 4 0 0 0 2 3 0
```

In column 8 (the eighth letter), A and T both appear twice. The loop only replaces `best` when a count is strictly bigger, so the tie goes to the letter that comes first, A. `continue` inside the `match` skips to the next base, which is a neat way to ignore unexpected characters.
:::

:::rosalind GRPH Overlap Graphs
Sequencing machines can't read a whole genome in one go. They read millions of short overlapping pieces, and assembly software has to work out which piece follows which. One simple clue: if the end of piece *s* is the same as the start of piece *t*, then *t* may come right after *s*. Drawing an arrow from *s* to *t* for every such pair gives an **overlap graph**.

Given a FASTA dataset of DNA strings, print one line `id_s id_t` for every pair of *different* records where the last 3 bases of *s* equal the first 3 bases of *t*. A record never points to itself, even if its own start and end match. Rosalind accepts the lines in any order, but make yours deterministic: loop over the records in input order.

Comparing every record with every other one works fine for Rosalind's dataset sizes. A tidier approach uses a `HashMap<&str, Vec<usize>>` that maps each 3-base prefix to the positions of the records starting with it. Then each record needs only one lookup, with its own suffix. The map borrows the prefixes straight out of the records, so nothing is copied. Just don't loop over the map itself to print, since its order is unspecified; loop over the records and use `get`.

For this sample:

```text
>Rosalind_0808
AAGTCCGA
>Rosalind_1414
CGATTTAC
>Rosalind_2323
TACCGAAG
>Rosalind_3131
CGAGGTAA
>Rosalind_4747
AAGCGA
>Rosalind_5050
TAATTAA
```

the output is:

```text
Rosalind_0808 Rosalind_1414
Rosalind_0808 Rosalind_3131
Rosalind_1414 Rosalind_2323
Rosalind_2323 Rosalind_0808
Rosalind_2323 Rosalind_4747
Rosalind_3131 Rosalind_5050
Rosalind_4747 Rosalind_1414
Rosalind_4747 Rosalind_3131
```
:::solution
```rust
use std::collections::HashMap;

struct Record {
    id: String,
    seq: String,
}

fn parse_fasta(text: &str) -> Vec<Record> {
    let mut records: Vec<Record> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('>') {
            records.push(Record { id: line[1..].to_string(), seq: String::new() });
        } else if let Some(last) = records.last_mut() {
            last.seq.push_str(line);
        }
    }
    records
}

const DATASET: &str = "
>Rosalind_0808
AAGTCCGA
>Rosalind_1414
CGATTTAC
>Rosalind_2323
TACCGAAG
>Rosalind_3131
CGAGGTAA
>Rosalind_4747
AAGCGA
>Rosalind_5050
TAATTAA
";

const K: usize = 3;

fn main() {
    let records = parse_fasta(DATASET.trim());

    // Index every record by its first K bases: prefix -> positions in `records`.
    let mut by_prefix: HashMap<&str, Vec<usize>> = HashMap::new();
    for (i, rec) in records.iter().enumerate() {
        by_prefix.entry(&rec.seq[..K]).or_insert(Vec::new()).push(i);
    }

    for (i, s) in records.iter().enumerate() {
        let suffix = &s.seq[s.seq.len() - K..];
        if let Some(matches) = by_prefix.get(suffix) {
            for &j in matches {
                if j != i {
                    println!("{} {}", s.id, records[j].id);
                }
            }
        }
    }
}
```

```text
Rosalind_0808 Rosalind_1414
Rosalind_0808 Rosalind_3131
Rosalind_1414 Rosalind_2323
Rosalind_2323 Rosalind_0808
Rosalind_2323 Rosalind_4747
Rosalind_3131 Rosalind_5050
Rosalind_4747 Rosalind_1414
Rosalind_4747 Rosalind_3131
```

`Rosalind_5050` starts and ends with `TAA`, but the `j != i` check keeps it from pointing at itself. The map stores positions (`usize`) rather than records, because the records already live in the `Vec`; the positions are cheap to copy and let you compare "is this the same record?" with a simple `!=`. Each `Vec` in the map keeps records in the order they were pushed, so the output order is fixed. The entry API with `or_insert(Vec::new())` is the same trick as counting words: create an empty list for a new prefix, then push onto it.
:::

```quiz
? What does `v.get(10)` return for a vector `v` with 3 elements?
- It panics.
+ `None`
- `0`
- The last element
= `get` returns an `Option<&T>`, so an out-of-range index gives `None`. Indexing with `v[10]` would panic instead.

? Why does the compiler reject taking `&v[0]`, then calling `v.push(4)`, then using the reference?
- Because `push` can only be called on empty vectors.
- Because references to vector elements are never allowed.
+ Because `push` may move the elements to new memory, leaving the reference dangling.
= When a vector outgrows its buffer, `push` reallocates. The borrow rules forbid mutating `v` while an immutable borrow is still in use, which prevents the dangling reference.

? What does `*counts.entry(word).or_insert(0) += 1;` do?
+ Adds one to the count for `word`, starting from 0 if it wasn't in the map yet.
- Sets the count for `word` to 1, replacing any existing value.
- Inserts 0 for `word` and never changes it.
= `or_insert` returns a mutable reference to the (possibly new) value, and `*... += 1` increments it in place.

? You print every entry of a `HashMap` and the order changes between runs. What's the best fix if you need a stable order?
- Call `sort()` on the `HashMap`.
- Insert the keys in alphabetical order.
+ Sort the keys before printing, or use a `BTreeMap`.
= A `HashMap`'s iteration order is unspecified, regardless of insertion order. Sorting the keys, or using a `BTreeMap` that keeps them sorted, gives predictable output.
```
