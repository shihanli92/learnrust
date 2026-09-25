use crate::Error;

/// Options for one run of the `wordstat` command-line tool.
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// The file to read, or `None` to read standard input.
    pub path: Option<String>,
    /// How many of the most frequent words to show.
    pub top: usize,
}

impl Config {
    /// The number of top words shown when `--top` is not given.
    pub const DEFAULT_TOP: usize = 5;

    /// Builds a `Config` from command-line arguments, not including the
    /// program name.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Usage`] if an option is unknown, if `--top` is not
    /// followed by a number, or if more than one file is given.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Config;
    ///
    /// let args = ["--top", "3", "notes.txt"].map(String::from);
    /// let config = Config::from_args(args).unwrap();
    /// assert_eq!(config.top, 3);
    /// assert_eq!(config.path.as_deref(), Some("notes.txt"));
    /// ```
    pub fn from_args<I>(args: I) -> Result<Config, Error>
    where
        I: IntoIterator<Item = String>,
    {
        let mut path = None;
        let mut top = Config::DEFAULT_TOP;
        let mut args = args.into_iter();

        while let Some(arg) = args.next() {
            if arg == "--top" {
                let value = args
                    .next()
                    .ok_or_else(|| Error::Usage("--top needs a number".to_string()))?;
                top = value
                    .parse()
                    .map_err(|_| Error::Usage(format!("not a number: {value}")))?;
            } else if arg.starts_with('-') {
                return Err(Error::Usage(format!("unknown option: {arg}")));
            } else if path.is_none() {
                path = Some(arg);
            } else {
                return Err(Error::Usage("give at most one file".to_string()));
            }
        }

        Ok(Config { path, top })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn defaults_when_no_arguments() {
        let config = Config::from_args(args(&[])).unwrap();
        assert_eq!(config.path, None);
        assert_eq!(config.top, Config::DEFAULT_TOP);
    }

    #[test]
    fn reads_top_and_path_in_any_order() {
        let config = Config::from_args(args(&["poem.txt", "--top", "2"])).unwrap();
        assert_eq!(config.path.as_deref(), Some("poem.txt"));
        assert_eq!(config.top, 2);
    }

    #[test]
    fn rejects_bad_arguments() {
        for bad in [
            args(&["--top"]),
            args(&["--top", "many"]),
            args(&["--verbose"]),
            args(&["a.txt", "b.txt"]),
        ] {
            let result = Config::from_args(bad);
            assert!(matches!(result, Err(Error::Usage(_))), "{result:?}");
        }
    }
}
