//! Small, dependency-free tools for DNA, RNA and protein sequences.
//!
//! `dnakit` reads FASTA files, counts bases, measures GC content, transcribes
//! DNA into RNA, builds reverse complements and translates RNA into protein.
//! It ships as a library you can call from your own code and as a
//! command-line tool of the same name that solves
//! [Rosalind](https://rosalind.info) problems.
//!
//! # Examples
//!
//! ```
//! use dnakit::{fasta, gc_content, reverse_complement, transcribe, translate};
//!
//! # fn main() -> Result<(), dnakit::Error> {
//! let records = fasta::parse(">demo\nATGGC\nCTGAA\n")?;
//! let dna = &records[0].seq;
//! assert_eq!(dna, "ATGGCCTGAA");
//! assert_eq!(gc_content(dna)?, 50.0);
//! assert_eq!(reverse_complement(dna)?, "TTCAGGCCAT");
//! assert_eq!(translate(&transcribe(dna)?)?, "MA");
//! # Ok(())
//! # }
//! ```

#![warn(missing_docs)]

mod error;
pub mod fasta;
mod protein;
pub mod rosalind;
mod seq;

pub use error::Error;
pub use protein::translate;
pub use seq::{BaseCounts, count_bases, gc_content, hamming, reverse_complement, transcribe};
