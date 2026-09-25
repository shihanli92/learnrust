use crate::Error;

/// How many times each base occurs in a DNA sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BaseCounts {
    /// Number of `A`s.
    pub a: usize,
    /// Number of `C`s.
    pub c: usize,
    /// Number of `G`s.
    pub g: usize,
    /// Number of `T`s.
    pub t: usize,
}

/// Checks that every character of `seq` is one of the characters in
/// `alphabet`, such as `"ACGT"` for DNA.
pub(crate) fn check_bases(seq: &str, alphabet: &str) -> Result<(), Error> {
    for (index, found) in seq.chars().enumerate() {
        if !alphabet.contains(found) {
            return Err(Error::InvalidBase {
                position: index + 1,
                found,
            });
        }
    }
    Ok(())
}

/// Counts the `A`, `C`, `G` and `T` bases in a DNA sequence.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] if `dna` contains anything other than the
/// uppercase letters `A`, `C`, `G` and `T`.
///
/// # Examples
///
/// ```
/// use dnakit::count_bases;
///
/// let counts = count_bases("GATTACA").unwrap();
/// assert_eq!((counts.a, counts.c, counts.g, counts.t), (3, 1, 1, 2));
/// ```
pub fn count_bases(dna: &str) -> Result<BaseCounts, Error> {
    check_bases(dna, "ACGT")?;
    Ok(BaseCounts {
        a: dna.matches('A').count(),
        c: dna.matches('C').count(),
        g: dna.matches('G').count(),
        t: dna.matches('T').count(),
    })
}

/// Returns the percentage (0 to 100) of bases in `dna` that are `G` or `C`.
///
/// An empty sequence has a GC content of 0.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::gc_content;
///
/// assert_eq!(gc_content("GGCA").unwrap(), 75.0);
/// ```
pub fn gc_content(dna: &str) -> Result<f64, Error> {
    let counts = count_bases(dna)?;
    if dna.is_empty() {
        return Ok(0.0);
    }
    Ok((counts.g + counts.c) as f64 * 100.0 / dna.len() as f64)
}

/// Transcribes DNA into RNA by replacing every `T` with `U`.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::transcribe;
///
/// assert_eq!(transcribe("GATTACA").unwrap(), "GAUUACA");
/// ```
pub fn transcribe(dna: &str) -> Result<String, Error> {
    check_bases(dna, "ACGT")?;
    Ok(dna.replace('T', "U"))
}

/// Returns the reverse complement of a DNA sequence: the other strand of
/// the double helix, read in its own direction.
///
/// Every base is swapped for its partner (`A` with `T`, `C` with `G`) and
/// the result is reversed.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] for anything that is not a DNA base.
///
/// # Examples
///
/// ```
/// use dnakit::reverse_complement;
///
/// assert_eq!(reverse_complement("AACG").unwrap(), "CGTT");
/// assert!(reverse_complement("AAXG").is_err());
/// ```
pub fn reverse_complement(dna: &str) -> Result<String, Error> {
    check_bases(dna, "ACGT")?;
    Ok(dna.chars().rev().map(complement).collect())
}

/// The partner of a DNA base.
fn complement(base: char) -> char {
    match base {
        'A' => 'T',
        'T' => 'A',
        'C' => 'G',
        'G' => 'C',
        _ => unreachable!("check_bases only lets A, C, G and T through"),
    }
}

/// Counts the positions at which two sequences differ (their Hamming
/// distance).
///
/// Any characters can be compared, not only DNA bases.
///
/// # Errors
///
/// Returns [`Error::LengthMismatch`] if the sequences are not equally long.
///
/// # Examples
///
/// ```
/// use dnakit::hamming;
///
/// assert_eq!(hamming("GATTACA", "GACTATA").unwrap(), 2);
/// assert!(hamming("GAT", "GATT").is_err());
/// ```
pub fn hamming(first: &str, second: &str) -> Result<usize, Error> {
    let (len1, len2) = (first.chars().count(), second.chars().count());
    if len1 != len2 {
        return Err(Error::LengthMismatch {
            first: len1,
            second: len2,
        });
    }
    Ok(first
        .chars()
        .zip(second.chars())
        .filter(|(a, b)| a != b)
        .count())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_bases_reports_the_first_bad_character() {
        assert!(check_bases("ACGT", "ACGT").is_ok());
        let result = check_bases("ACxTy", "ACGT");
        assert!(matches!(
            result,
            Err(Error::InvalidBase {
                position: 3,
                found: 'x'
            })
        ));
    }

    #[test]
    fn lowercase_is_not_a_base() {
        assert!(count_bases("acgt").is_err());
    }

    #[test]
    fn counts_every_base() {
        let counts = count_bases("AACCCGGGGT").unwrap();
        assert_eq!(
            counts,
            BaseCounts {
                a: 2,
                c: 3,
                g: 4,
                t: 1
            }
        );
    }

    #[test]
    fn gc_content_of_empty_sequence_is_zero() {
        assert_eq!(gc_content("").unwrap(), 0.0);
        assert_eq!(gc_content("ATAT").unwrap(), 0.0);
        assert_eq!(gc_content("GCGC").unwrap(), 100.0);
    }

    #[test]
    fn transcribe_only_changes_t() {
        assert_eq!(transcribe("ACGTTT").unwrap(), "ACGUUU");
    }

    #[test]
    fn reverse_complement_twice_gives_the_original() {
        let dna = "ATGCCGTAAG";
        let twice = reverse_complement(&reverse_complement(dna).unwrap()).unwrap();
        assert_eq!(twice, dna);
    }

    #[test]
    fn hamming_distance() {
        assert_eq!(hamming("", "").unwrap(), 0);
        assert_eq!(hamming("AAAA", "TTTT").unwrap(), 4);
        assert!(matches!(
            hamming("AA", "AAA"),
            Err(Error::LengthMismatch {
                first: 2,
                second: 3
            })
        ));
    }
}
