//! Reading sequences in FASTA format.
//!
//! A FASTA file holds one or more records. Each record starts with a header
//! line beginning with `>`, followed by the sequence, which may be wrapped
//! over several lines:
//!
//! ```text
//! >Rosalind_0001
//! ACGTACGTAC
//! GGTTAA
//! >Rosalind_0002
//! TTGACA
//! ```

use crate::Error;

/// One FASTA record: an ID and its sequence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    /// The first word of the header line, without the `>`.
    pub id: String,
    /// The sequence, with all of its lines joined together.
    pub seq: String,
}

/// Parses FASTA text into a list of records, in the order they appear.
///
/// Sequence lines are joined, blank lines are skipped, and spaces at the
/// start or end of a line are ignored. Anything after the first word of a
/// header line is ignored too. Text with no records gives an empty list.
///
/// # Errors
///
/// Returns [`Error::MissingHeader`] if a sequence line comes before the
/// first header line.
///
/// # Examples
///
/// ```
/// use dnakit::fasta;
///
/// let text = ">one\nACGT\nAC\n\n>two some description\nGGG\n";
/// let records = fasta::parse(text).unwrap();
/// assert_eq!(records.len(), 2);
/// assert_eq!(records[0].id, "one");
/// assert_eq!(records[0].seq, "ACGTAC");
/// assert_eq!(records[1].id, "two");
/// ```
pub fn parse(text: &str) -> Result<Vec<Record>, Error> {
    let mut records: Vec<Record> = Vec::new();
    for (index, line) in text.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(header) = line.strip_prefix('>') {
            let id = header.split_whitespace().next().unwrap_or("");
            records.push(Record {
                id: id.to_string(),
                seq: String::new(),
            });
        } else {
            match records.last_mut() {
                Some(record) => record.seq.push_str(line),
                None => return Err(Error::MissingHeader { line: index + 1 }),
            }
        }
    }
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_wrapped_lines() {
        let records = parse(">a\nAC\nGT\n>b\nTT\n").unwrap();
        assert_eq!(
            records,
            vec![
                Record {
                    id: "a".to_string(),
                    seq: "ACGT".to_string()
                },
                Record {
                    id: "b".to_string(),
                    seq: "TT".to_string()
                },
            ]
        );
    }

    #[test]
    fn ignores_blank_lines_and_extra_spaces() {
        let records = parse("\n >a \nAC  \n\n\tGT\r\n").unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].seq, "ACGT");
    }

    #[test]
    fn empty_text_has_no_records() {
        assert!(parse("").unwrap().is_empty());
    }

    #[test]
    fn sequence_before_header_is_an_error() {
        let result = parse("\nACGT\n>a\nAC\n");
        assert!(matches!(result, Err(Error::MissingHeader { line: 2 })));
    }
}
