---
title: Slices and Strings
module: Ownership
summary: Borrow part of an array or string with slices, understand String versus &str, and work with UTF-8 text safely.
minutes: 35
---

A reference lets you borrow a whole value. Often you only need part of it: the first three scores in an array, or the first word of a sentence. A **slice** is a reference to a run of consecutive elements inside a collection. Like any reference, it borrows; it doesn't own.

Slices are also the key to understanding Rust's two string types, `String` and `&str`, which confuse nearly every newcomer. By the end of this lesson you will know which one to use where, and why Rust won't let you write `text[0]`.

## Array slices

You make a slice by borrowing a **range** of indexes:

```rust
fn main() {
    let scores = [72, 95, 88, 61, 79];

    let first_three = &scores[0..3]; // indexes 0, 1, 2
    let from_two = &scores[2..];     // index 2 to the end
    let up_to_two = &scores[..2];    // start to index 1
    let all = &scores[..];           // the whole array

    println!("{:?} {:?} {:?} {:?}", first_three, from_two, up_to_two, all);
    println!("The first slice has {} elements", first_three.len());
}
```

```text
[72, 95, 88] [88, 61, 79] [72, 95] [72, 95, 88, 61, 79]
The first slice has 3 elements
```

The ranges work just like in `for` loops: `0..3` excludes 3. Leave out the start to begin at 0, and leave out the end to go to the last element.

The type of a slice of `i32` values is `&[i32]`. Notice that there is no length in the type, unlike the array type `[i32; 5]`. A slice is a pointer to the first element plus a length, and the length is stored in the slice itself at run time:

```text
 first_three (&[i32])          scores ([i32; 5])
+-----+                  +----+----+----+----+----+
| ptr-+----------------> | 72 | 95 | 88 | 61 | 79 |
| len | 3                +----+----+----+----+----+
+-----+
```

That makes slices perfect for function parameters. A function that takes `&[i32]` accepts a whole array, or any part of one:

```rust
fn sum(values: &[i32]) -> i32 {
    let mut total = 0;
    for v in values {
        total += *v; // `v` is a &i32, so dereference it
    }
    total
}

fn main() {
    let scores = [72, 95, 88, 61, 79];
    println!("All: {}", sum(&scores));
    println!("First two: {}", sum(&scores[..2]));
}
```

```text
All: 395
First two: 167
```

## String slices: `&str`

A slice of a `String` has the type `&str` (pronounced "string slice"). It works the same way, but the range counts **bytes**:

```rust
fn main() {
    let s = String::from("hello world");

    let hello = &s[0..5];
    let world = &s[6..11];

    println!("{world}, {hello}!");
}
```

```text
world, hello!
```

`hello` doesn't copy any text. It points into the heap memory owned by `s`, with a length of 5.

Because a slice is a borrow, all the rules from the last lesson apply. Here is a function that returns the first word of a string, and a program that tries to clear the string while that word is still in use:

```rust,compile_fail
fn first_word(s: &String) -> &str {
    let bytes = s.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b' ' {
            return &s[..i];
        }
    }
    &s[..]
}

fn main() {
    let mut s = String::from("hello world");
    let word = first_word(&s);
    s.clear(); // empties the String
    println!("The first word is: {word}");
}
```

```text
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
  --> src/main.rs:14:5
   |
13 |     let word = first_word(&s);
   |                           -- immutable borrow occurs here
14 |     s.clear(); // empties the String
   |     ^^^^^^^^^ mutable borrow occurs here
15 |     println!("The first word is: {word}");
   |                                   ---- immutable borrow later used here
```

If this compiled, `word` would refer to text that no longer exists. The borrow checker ties the slice to the `String` it came from, so the bug is caught at compile time.

## String literals are `&str`

You have been using string slices since lesson one. A string literal such as `"hello"` has the type `&str`:

```rust
fn main() {
    let greeting: &str = "hello";
    println!("{greeting}");
}
```

```text
hello
```

The text of a literal is stored inside the compiled program itself, and `greeting` is a slice pointing at it. That is why literals are immutable: you are borrowing text that is part of the program.

## String versus `&str`

Now the two types can be compared side by side:

| | `String` | `&str` |
| --- | --- | --- |
| Ownership | Owns its text | Borrows text owned by something else |
| Where the text lives | On the heap | Wherever the owner keeps it: a `String`, or the program itself for literals |
| Can grow or change | Yes, if declared `mut` | No |
| Typical use | Building or storing text | Reading or passing text around |
| Create from the other | `String::from(s)`, `s.to_string()` | `&s[..]`, `s.as_str()`, or just `&s` |

The relationship is the same as between an array and a slice of it. A `String` is the owner; a `&str` is a view into some text.

## Prefer `&str` for parameters

The `first_word` function above takes `&String`. A more experienced Rust programmer would write `&str` instead:

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b' ' {
            return &s[..i];
        }
    }
    s
}

fn main() {
    let owned = String::from("hello world");
    println!("{}", first_word(&owned));        // a &String works...
    println!("{}", first_word("good morning")); // ...and so does a literal
    println!("{}", first_word(&owned[6..]));   // ...and so does a slice
}
```

```text
hello
good
world
```

A `&str` parameter accepts more kinds of input. Passing `&owned` works because Rust automatically converts a `&String` into a `&str` when a function asks for one. (This is called **deref coercion**. It is also why `push_str` and other methods that expect a `&str` happily accept a `&String`.) The reverse is not true: a function that demands `&String` cannot take a literal.

The rule of thumb: take `&str` when you only need to read text, and use `String` when you need to own or build it.

## Strings are UTF-8

A `String` stores its text as **UTF-8** bytes. UTF-8 uses a single byte for each basic English letter, but two, three or four bytes for other characters. So the length of a string, in bytes, is not the same as the number of characters:

```rust
fn main() {
    let english = "hello";
    let russian = "Здравствуйте";
    println!("{} bytes, {} chars", english.len(), english.chars().count());
    println!("{} bytes, {} chars", russian.len(), russian.chars().count());
}
```

```text
5 bytes, 5 chars
24 bytes, 12 chars
```

Every Cyrillic letter takes two bytes. `len()` returns the number of **bytes**, because that is what it can answer instantly. Counting characters means walking through the whole string.

### Why you can't index a String

This is why Rust refuses to let you write `s[0]`:

```rust,compile_fail
fn main() {
    let s = String::from("hello");
    let h = s[0];
}
```

```text
error[E0277]: the type `str` cannot be indexed by `{integer}`
 --> src/main.rs:3:15
  |
3 |     let h = s[0];
  |               ^ string indices are ranges of `usize`
  |
  = note: you can use `.chars().nth()` or `.bytes().nth()`
```

What should `s[0]` return for `"Здравствуйте"`? The first *byte* is only half of the letter `З`, which is meaningless on its own. The first *character* would take a scan of the string, and people expect indexing to be instant. Rather than guess, Rust makes you say what you mean.

### chars and bytes

To go through a string, pick the view you want:

```rust
fn main() {
    let word = "héllo";

    for c in word.chars() {
        print!("{c} ");
    }
    println!();

    for b in word.bytes() {
        print!("{b} ");
    }
    println!();
}
```

```text
h é l l o 
104 195 169 108 108 111 
```

`.chars()` gives you each `char` (a Unicode scalar value, from the types lesson). `.bytes()` gives you the raw `u8` values: notice that `é` is made of the two bytes 195 and 169.

### Slices must land on character boundaries

Slicing with a byte range is allowed, but both ends of the range must fall *between* characters. If a range cuts a character in half, the program panics:

```rust,should_panic
fn main() {
    let s = String::from("Здравствуйте");
    let first = &s[0..1]; // byte 1 is in the middle of 'З'
    println!("{first}");
}
```

```text
thread 'main' panicked at src/main.rs:3:19:
byte index 1 is not a char boundary; it is inside 'З' (bytes 0..2) of `Здравствуйте`
```

`&s[0..2]` would work and give you `"З"`. Slicing is safe when you know where the boundaries are, for example because you found them by searching for an ASCII character like a space, as `first_word` does. ASCII characters are always a single byte, and those byte values never appear inside a multi-byte character, so the index of a space is always a boundary. When in doubt, use `.chars()`.

:::warning Slicing text by numbers is a common source of panics
Code like `&name[..3]` works on every test string you try in English, then crashes on the first name with an accent. Only slice at positions you have found by searching the string, never at positions you assume.
:::

DNA, RNA and protein strings are the happy exception. They only ever contain plain ASCII capital letters, one byte each, so for a sequence `len()` is exactly the number of letters and every byte position is a character boundary. That is why bioinformatics code slices sequences by position all the time, as you will in the exercises below. Just remember that the guarantee comes from the data, not from Rust.

## Common String methods

Here are the methods you will reach for most often. Methods that only read text work on `&str`, so they work on a `String` too.

| Method | What it does |
| --- | --- |
| `s.push_str("abc")` | Appends text to a `mut String` |
| `s.push('!')` | Appends one `char` to a `mut String` |
| `format!("{a}-{b}")` | Builds a new `String`, like `println!` but returning the text |
| `a + &b` | Joins two strings; takes ownership of `a` |
| `s.len()` | Length in bytes |
| `s.is_empty()` | `true` if the length is 0 |
| `s.contains("abc")` | Whether the text appears anywhere |
| `s.replace("a", "b")` | Returns a new `String` with every match replaced |
| `s.split_whitespace()` | Iterates over the words |
| `s.trim()` | Returns a `&str` without leading and trailing whitespace |
| `s.to_uppercase()` | Returns a new, upper-cased `String` |

Here they are in action:

```rust
fn main() {
    let mut s = String::from("Hello");
    s.push_str(", world");
    s.push('!');
    println!("{s}");

    let first = String::from("tic");
    let second = String::from("tac");
    let game = first + "-" + &second; // `first` is moved; `second` is borrowed
    println!("{game}");

    let label = format!("{game}-{}", "toe"); // format! borrows, never moves
    println!("{label} ({} bytes)", label.len());

    let padded = "   Rust is fun   ";
    let trimmed = padded.trim();
    println!("[{trimmed}] empty? {}", trimmed.is_empty());
    println!("{}", trimmed.contains("fun"));
    println!("{}", trimmed.replace("fun", "great"));
    println!("{}", trimmed.to_uppercase());

    for word in trimmed.split_whitespace() {
        println!("word: {word}");
    }
}
```

```text
Hello, world!
tic-tac
tic-tac-toe (11 bytes)
[Rust is fun] empty? false
true
Rust is great
RUST IS FUN
word: Rust
word: is
word: fun
```

The `+` operator deserves a closer look. `first + "-"` takes ownership of `first`, appends to it, and gives back the result, so `first` can't be used afterwards. The right-hand side must be a `&str`, which is why `second` is written `&second`. When you join more than two pieces, `format!` is usually clearer, and it doesn't move anything.

:::tip Owned or borrowed result?
Methods such as `trim` and the pieces from `split_whitespace` return `&str` slices into the original text, which is cheap. Methods that must produce different text, such as `replace` and `to_uppercase`, return a new `String`.
:::

:::rosalind HAMM Counting Point Mutations
**The biology.** When DNA is copied, mistakes occasionally happen: one letter is swapped for another. Such a change is called a **point mutation**. Comparing two versions of the same stretch of DNA letter by letter, the number of positions where they differ is a simple measure of how far apart they have drifted. Computer scientists call this count the **Hamming distance**.

**The task.** The input is two DNA strings of the same length (up to 1000 letters), one per line. Print the number of positions at which they differ, as a single whole number. For example, `GATTACAGGCTAACGT` and `GACTACTGGCTTACGA` differ in 4 places.

Write `fn hamming(s: &str, t: &str) -> usize`. Paste the two lines of your dataset into two separate string literals, each with `.trim()`. Inside the function, `s.as_bytes()` gives you the text as a `&[u8]` slice, which you can index with `[i]` like any array slice. (Indexing the `&str` itself is not allowed, as you saw above; the bytes are fine because DNA is ASCII.)
:::solution
```rust
fn hamming(s: &str, t: &str) -> usize {
    let a = s.as_bytes(); // &[u8]: a slice of the bytes
    let b = t.as_bytes();
    let mut differences = 0;
    for i in 0..a.len() {
        if a[i] != b[i] {
            differences += 1;
        }
    }
    differences
}

fn main() {
    let s = "GATTACAGGCTAACGT".trim(); // paste the first line of your dataset
    let t = "GACTACTGGCTTACGA".trim(); // paste the second line
    println!("{}", hamming(s, t));
}
```

```text
4
```

Both parameters are borrowed: `hamming` only reads the sequences, so taking `&str` means it works equally well with literals, slices and `String`s. The `.trim()` calls matter here, because a pasted newline on just one of the strings would make the lengths differ. If they ever did differ, `b[i]` would eventually be out of bounds and the program would panic, rather than print a wrong answer.
:::

:::rosalind SUBS Finding a Motif in DNA
**The biology.** A short sequence that turns up again and again, and usually does something, is called a **motif**. For example, proteins that switch genes on recognise particular short motifs in DNA. Finding every place a motif occurs is one of the most basic jobs in bioinformatics.

**The task.** The input is two DNA strings on two lines: a longer string `s` and a shorter motif `t` (both up to 1000 letters). Print every position in `s` where `t` starts, separated by spaces. Two details matter:

- Positions are **1-based**, as biologists count: the first letter of `s` is position 1, not 0.
- Matches may **overlap**. In `CATATACGATATAT`, the motif `ATA` starts at positions 2, 4, 9 and 11, and the matches at 2 and 4 share a letter.

So for that example the output is `2 4 9 11`.

Slide a window the length of `t` along `s`: for each starting byte index `i`, compare the slice `&s[i..i + t.len()]` with `t`. Stop when the window would run past the end of `s`.
:::solution
```rust
fn main() {
    let s = "CATATACGATATAT".trim(); // paste the first line of your dataset
    let t = "ATA".trim();            // paste the second line

    let mut output = String::new();
    let mut i = 0;
    while i + t.len() <= s.len() {
        if &s[i..i + t.len()] == t {
            output.push_str(&format!("{} ", i + 1)); // 1-based position
        }
        i += 1;
    }
    println!("{}", output.trim_end());
}
```

```text
2 4 9 11
```

A few details worth a second look:

- The window moves forward by one letter at a time, not by `t.len()`, which is what makes overlapping matches count.
- The condition `i + t.len() <= s.len()` stops the loop before the slice would go past the end. The tempting `for i in 0..=s.len() - t.len()` works too, but if `t` were ever longer than `s` the subtraction would overflow, because `usize` can't go below zero.
- `format!` builds each number with a trailing space, and `trim_end()` removes the last one before printing. Slicing by byte index is safe here only because the sequences are ASCII.
:::

```quiz
? What is the type of the string literal `"hi"`?
- `String`
+ `&str`
- `char`
- `[char; 2]`
= String literals are string slices (`&str`) that point at text stored in the compiled program.

? What does `"héllo".len()` return?
- 5
+ 6
- 10
- It doesn't compile.
= `len()` counts bytes, and `é` takes two bytes in UTF-8.

? Why is `&str` usually a better parameter type than `&String`?
- `&str` is faster to copy than `&String`.
- `&String` can't be read inside a function.
+ A `&str` parameter accepts literals, slices and (through deref coercion) `&String`.
- `&str` lets the function change the text.
= A `&str` parameter is more flexible: it accepts every kind of borrowed text, while `&String` only accepts references to a `String`.

? What happens when you run `let s = String::from("é!"); let t = &s[0..1];`?
- `t` is `"é"`.
- `t` is an empty string.
- It fails to compile.
+ The program panics because byte 1 is inside the character `é`.
= String slice ranges are in bytes and must land on character boundaries. `é` occupies bytes 0 and 1, so index 1 is in the middle of it.
```
