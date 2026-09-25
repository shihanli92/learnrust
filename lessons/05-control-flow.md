---
title: Control Flow
module: Getting started
summary: Make decisions with if and repeat work with loop, while and for, including loops that return values and loop labels.
minutes: 40
---

A program that runs every line exactly once, top to bottom, can't do much. **Control flow** lets your code choose between paths and repeat work. Rust has one way to choose, `if`, and three ways to loop: `loop`, `while` and `for`.

Like blocks and function bodies in the previous lesson, most of these are *expressions*: they can produce a value. That makes some everyday patterns shorter and safer than in many other languages.

## if, else if and else

An `if` runs a block only when its condition is true. You can chain further conditions with `else if` and catch everything else with `else`:

```rust
fn main() {
    let temperature = 23;

    if temperature < 0 {
        println!("Freezing");
    } else if temperature < 15 {
        println!("Chilly");
    } else if temperature < 25 {
        println!("Pleasant");
    } else {
        println!("Hot");
    }
}
```

```text
Pleasant
```

Rust checks the conditions in order and runs only the first block whose condition is true. The braces are always required, even around a single line. The parentheses around the condition, as in C or JavaScript, are not needed; the compiler warns if you add them.

## Conditions must be bool

In languages such as Python, JavaScript or C, `if 3` counts as true and `if 0` as false. This is called *truthiness*. Rust has none of it: a condition must be a `bool`.

```rust,compile_fail
fn main() {
    let items_in_cart = 3;
    if items_in_cart {
        println!("You have items in your cart.");
    }
}
```

```text
error[E0308]: mismatched types
 --> src/main.rs:3:8
  |
3 |     if items_in_cart {
  |        ^^^^^^^^^^^^^ expected `bool`, found integer
```

Say what you mean instead:

```rust
fn main() {
    let items_in_cart = 3;
    if items_in_cart > 0 {
        println!("You have {items_in_cart} items in your cart.");
    }
}
```

```text
You have 3 items in your cart.
```

This rules out a whole family of bugs. Was the check meant to be "not zero", "not empty" or "not missing"? In Rust the code has to spell it out.

## if is an expression

Because `if` is an expression, you can use it on the right-hand side of `let`:

```rust
fn main() {
    let raining = true;
    let advice = if raining { "take an umbrella" } else { "wear sunglasses" };
    println!("Today you should {advice}.");

    let score = 72;
    let grade = if score >= 90 {
        'A'
    } else if score >= 70 {
        'B'
    } else {
        'C'
    };
    println!("Grade: {grade}");
}
```

```text
Today you should take an umbrella.
Grade: B
```

This replaces the `condition ? a : b` operator found in other languages. Note that there are no semicolons after `'A'`, `'B'` and `'C'`: each branch ends in an expression, and that is the value of the whole `if`.

Every branch must produce the *same type*, because `grade` can only have one type:

```rust,compile_fail
fn main() {
    let raining = true;
    let advice = if raining { "take an umbrella" } else { 0 };
}
```

```text
error[E0308]: `if` and `else` have incompatible types
 --> src/main.rs:3:59
  |
3 |     let advice = if raining { "take an umbrella" } else { 0 };
  |                               ------------------          ^ expected `&str`, found integer
  |                               |
  |                               expected because of this
```

## loop

`loop` repeats its body forever, until you stop it with `break`. `continue` skips the rest of the current pass and starts the next one.

A `loop` is also an expression: you can hand a value to `break`, and that becomes the value of the whole loop. This is useful for "keep trying until you get an answer":

```rust
fn main() {
    let mut n = 1;

    let first_big_power = loop {
        n *= 2;
        if n > 1000 {
            break n; // stop, and make `n` the loop's value
        }
    };

    println!("The first power of two above 1000 is {first_big_power}");
}
```

```text
The first power of two above 1000 is 1024
```

## while

A `while` loop checks a condition before each pass and stops as soon as it is false:

```rust
fn main() {
    let mut countdown = 3;

    while countdown > 0 {
        println!("{countdown}...");
        countdown -= 1;
    }

    println!("Liftoff!");
}
```

```text
3...
2...
1...
Liftoff!
```

Use `while` when you don't know up front how many passes you need, only when to stop.

## for

`for` is the loop you will write most often. It runs once for each item in a sequence. The simplest sequence is a **range**:

```rust
fn main() {
    for i in 1..4 {
        print!("{i} "); // print! is println! without the newline
    }
    println!();

    for i in 1..=4 {
        print!("{i} ");
    }
    println!();

    for i in (1..=4).rev() {
        print!("{i} ");
    }
    println!();
}
```

```text
1 2 3 
1 2 3 4 
4 3 2 1 
```

| Range | Contains | Name |
| --- | --- | --- |
| `1..4` | 1, 2, 3 | exclusive: stops *before* the end |
| `1..=4` | 1, 2, 3, 4 | inclusive: includes the end |
| `(1..=4).rev()` | 4, 3, 2, 1 | the same range, reversed |

The exclusive form `0..n` fits perfectly with indexes: an array of length `n` has indexes `0` to `n - 1`. Note the parentheses in `(1..=4).rev()`: without them, `.rev()` would apply to just the `4`.

### Looping over an array

You can loop over an array directly, without indexes:

```rust
fn main() {
    let codons = ["ATG", "GCC", "TAA"];

    for codon in codons {
        println!("Reading {codon}");
    }

    // Need the position too? .iter().enumerate() gives (index, item) pairs.
    for (i, codon) in codons.iter().enumerate() {
        println!("Codon {} is {codon}", i + 1);
    }
}
```

```text
Reading ATG
Reading GCC
Reading TAA
Codon 1 is ATG
Codon 2 is GCC
Codon 3 is TAA
```

Prefer this style to `for i in 0..codons.len()` followed by `codons[i]`. It is shorter, it can't go out of bounds, and it keeps working if the array changes length. You will learn much more about `.iter()` and friends in the iterators lesson.

:::tip Which loop should I use?
Reach for `for` when you are going through a sequence or a range. Use `while` when you loop until a condition changes. Use `loop` when the exit is somewhere in the middle, or when the loop needs to produce a value.
:::

## Skipping and stopping early

`break` and `continue` work in `while` and `for` loops too, not just in `loop`. `continue` jumps straight to the next pass, and `break` leaves the loop entirely:

```rust
fn main() {
    for n in 1..=20 {
        if n % 3 == 0 {
            continue; // skip multiples of 3
        }
        if n > 10 {
            break; // stop once we pass 10
        }
        print!("{n} ");
    }
    println!();
}
```

```text
1 2 4 5 7 8 10 
```

Only `loop` can hand a value to `break`. A `for` or `while` loop might finish without ever reaching a `break`, and then there would be no value to produce, so the compiler doesn't allow `break value` there.

## Loop labels

A `break` or `continue` applies to the innermost loop. When loops are nested and you want to exit an outer one, give it a **label**, which starts with a single quote:

```rust
fn main() {
    let grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    let target = 5;

    'rows: for row in 0..3 {
        for col in 0..3 {
            if grid[row][col] == target {
                println!("Found {target} at row {row}, column {col}");
                break 'rows; // leave both loops at once
            }
        }
    }
}
```

```text
Found 5 at row 1, column 1
```

Without the label, `break` would only leave the inner loop, and the outer loop would carry on searching the remaining rows.

## Putting it together: FizzBuzz

FizzBuzz is a classic small exercise. For the numbers 1 to 15, print "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for multiples of both, and the number otherwise:

```rust
fn main() {
    for n in 1..=15 {
        if n % 15 == 0 {
            println!("FizzBuzz");
        } else if n % 3 == 0 {
            println!("Fizz");
        } else if n % 5 == 0 {
            println!("Buzz");
        } else {
            println!("{n}");
        }
    }
}
```

```text
1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz
```

The order of the checks matters. If `n % 3 == 0` came first, 15 would print "Fizz", because only the first true branch runs.

## Looping over the letters of a string

One more kind of sequence is especially useful for the exercises: the characters of a string. Calling `.chars()` on a string gives you its characters one at a time, as `char` values, so a `for` loop can visit every letter of a DNA sequence:

```rust
fn main() {
    let dna = "GATTACA";
    let mut t_count = 0;

    for base in dna.chars() {
        if base == 'T' {
            t_count += 1;
        }
    }

    println!("{dna} contains {t_count} T bases");
}
```

```text
GATTACA contains 2 T bases
```

Note the single quotes in `'T'`: `base` is a `char`, so it is compared with a `char`, not with the string `"T"`. Lesson 08 explains how strings store their characters and why `.chars()` is the right way to walk through them.

:::rosalind DNA Counting DNA Nucleotides
**The biology.** DNA is written with four letters, one for each kind of nucleotide: `A`, `C`, `G` and `T`. Counting how often each one appears is often the very first thing a biologist does with a new sequence.

**The task.** The input is one DNA string (up to 1000 letters). Print four whole numbers separated by single spaces: how many times `A`, `C`, `G` and `T` occur, in that order. For example, `GATTACAGGCTAACGT` gives `5 3 4 4`.

To get the dataset into your program, open the downloaded file, copy its contents and paste them between the quotes of a string literal. The file ends with a newline, and if you paste that too it becomes part of the string. Calling `.trim()` on the string removes spaces and newlines from both ends:

```rust
fn main() {
    let dna = "GATTACAGGCTAACGT"; // paste your dataset between the quotes
    let dna = dna.trim();       // drop a pasted newline, if any
    println!("{dna} has {} letters", dna.len());
}
```

Use one `mut` counter per base and an `if` / `else if` chain inside a `for` loop over `dna.chars()`.
:::solution
```rust
fn main() {
    let dna = "GATTACAGGCTAACGT"; // paste your dataset between the quotes
    let dna = dna.trim();

    let mut a = 0;
    let mut c = 0;
    let mut g = 0;
    let mut t = 0;

    for base in dna.chars() {
        if base == 'A' {
            a += 1;
        } else if base == 'C' {
            c += 1;
        } else if base == 'G' {
            g += 1;
        } else if base == 'T' {
            t += 1;
        }
    }

    println!("{a} {c} {g} {t}");
}
```

```text
5 3 4 4
```

The last branch is `else if base == 'T'` rather than a plain `else`, so any stray character (such as a space inside the string) is ignored instead of being counted as a `T`. In lesson 11 you will meet `match`, which expresses a choice like this even more neatly.
:::

:::rosalind FIBD Mortal Fibonacci Rabbits
**The story.** This is the rabbit problem from the functions lesson, but now rabbits are mortal. Each pair lives for exactly `m` months. As before, a newborn pair takes a month to grow up, and every adult pair then produces one new pair each month (so `k` is 1). In the month a pair reaches age `m`, it has died.

**The task.** The input is two numbers, `n` (at most 100) and `m` (at most 20). You start with one newborn pair in month 1. Print the number of rabbit pairs alive after `n` months, as a single whole number. For example, `n = 10` and `m = 4` give 28.

The neat way to model this is to track how many pairs there are of each age. Keep an array where `ages[0]` is the number of newborn pairs, `ages[1]` the number of one-month-old pairs, and so on up to `ages[m - 1]`. Each month:

1. The babies born this month are all the pairs aged 1 or more, so add up `ages[1]` to `ages[m - 1]`.
2. Everyone gets one month older: move each count up one slot, starting from the top, so `ages[m - 1]` takes the old `ages[m - 2]`, and so on. The old `ages[m - 1]` is overwritten: those pairs have died.
3. Put the new babies in `ages[0]`.

After the last month, add up the whole array. An array's length is part of its type and must be known when the program is compiled, so make it 20 long (the largest `m`) and only use the first `m` slots. Array indexes are `usize`, so make `m` a `usize` too.

Use `u128` for the counts. Try `u64` first and see what happens with `n = 100` and `m = 20`.
:::solution
```rust
fn main() {
    let n = 10;        // paste n from your dataset
    let m: usize = 4;  // paste m from your dataset

    // ages[i] = number of pairs that are i months old.
    let mut ages: [u128; 20] = [0; 20];
    ages[0] = 1; // month 1: one newborn pair

    for _ in 2..=n {
        // 1. Every pair aged 1 month or more has one pair of babies.
        let mut babies = 0;
        for age in 1..m {
            babies += ages[age];
        }
        // 2. Everyone ages by a month. Go from the top down so nothing is
        //    overwritten before it has been moved. The oldest pairs fall off.
        for age in (1..m).rev() {
            ages[age] = ages[age - 1];
        }
        // 3. The babies are the new youngest group.
        ages[0] = babies;
    }

    let mut total = 0;
    for age in 0..m {
        total += ages[age];
    }
    println!("{total}");
}
```

```text
28
```

This is one of the rare cases where looping over indexes (`for age in 1..m`) is the right call: the program works with *positions* in the array, reading one slot and writing its neighbour.

**Why `u128`?** Rabbits living 20 months die so late that the numbers grow almost like the ordinary Fibonacci numbers, and after 100 months there are about 3.5 × 10²⁰ pairs. The biggest `u64` is about 1.8 × 10¹⁹, twenty times too small: in a debug build the program would panic with "attempt to add with overflow". A `u128` holds numbers up to about 3.4 × 10³⁸, plenty for this problem.
:::

```quiz
? What happens with `let n = 3; if n { println!("yes"); }`?
- It prints "yes" because 3 is non-zero.
- It prints nothing.
+ It does not compile: the condition must be a `bool`.
- It panics at run time.
= Rust has no truthiness. Write the comparison you mean, such as `if n != 0`.

? Which numbers does `for i in 2..5` produce?
+ 2, 3, 4
- 2, 3, 4, 5
- 3, 4, 5
- 5, 4, 3, 2
= `a..b` is exclusive of `b`. Use `2..=5` to include 5.

? How do you get a value out of a `loop`?
- With `return` only.
- The last expression inside the loop body.
- Loops cannot produce values.
+ Pass it to `break`, as in `break value;`.
= `break value` stops the loop and makes `value` the result of the whole `loop` expression.

? You have two nested `for` loops and want to exit both from the inner one. What do you use?
- Two `break` statements in a row.
+ A label on the outer loop and `break 'label;`.
- `continue`.
- `return` is the only option.
= A labelled `break` such as `break 'rows;` exits the loop with that label, even from inside a nested loop.
```
