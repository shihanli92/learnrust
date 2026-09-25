use dnakit::rosalind::solve;

#[test]
fn dna_counts_bases() {
    let answer = solve("dna", "ATGCTTCAGAAAGGTCTTACG\n").unwrap();
    assert_eq!(answer, "6 4 5 6");
}

#[test]
fn rna_and_revc() {
    let dataset = "ATGCTTCAGAAAGGTCTTACG\n";
    assert_eq!(solve("rna", dataset).unwrap(), "AUGCUUCAGAAAGGUCUUACG");
    assert_eq!(solve("revc", dataset).unwrap(), "CGTAAGACCTTTCTGAAGCAT");
}

#[test]
fn gc_picks_the_highest_record() {
    let dataset = "\
>Rosalind_1111
CCTGCGGAAGATCGGCACTAGA
ATCCCACTAAT
>Rosalind_3333
GCCGCCCAGGGCAACGAATTATGGGCG
>Rosalind_2222
CCATCGGTAGCGCATCCTTAGTCCAATTA
AGTCCC
";
    assert_eq!(solve("gc", dataset).unwrap(), "Rosalind_3333\n66.666667");
}

#[test]
fn hamm_counts_differences() {
    let dataset = "ACCGTTAGCATTGA\nACTGTAAGCTTTGA\n";
    assert_eq!(solve("hamm", dataset).unwrap(), "3");
}

#[test]
fn prot_translates_until_the_stop_codon() {
    let dataset = "AUGAAACGUUGGCAUGAGUAA\n";
    assert_eq!(solve("prot", dataset).unwrap(), "MKRWHE");
}

#[test]
fn bad_datasets_give_errors_not_panics() {
    assert!(solve("dna", "ACGU").is_err());
    assert!(solve("gc", "ACGT\n>a\nAC").is_err());
    assert!(solve("hamm", "ACGT").is_err());
    assert!(solve("hamm", "ACGT\nAC").is_err());
    assert!(solve("frob", "ACGT").is_err());
}
