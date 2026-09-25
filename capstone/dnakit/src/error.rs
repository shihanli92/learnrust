use std::fmt;
use std::io;

use crate::rosalind::PROBLEMS;

/// Everything that can go wrong in dnakit.
#[derive(Debug)]
#[non_exhaustive]
pub enum Error {
    /// A sequence contained a character that is not allowed in it.
    InvalidBase {
        /// Where the character is, counting from 1.
        position: usize,
        /// The character that was found.
        found: char,
    },
    /// A FASTA file had sequence data before its first `>` header line.
    MissingHeader {
        /// The line number, counting from 1.
        line: usize,
    },
    /// Two sequences that must be equally long are not.
    LengthMismatch {
        /// Length of the first sequence.
        first: usize,
        /// Length of the second sequence.
        second: usize,
    },
    /// A dataset did not have the shape the problem needs. The message says
    /// what was expected.
    BadDataset(String),
    /// The command-line tool was asked to solve a problem it doesn't know.
    UnknownProblem(String),
    /// A dataset file could not be read.
    Io {
        /// The file we tried to read.
        path: String,
        /// The underlying I/O error.
        source: io::Error,
    },
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::InvalidBase { position, found } => {
                write!(f, "invalid base {found:?} at position {position}")
            }
            Error::MissingHeader { line } => {
                write!(f, "line {line}: sequence data before the first '>' header")
            }
            Error::LengthMismatch { first, second } => {
                write!(f, "sequences differ in length ({first} and {second})")
            }
            Error::BadDataset(message) => write!(f, "bad dataset: {message}"),
            Error::UnknownProblem(name) => {
                write!(f, "unknown problem {name:?} (try: {})", PROBLEMS.join(", "))
            }
            Error::Io { path, source } => write!(f, "cannot read {path}: {source}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}
