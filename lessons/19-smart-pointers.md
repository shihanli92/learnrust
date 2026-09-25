---
title: Smart Pointers
module: Abstraction
summary: Put data on the heap with Box, clean up with Drop, and share or mutate data in ways plain references can't with Rc and RefCell.
minutes: 35
---

A **pointer** is a value that holds the address of some other data. You already use the simplest kind all the time: references, `&T` and `&mut T`. They borrow data and do nothing else.

A **smart pointer** is a struct that acts like a pointer but also *owns* the data it points to and adds some behaviour on top. You have met two already without the name: `String` and `Vec<T>` own a heap buffer and free it when they go out of scope. This lesson covers the smart pointers you will build with directly. You will use `Box` often. `Rc` and `RefCell` are for the occasional situation where Rust's normal single-owner rules are too strict.

## Box: a value on the heap

`Box<T>` stores a value on the heap. The box itself is just a pointer-sized value on the stack, and when the box goes out of scope, the heap value is freed too.

```rust
fn main() {
    let b = Box::new(5);
    println!("b = {b}");
    println!("b + 1 = {}", *b + 1);
}
```

```text
b = 5
b + 1 = 6
```

Boxing a single number is pointless, of course. Boxes earn their keep in three situations:

- **Recursive types**, where a type contains itself. This is the main one, covered next.
- **Large values** that you want to move around cheaply: moving a box copies only the pointer, not the data.
- **Trait objects**, such as `Box<dyn Shape>`, when you want to store values of different types that implement the same trait, for example in one `Vec<Box<dyn Shape>>`.

### Recursive types

Suppose you want a linked list where each element holds a number and the rest of the list. The obvious definition doesn't compile:

```rust,compile_fail
enum List {
    Cons(i32, List),
    Nil,
}
```

```text
error[E0072]: recursive type `List` has infinite size
 --> src/lib.rs:1:1
  |
1 | enum List {
  | ^^^^^^^^^
2 |     Cons(i32, List),
  |               ---- recursive without indirection
  |
help: insert some indirection (e.g., a `Box`, `Rc`, or `&`) to break the cycle
  |
2 |     Cons(i32, Box<List>),
  |               ++++    +
```

To lay out a value, the compiler needs to know its size. A `List` contains a `List`, which contains a `List`, and so on forever. A `Box<List>`, on the other hand, is always one pointer wide, no matter how long the list is. That breaks the infinite loop, just as the compiler suggests.

Trees are recursive too. Here is a small binary search tree where each node owns its children through a `Box`:

```rust
#[derive(Debug)]
enum Tree {
    Leaf,
    Node(Box<Tree>, i32, Box<Tree>),
}

impl Tree {
    fn insert(self, value: i32) -> Tree {
        match self {
            Tree::Leaf => Tree::Node(Box::new(Tree::Leaf), value, Box::new(Tree::Leaf)),
            Tree::Node(left, v, right) => {
                if value < v {
                    Tree::Node(Box::new(left.insert(value)), v, right)
                } else {
                    Tree::Node(left, v, Box::new(right.insert(value)))
                }
            }
        }
    }

    fn sum(&self) -> i32 {
        match self {
            Tree::Leaf => 0,
            Tree::Node(left, v, right) => left.sum() + v + right.sum(),
        }
    }

    fn in_order(&self, out: &mut Vec<i32>) {
        if let Tree::Node(left, v, right) = self {
            left.in_order(out);
            out.push(*v);
            right.in_order(out);
        }
    }
}

fn main() {
    let mut tree = Tree::Leaf;
    for n in [5, 2, 8, 1, 9, 3] {
        tree = tree.insert(n);
    }
    let mut sorted = Vec::new();
    tree.in_order(&mut sorted);
    println!("sorted: {sorted:?}");
    println!("sum: {}", tree.sum());
}
```

```text
sorted: [1, 2, 3, 5, 8, 9]
sum: 28
```

Notice that `left.insert(value)` works even though `left` is a `Box<Tree>` and `insert` is defined on `Tree`. That is the next topic.

## Deref: using a box like the value inside

A smart pointer implements the `Deref` trait, which tells Rust how to get from the pointer to the value it points at. That is what makes `*b` work. It also enables **deref coercion**: when you pass `&Box<T>` where a `&T` is expected, or call a method, Rust inserts the dereferences for you.

```rust
fn shout(s: &str) {
    println!("{}!", s.to_uppercase());
}

fn main() {
    let boxed = Box::new(String::from("hello"));
    shout(&boxed); // &Box<String> -> &String -> &str
    println!("length {}", boxed.len());
}
```

```text
HELLO!
length 5
```

This is the same mechanism that lets you pass a `&String` to a function that takes `&str`. You rarely implement `Deref` yourself, but knowing it exists explains why smart pointers feel so transparent.

## Drop: cleanup code

The `Drop` trait lets you run code when a value goes out of scope. Smart pointers use it to free memory. Files use it to close themselves. You can implement it for your own types:

```rust
struct Noisy {
    name: &'static str,
}

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("dropping {}", self.name);
    }
}

fn main() {
    let _a = Noisy { name: "a" };
    let b = Noisy { name: "b" };
    let _c = Noisy { name: "c" };
    println!("end of main is near");
    drop(b); // drop early with std::mem::drop
    println!("b is gone");
}
```

```text
end of main is near
dropping b
b is gone
dropping c
dropping a
```

Values are dropped in the reverse order they were created. You are not allowed to call `b.drop()` yourself, since Rust would then drop it a second time at the end of the scope. To get rid of a value early, call the `drop` function (from `std::mem`, available everywhere). It simply takes ownership of the value and lets it go out of scope.

## Rc: shared ownership

Normally every value has exactly one owner. Sometimes that doesn't match the problem: several parts of your program need the same data, and none of them is clearly the one that should free it. `Rc<T>` (reference counted) solves this. It keeps a count of how many owners exist and frees the data when the last one goes away.

```rust
use std::rc::Rc;

#[derive(Debug)]
struct Config {
    theme: String,
}

struct Window {
    title: String,
    config: Rc<Config>,
}

fn main() {
    let config = Rc::new(Config { theme: String::from("dark") });
    println!("owners: {}", Rc::strong_count(&config));

    let editor = Window { title: String::from("editor"), config: Rc::clone(&config) };
    let terminal = Window { title: String::from("terminal"), config: Rc::clone(&config) };
    println!("owners: {}", Rc::strong_count(&config));

    for w in [&editor, &terminal] {
        println!("{} uses the {} theme", w.title, w.config.theme);
    }

    drop(editor);
    println!("owners: {}", Rc::strong_count(&config));
}
```

```text
owners: 1
owners: 3
editor uses the dark theme
terminal uses the dark theme
owners: 2
```

`Rc::clone(&config)` does *not* copy the `Config`. It creates another pointer to the same data and bumps the count, which is cheap. You could write `config.clone()` and get the same result, but the `Rc::clone` spelling is the convention because it makes it obvious that no deep copy happens.

Two limits to remember:

- `Rc` gives you only shared (`&`) access. You can't mutate the data through it, because other owners might be reading it.
- `Rc` is for a single thread. The compiler won't let you send one to another thread.

## RefCell: borrow checking at run time

The borrow rules say you can have many `&T` *or* one `&mut T`. Usually the compiler proves this at compile time. Occasionally you know your code is fine but the compiler can't see it, or, as with `Rc`, you only have shared access but still need to change something.

`RefCell<T>` moves the borrow check from compile time to run time. This is called **interior mutability**: you can mutate the inside of a `RefCell` even through a shared reference.

```rust
use std::cell::RefCell;

fn main() {
    let visits = RefCell::new(vec![String::from("home")]);

    visits.borrow_mut().push(String::from("about"));
    visits.borrow_mut().push(String::from("contact"));

    let pages = visits.borrow();
    println!("{} pages: {:?}", pages.len(), *pages);
}
```

```text
3 pages: ["home", "about", "contact"]
```

`borrow()` returns a guard that acts like `&T`, and `borrow_mut()` one that acts like `&mut T`. The `RefCell` counts the guards that are alive. The rules are the same as always, but breaking them is no longer a compile error. It is a **panic**:

```rust,should_panic
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(5);
    let first = cell.borrow_mut();
    let second = cell.borrow_mut(); // a second mutable borrow while `first` is alive
    println!("{first} {second}");
}
```

```text
thread 'main' panicked at src/main.rs:6:23:
RefCell already borrowed
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

So `RefCell` trades a compile-time guarantee for a run-time check. Keep the guards short-lived (use them in a single expression, as in the `push` lines above) and you will rarely hit this. If you'd rather handle the conflict than panic, `try_borrow_mut()` returns a `Result` instead.

## Rc and RefCell together

`Rc` gives you several owners but no mutation. `RefCell` gives you mutation through a shared reference. Combine them, `Rc<RefCell<T>>`, and you get data with several owners, any of which can change it.

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Account {
    balance: i64,
}

struct Card {
    holder: String,
    account: Rc<RefCell<Account>>,
}

impl Card {
    fn pay(&self, amount: i64) {
        self.account.borrow_mut().balance -= amount;
        println!("{} paid {amount}", self.holder);
    }
}

fn main() {
    let shared = Rc::new(RefCell::new(Account { balance: 100 }));

    let alice = Card { holder: String::from("Alice"), account: Rc::clone(&shared) };
    let bob = Card { holder: String::from("Bob"), account: Rc::clone(&shared) };

    alice.pay(30);
    bob.pay(25);
    println!("balance left: {}", shared.borrow().balance);
}
```

```text
Alice paid 30
Bob paid 25
balance left: 45
```

Notice that `pay` takes `&self`, not `&mut self`, yet it changes the balance. That is interior mutability at work.

:::warning Reach for this last
`Rc<RefCell<T>>` is handy, but it is also a way of opting out of the checks that make Rust code easy to reason about. Before you use it, see whether passing a `&mut` down, or restructuring so that one owner holds the data, would work. Also beware of cycles: two `Rc`s that point at each other never reach a count of zero and leak memory. `std::rc::Weak` exists for back-pointers such as "child points to parent".
:::

## And for threads?

`Rc` and `RefCell` are deliberately single-threaded, which keeps them fast. Their thread-safe counterparts are `Arc<T>` (atomically reference counted) and `Mutex<T>` (a lock that hands out one `&mut` at a time), usually combined as `Arc<Mutex<T>>`. The [Fearless Concurrency chapter](https://doc.rust-lang.org/book/ch16-00-concurrency.html) of the Rust Book is the place to read about them when you need threads.

## Which one do I need?

| You want... | Use |
| --- | --- |
| A single owner, data on the heap, recursive types, trait objects | `Box<T>` |
| Several owners of read-only data, one thread | `Rc<T>` |
| To mutate through `&self`, with borrow rules checked at run time | `RefCell<T>` |
| Several owners who can all mutate, one thread | `Rc<RefCell<T>>` |
| Several owners across threads | `Arc<T>`, plus `Mutex<T>` to mutate |

:::exercise An expression tree
Define `enum Expr { Num(i64), Add(Box<Expr>, Box<Expr>), Mul(Box<Expr>, Box<Expr>) }` and write `fn eval(e: &Expr) -> i64`. Build the expression `(2 + 3) * 4` and print its value.
:::solution
```rust
enum Expr {
    Num(i64),
    Add(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
}

fn eval(e: &Expr) -> i64 {
    match e {
        Expr::Num(n) => *n,
        Expr::Add(a, b) => eval(a) + eval(b),
        Expr::Mul(a, b) => eval(a) * eval(b),
    }
}

fn main() {
    let expr = Expr::Mul(
        Box::new(Expr::Add(Box::new(Expr::Num(2)), Box::new(Expr::Num(3)))),
        Box::new(Expr::Num(4)),
    );
    println!("(2 + 3) * 4 = {}", eval(&expr)); // 20
}
```

`eval(a)` passes a `&Box<Expr>` where `&Expr` is expected. Deref coercion takes care of it.
:::

:::exercise A shared log
Create a `Rc<RefCell<Vec<String>>>` log. Write a struct `Worker { name: String, log: Rc<RefCell<Vec<String>>> }` with a method `fn work(&self)` that pushes a message like `"alice did some work"` into the log. Make two workers that share the log, call `work` on each, then print every line of the log and the final `Rc::strong_count`.
:::solution
```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Worker {
    name: String,
    log: Rc<RefCell<Vec<String>>>,
}

impl Worker {
    fn work(&self) {
        self.log.borrow_mut().push(format!("{} did some work", self.name));
    }
}

fn main() {
    let log = Rc::new(RefCell::new(Vec::new()));
    let alice = Worker { name: String::from("alice"), log: Rc::clone(&log) };
    let bob = Worker { name: String::from("bob"), log: Rc::clone(&log) };

    alice.work();
    bob.work();
    alice.work();

    for line in log.borrow().iter() {
        println!("{line}");
    }
    println!("owners: {}", Rc::strong_count(&log)); // 3
}
```
:::

```quiz
? Why does `enum List { Cons(i32, List), Nil }` fail to compile?
- Enums can't contain integers and other enums at the same time.
+ The type would have infinite size, since it contains itself directly.
- `List` is a reserved name.
- Recursive types need a lifetime annotation.
= A `Box<List>` has a fixed size (one pointer), which gives the compiler a finite layout.

? What does `Rc::clone(&data)` do?
- Makes a deep copy of the data.
+ Creates another owning pointer to the same data and increases the reference count.
- Moves the data into a new `Rc`.
- Borrows the data mutably.
= Cloning an `Rc` is cheap. The data is freed when the last `Rc` pointing to it is dropped.

? What happens if you call `borrow_mut()` on a `RefCell` while another `borrow_mut()` guard is still alive?
- The code doesn't compile.
- The second call waits until the first guard is dropped.
+ The program panics at run time.
- The second guard silently gets a copy.
= `RefCell` enforces the borrowing rules at run time. Breaking them panics, or returns an error if you use `try_borrow_mut`.

? You need several parts of a single-threaded program to own and update the same value. What fits?
- `Box<T>`
- `Rc<T>`
- `Arc<T>`
+ `Rc<RefCell<T>>`
= `Rc` provides the shared ownership and `RefCell` allows mutation through the shared pointers.
```
