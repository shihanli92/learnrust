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

:::exercise Longest line
Write `fn longest_line<'a>(text: &'a str) -> &'a str` that returns the longest line in `text` (use `text.lines()`, and return the first one on ties). Then remove the `'a` annotations and confirm it still compiles, thanks to elision rule 2.
:::solution
```rust
fn longest_line(text: &str) -> &str {
    let mut best = "";
    for line in text.lines() {
        if line.len() > best.len() {
            best = line;
        }
    }
    best
}

fn main() {
    let poem = String::from("roses are red\nviolets are blue\nlifetimes are fine");
    println!("{}", longest_line(&poem));
}
```

```text
lifetimes are fine
```

One input reference means the output must borrow from it, so no annotation is needed.
:::

:::exercise A borrowing tokenizer
Write a struct `Words<'a> { text: &'a str }` with a method `fn longer_than(&self, n: usize) -> Vec<&'a str>` that returns every whitespace-separated word longer than `n` characters. Using `&'a str` (not just `&str`) in the return type says the words borrow from the original text, not from the `Words` struct itself. Show that the result can outlive the `Words` value.
:::solution
```rust
struct Words<'a> {
    text: &'a str,
}

impl<'a> Words<'a> {
    fn longer_than(&self, n: usize) -> Vec<&'a str> {
        let mut out = Vec::new();
        for w in self.text.split_whitespace() {
            if w.len() > n {
                out.push(w);
            }
        }
        out
    }
}

fn main() {
    let text = String::from("borrow checker keeps references valid");
    let long;
    {
        let words = Words { text: &text };
        long = words.longer_than(6);
    } // `words` is dropped here, but `long` borrows from `text`
    println!("{long:?}");
}
```

```text
["checker", "references"]
```
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
