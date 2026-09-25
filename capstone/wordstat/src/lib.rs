//! Simple statistics for plain text.
//!
//! `wordstat` counts lines, words and characters, and tells you which words
//! appear most often. It ships as a library you can call from your own code
//! and as a small command-line tool of the same name.
//!
//! # Examples
//!
//! ```
//! use wordstat::Stats;
//!
//! let stats = Stats::from_text("The cat sat on the mat.");
//! assert_eq!(stats.words, 6);
//! assert_eq!(stats.top_words(1), vec![("the", 2)]);
//! ```

#![warn(missing_docs)]

mod config;
mod error;
mod stats;

pub use config::Config;
pub use error::Error;
pub use stats::Stats;
