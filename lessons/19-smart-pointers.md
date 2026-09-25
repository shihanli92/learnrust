---
title: Smart Pointers
module: Abstraction
summary: Put data on the heap with Box, clean up with Drop, and share or mutate data in ways plain references can't with Rc and RefCell.
minutes: 40
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

:::rosalind TRIE Introduction to Pattern Matching
Searching a genome for thousands of short patterns one at a time is slow. A **trie** (from re*trie*val, usually pronounced "try") stores all the patterns in one tree, so the search can check them together. Each edge is labelled with one base, and each pattern is spelled out by a path from the root. Patterns that start the same way share the start of their path: `GATTC` and `GATA` share the edges for `G`, `A` and `T`, then split.

The dataset has up to 100 DNA strings, one per line, each up to 100 bases long, and none is a prefix of another. Build their trie and print its **adjacency list**: one line `parent child symbol` for every edge. The root must be node 1; the other nodes can be numbered 2, 3, 4, ... in any order, and the lines can come in any order. Numbering nodes in the order you create them is the natural choice.

A trie is a recursive type, so it needs a `Box`:

```rust,ignore
struct Node {
    label: usize,
    children: [Option<Box<Node>>; 4], // one slot each for A, C, G, T
}
```

Without the `Box`, a `Node` would contain four more `Node`s inline, each containing four more, and so on: the same infinite-size error as the `List` above.

To insert a string, start with a `&mut Node` pointing at the root and walk down one base at a time. If the slot for the base is `None`, fill it with a new boxed node (with the next label). Then move your `&mut` down into the child with `node.children[i].as_mut().unwrap()`. To print, write a recursive function that prints each edge from a node and then recurses into the child. For this sample:

```text
GATTC
GACA
TAGC
GATA
```

one correct output is:

```text
1 2 G
2 3 A
3 7 C
7 8 A
3 4 T
4 13 A
4 5 T
5 6 C
1 9 T
9 10 A
10 11 G
11 12 C
```
:::solution
```rust
use std::error::Error;

const BASES: [char; 4] = ['A', 'C', 'G', 'T'];

struct Node {
    label: usize,
    // One slot per base, in the order of BASES. Each child is owned through a Box.
    children: [Option<Box<Node>>; 4],
}

impl Node {
    fn new(label: usize) -> Self {
        Node { label, children: [None, None, None, None] }
    }
}

fn base_index(base: char) -> Option<usize> {
    BASES.iter().position(|&b| b == base)
}

struct Trie {
    root: Node,
    node_count: usize,
}

impl Trie {
    fn new() -> Self {
        Trie { root: Node::new(1), node_count: 1 }
    }

    fn insert(&mut self, word: &str) -> Result<(), String> {
        let mut node = &mut self.root;
        for base in word.chars() {
            let i = base_index(base).ok_or(format!("not a DNA base: {base:?}"))?;
            if node.children[i].is_none() {
                self.node_count += 1;
                node.children[i] = Some(Box::new(Node::new(self.node_count)));
            }
            // Step down into the child. `as_mut` gives an Option<&mut Box<Node>>,
            // and `unwrap` is safe because the slot was filled just above.
            node = node.children[i].as_mut().unwrap();
        }
        Ok(())
    }
}

/// Walks the tree depth-first, printing one `parent child symbol` line per edge.
fn print_edges(node: &Node) {
    for (i, slot) in node.children.iter().enumerate() {
        if let Some(child) = slot {
            println!("{} {} {}", node.label, child.label, BASES[i]);
            print_edges(child);
        }
    }
}

const SAMPLE: &str = "GATTC
GACA
TAGC
GATA
";

fn main() -> Result<(), Box<dyn Error>> {
    let input = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)?,
        None => SAMPLE.to_string(),
    };
    let mut trie = Trie::new();
    for line in input.lines() {
        let word = line.trim();
        if !word.is_empty() {
            trie.insert(word)?;
        }
    }
    print_edges(&trie.root);
    Ok(())
}
```

```text
1 2 G
2 3 A
3 7 C
7 8 A
3 4 T
4 13 A
4 5 T
5 6 C
1 9 T
9 10 A
10 11 G
11 12 C
```

Node 13 is the `A` of `GATA`, created last but printed early, because the printer walks the tree depth-first and visits children in A, C, G, T order. Rosalind accepts that. `self.node_count += 1` is allowed while `node` mutably borrows `self.root` because the compiler tracks the two fields separately. When the `Trie` is dropped, each `Box` drops its node, which drops its children, so the whole tree is freed with no cleanup code.

There is a popular alternative: an **arena**. Keep every node in one `Vec` and store children as indexes into it instead of boxes:

```rust
const BASES: [char; 4] = ['A', 'C', 'G', 'T'];

/// Every node lives in one Vec, and children are indexes into it.
/// Node number = index + 1, so the root (index 0) is node 1.
struct Trie {
    children: Vec<[Option<usize>; 4]>,
}

impl Trie {
    fn insert(&mut self, word: &str) {
        let mut node = 0;
        for base in word.chars() {
            let i = BASES.iter().position(|&b| b == base).expect("not a DNA base");
            node = match self.children[node][i] {
                Some(child) => child,
                None => {
                    let child = self.children.len();
                    self.children.push([None; 4]);
                    self.children[node][i] = Some(child);
                    println!("{} {} {}", node + 1, child + 1, base); // print each edge as it's created
                    child
                }
            };
        }
    }
}

fn main() {
    let mut trie = Trie { children: vec![[None; 4]] }; // just the root
    for word in ["GATTC", "GACA", "TAGC", "GATA"] {
        trie.insert(word);
    }
}
```

```text
1 2 G
2 3 A
3 4 T
4 5 T
5 6 C
3 7 C
7 8 A
1 9 T
9 10 A
10 11 G
11 12 C
4 13 A
```

Walking down is now just `node = child`, a number, so there are no `&mut` references to juggle, node numbers come for free, and all the nodes sit together in memory with a single growing allocation. The price is that the compiler no longer checks that an index points at a real node, and removing nodes gets awkward. Boxes model "this node owns its children" directly and suit trees that change shape; arenas suit trees that only ever grow, like this one, and graphs where a node can have several parents.
:::

:::exercise A shared base tally
A sequencing machine reads DNA on several **lanes** at once, and you want one running count of A, C, G and T across all of them (the counts from the DNA problem, but for the whole run). Write:

```rust,ignore
struct Lane {
    name: String,
    tally: Rc<RefCell<[u64; 4]>>,
}
```

with a method `fn read(&self, dna: &str)` that adds the bases of `dna` to the shared tally and prints how many bases the lane read. Make two lanes sharing one tally, have them read a few strings, then print the four totals separated by spaces and the tally's `Rc::strong_count`.

Writing `Rc<RefCell<[u64; 4]>>` everywhere is noisy. A **type alias** gives it a short name: `type Tally = Rc<RefCell<[u64; 4]>>;`. It's just another name for the same type.
:::solution
```rust
use std::cell::RefCell;
use std::rc::Rc;

/// Counts of A, C, G and T, shared by every lane.
type Tally = Rc<RefCell<[u64; 4]>>;

struct Lane {
    name: String,
    tally: Tally,
}

impl Lane {
    fn read(&self, dna: &str) {
        let mut counts = self.tally.borrow_mut();
        for base in dna.chars() {
            match base {
                'A' => counts[0] += 1,
                'C' => counts[1] += 1,
                'G' => counts[2] += 1,
                'T' => counts[3] += 1,
                _ => {}
            }
        }
        println!("{} read {} bases", self.name, dna.len());
    }
}

fn main() {
    let tally: Tally = Rc::new(RefCell::new([0; 4]));
    let lane1 = Lane { name: String::from("lane 1"), tally: Rc::clone(&tally) };
    let lane2 = Lane { name: String::from("lane 2"), tally: Rc::clone(&tally) };

    lane1.read("GATTACA");
    lane2.read("CCGGTA");
    lane1.read("TTAG");

    let counts = tally.borrow();
    println!("{} {} {} {}", counts[0], counts[1], counts[2], counts[3]);
    println!("owners: {}", Rc::strong_count(&tally));
}
```

```text
lane 1 read 7 bases
lane 2 read 6 bases
lane 1 read 4 bases
5 3 4 5
owners: 3
```

`read` takes `&self` yet changes the counts: that's interior mutability through the `RefCell`. The `borrow_mut()` guard lives until the end of `read`, so no other borrow of the tally may happen during the call; here none does. The owner count is 3 because `main` still holds `tally`, alongside the clone in each lane.
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
