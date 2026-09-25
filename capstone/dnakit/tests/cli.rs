use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output};

/// Runs the compiled `dnakit` binary with the given arguments.
fn dnakit(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_dnakit"))
        .args(args)
        .output()
        .expect("failed to run dnakit")
}

/// Writes a dataset to a file in Cargo's scratch folder for tests.
fn dataset(name: &str, contents: &str) -> PathBuf {
    let path = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(name);
    fs::write(&path, contents).unwrap();
    path
}

#[test]
fn prints_the_answer_to_stdout() {
    let path = dataset("rosalind_revc.txt", "AACGT\n");
    let output = dnakit(&["revc", path.to_str().unwrap()]);
    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "ACGTT\n");
}

#[test]
fn wrong_arguments_print_usage() {
    let output = dnakit(&["revc"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).starts_with("usage: dnakit"));
}

#[test]
fn missing_file_is_an_error() {
    let output = dnakit(&["dna", "no-such-file.txt"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.starts_with("dnakit: cannot read no-such-file.txt"));
}
