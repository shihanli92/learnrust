use std::fs;
use std::process;

use dnakit::{Error, rosalind};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [problem, path] = args.as_slice() else {
        eprintln!("usage: dnakit <problem> <dataset-file>");
        eprintln!("problems: {}", rosalind::PROBLEMS.join(", "));
        process::exit(2);
    };

    match run(problem, path) {
        Ok(answer) => println!("{answer}"),
        Err(err) => {
            eprintln!("dnakit: {err}");
            process::exit(1);
        }
    }
}

fn run(problem: &str, path: &str) -> Result<String, Error> {
    let dataset = fs::read_to_string(path).map_err(|source| Error::Io {
        path: path.to_string(),
        source,
    })?;
    rosalind::solve(problem, &dataset)
}
