use std::fmt;
use std::io;

/// Everything that can go wrong in wordstat.
#[derive(Debug)]
pub enum Error {
    /// The command-line arguments were not valid. The message says why.
    Usage(String),
    /// A file could not be read.
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
            Error::Usage(message) => {
                write!(f, "{message}\nusage: wordstat [--top N] [FILE]")
            }
            Error::Io { path, source } => write!(f, "cannot read {path}: {source}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Usage(_) => None,
            Error::Io { source, .. } => Some(source),
        }
    }
}
