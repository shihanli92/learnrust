//! Solve [Rosalind](https://rosalind.info) problems from their datasets.
//!
//! Each Rosalind problem has a short ID, such as `revc`. [`solve`] takes the
//! ID and the text of a downloaded dataset, and returns the answer in the
//! exact format Rosalind expects.

use crate::{
    Error, count_bases, fasta, gc_content, hamming, reverse_complement, transcribe, translate,
};

/// The problem IDs that [`solve`] understands.
pub const PROBLEMS: [&str; 6] = ["dna", "rna", "revc", "gc", "hamm", "prot"];

/// Solves one Rosalind problem.
///
/// `problem` is a problem ID from [`PROBLEMS`] (upper or lower case) and
/// `dataset` is the text of the dataset file. The answer has no trailing
/// newline.
///
/// # Errors
///
/// Returns [`Error::UnknownProblem`] for an ID not in [`PROBLEMS`], and
/// any error from the library functions if the dataset is not valid.
///
/// # Examples
///
/// ```
/// use dnakit::rosalind;
///
/// assert_eq!(rosalind::solve("dna", "GATTACA\n").unwrap(), "3 1 1 2");
/// assert_eq!(rosalind::solve("REVC", "AACG\n").unwrap(), "CGTT");
/// ```
pub fn solve(problem: &str, dataset: &str) -> Result<String, Error> {
    let text = dataset.trim();
    match problem.to_ascii_lowercase().as_str() {
        "dna" => {
            let counts = count_bases(text)?;
            Ok(format!(
                "{} {} {} {}",
                counts.a, counts.c, counts.g, counts.t
            ))
        }
        "rna" => transcribe(text),
        "revc" => reverse_complement(text),
        "gc" => highest_gc(text),
        "hamm" => {
            let (first, second) = two_lines(text)?;
            Ok(hamming(first, second)?.to_string())
        }
        "prot" => translate(text),
        _ => Err(Error::UnknownProblem(problem.to_string())),
    }
}

/// GC: the ID of the FASTA record with the highest GC content, then that
/// GC content on the next line.
fn highest_gc(dataset: &str) -> Result<String, Error> {
    let records = fasta::parse(dataset)?;
    let mut best: Option<(&str, f64)> = None;
    for record in &records {
        let gc = gc_content(&record.seq)?;
        match best {
            Some((_, top)) if top >= gc => {}
            _ => best = Some((&record.id, gc)),
        }
    }
    match best {
        Some((id, gc)) => Ok(format!("{id}\n{gc:.6}")),
        None => Err(Error::BadDataset("no FASTA records found".to_string())),
    }
}

/// Splits a dataset into exactly two non-empty lines.
fn two_lines(dataset: &str) -> Result<(&str, &str), Error> {
    let mut lines = dataset.lines().map(str::trim).filter(|l| !l.is_empty());
    match (lines.next(), lines.next(), lines.next()) {
        (Some(first), Some(second), None) => Ok((first, second)),
        _ => Err(Error::BadDataset("expected exactly two lines".to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_listed_problem_is_known() {
        for problem in PROBLEMS {
            let result = solve(problem, "");
            assert!(
                !matches!(result, Err(Error::UnknownProblem(_))),
                "{problem} is listed but not handled"
            );
        }
    }

    #[test]
    fn unknown_problem() {
        assert!(matches!(
            solve("fib", "5 3"),
            Err(Error::UnknownProblem(name)) if name == "fib"
        ));
    }

    #[test]
    fn highest_gc_keeps_the_first_of_equal_records() {
        let dataset = ">a\nGGAA\n>b\nCCTT\n>c\nAAAT\n";
        assert_eq!(highest_gc(dataset).unwrap(), "a\n50.000000");
    }

    #[test]
    fn two_lines_ignores_blank_lines() {
        assert_eq!(two_lines("AC\n\nGT\n").unwrap(), ("AC", "GT"));
        assert!(two_lines("AC").is_err());
        assert!(two_lines("AC\nGT\nTT").is_err());
    }
}
