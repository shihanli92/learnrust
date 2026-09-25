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
    let mut population = BTreeMap::new();
    population.insert("Oslo", 709_000);
    population.insert("Bergen", 291_000);
    population.insert("Trondheim", 214_000);

    for (city, people) in &population {
        println!("{city}: {people}");
    }
}
```

```text
Bergen: 291000
Oslo: 709000
Trondheim: 214000
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

:::exercise Average and maximum
Write `fn stats(values: &[f64]) -> Option<(f64, f64)>` that returns `None` for an empty slice, otherwise `Some((average, maximum))`. Call it with a `Vec` in `main` (a `&Vec<f64>` turns into a `&[f64]` automatically) and with an empty vector.
:::solution
```rust
fn stats(values: &[f64]) -> Option<(f64, f64)> {
    if values.is_empty() {
        return None;
    }
    let mut sum = 0.0;
    let mut max = values[0];
    for &v in values {
        sum += v;
        if v > max {
            max = v;
        }
    }
    Some((sum / values.len() as f64, max))
}

fn main() {
    let temps = vec![18.5, 21.0, 19.5, 25.0];
    println!("{:?}", stats(&temps));
    let empty: Vec<f64> = Vec::new();
    println!("{:?}", stats(&empty));
}
```

```text
Some((21.0, 25.0))
None
```
:::

:::exercise Letter frequencies
Count how often each letter appears in `"hello world"`, ignoring spaces, using a `BTreeMap<char, u32>` and the entry API. Print each letter and its count; because it's a `BTreeMap`, they come out in alphabetical order.
:::solution
```rust
use std::collections::BTreeMap;

fn main() {
    let mut freq: BTreeMap<char, u32> = BTreeMap::new();
    for c in "hello world".chars() {
        if c != ' ' {
            *freq.entry(c).or_insert(0) += 1;
        }
    }
    for (c, n) in &freq {
        println!("{c}: {n}");
    }
}
```

```text
d: 1
e: 1
h: 1
l: 3
o: 2
r: 1
w: 1
```
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
