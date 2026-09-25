use std::fs;
use std::io::{self, Read};
use std::process;

use wordstat::{Config, Error, Stats};

fn main() {
    if let Err(err) = run() {
        eprintln!("wordstat: {err}");
        process::exit(1);
    }
}

fn run() -> Result<(), Error> {
    let config = Config::from_args(std::env::args().skip(1))?;
    let text = read_input(config.path.as_deref())?;
    let stats = Stats::from_text(&text);
    print_report(&stats, config.top);
    Ok(())
}

/// Reads the whole file, or all of standard input if there is no path.
fn read_input(path: Option<&str>) -> Result<String, Error> {
    match path {
        Some(path) => fs::read_to_string(path).map_err(|source| Error::Io {
            path: path.to_string(),
            source,
        }),
        None => {
            let mut text = String::new();
            io::stdin()
                .read_to_string(&mut text)
                .map_err(|source| Error::Io {
                    path: "standard input".to_string(),
                    source,
                })?;
            Ok(text)
        }
    }
}

fn print_report(stats: &Stats, top: usize) {
    println!("lines:  {}", stats.lines);
    println!("words:  {}", stats.words);
    println!("chars:  {}", stats.chars);
    println!("unique: {}", stats.unique_words());
    if let Some(average) = stats.average_word_length() {
        println!("average word length: {average:.2}");
    }

    let top_words = stats.top_words(top);
    if !top_words.is_empty() {
        println!("most frequent:");
        for (word, count) in top_words {
            println!("{count:>6}  {word}");
        }
    }
}
