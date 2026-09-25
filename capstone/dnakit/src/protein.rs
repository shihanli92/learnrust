use crate::Error;
use crate::seq::check_bases;

/// Translates RNA into a protein, written with one-letter amino acid codes.
///
/// The RNA is read three bases (one *codon*) at a time from the start, using
/// the standard genetic code. Translation ends at the first stop codon
/// (`UAA`, `UAG` or `UGA`) or at the end of the RNA; one or two bases left
/// over at the end are ignored.
///
/// # Errors
///
/// Returns [`Error::InvalidBase`] if `rna` contains anything other than the
/// uppercase letters `A`, `C`, `G` and `U`.
///
/// # Examples
///
/// ```
/// use dnakit::translate;
///
/// assert_eq!(translate("AUGUUUCCCUAA").unwrap(), "MFP");
/// assert_eq!(translate("AUGGC").unwrap(), "M");
/// ```
pub fn translate(rna: &str) -> Result<String, Error> {
    check_bases(rna, "ACGU")?;
    let mut protein = String::new();
    for codon in rna.as_bytes().chunks_exact(3) {
        match amino_acid(codon) {
            Some(letter) => protein.push(letter),
            None => break,
        }
    }
    Ok(protein)
}

/// Looks up one codon in the standard genetic code. Returns `None` for the
/// three stop codons.
fn amino_acid(codon: &[u8]) -> Option<char> {
    let letter = match codon {
        b"UUU" | b"UUC" => 'F',
        b"UUA" | b"UUG" | b"CUU" | b"CUC" | b"CUA" | b"CUG" => 'L',
        b"AUU" | b"AUC" | b"AUA" => 'I',
        b"AUG" => 'M',
        b"GUU" | b"GUC" | b"GUA" | b"GUG" => 'V',
        b"UCU" | b"UCC" | b"UCA" | b"UCG" | b"AGU" | b"AGC" => 'S',
        b"CCU" | b"CCC" | b"CCA" | b"CCG" => 'P',
        b"ACU" | b"ACC" | b"ACA" | b"ACG" => 'T',
        b"GCU" | b"GCC" | b"GCA" | b"GCG" => 'A',
        b"UAU" | b"UAC" => 'Y',
        b"CAU" | b"CAC" => 'H',
        b"CAA" | b"CAG" => 'Q',
        b"AAU" | b"AAC" => 'N',
        b"AAA" | b"AAG" => 'K',
        b"GAU" | b"GAC" => 'D',
        b"GAA" | b"GAG" => 'E',
        b"UGU" | b"UGC" => 'C',
        b"UGG" => 'W',
        b"CGU" | b"CGC" | b"CGA" | b"CGG" | b"AGA" | b"AGG" => 'R',
        b"GGU" | b"GGC" | b"GGA" | b"GGG" => 'G',
        _ => return None,
    };
    Some(letter)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exactly_three_of_the_64_codons_are_stops() {
        let bases = [b'A', b'C', b'G', b'U'];
        let mut stops = Vec::new();
        for first in bases {
            for second in bases {
                for third in bases {
                    let codon = [first, second, third];
                    if amino_acid(&codon).is_none() {
                        stops.push(String::from_utf8(codon.to_vec()).unwrap());
                    }
                }
            }
        }
        assert_eq!(stops, ["UAA", "UAG", "UGA"]);
    }

    #[test]
    fn stops_at_the_first_stop_codon() {
        assert_eq!(translate("AUGUGAUUU").unwrap(), "M");
    }

    #[test]
    fn empty_rna_gives_empty_protein() {
        assert_eq!(translate("").unwrap(), "");
    }

    #[test]
    fn dna_is_not_rna() {
        assert!(matches!(
            translate("AUGTTT"),
            Err(Error::InvalidBase {
                position: 4,
                found: 'T'
            })
        ));
    }
}
