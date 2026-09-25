use std::collections::HashMap;

/// Statistics about a piece of text.
///
/// Create one with [`Stats::from_text`], then read the public fields or call
/// the methods.
#[derive(Debug, Clone, PartialEq)]
pub struct Stats {
    /// Number of lines.
    pub lines: usize,
    /// Number of words (see [`Stats::from_text`] for what counts as a word).
    pub words: usize,
    /// Number of characters, counting each Unicode `char` once.
    pub chars: usize,
    counts: HashMap<String, usize>,
}

impl Stats {
    /// Computes statistics for `text`.
    ///
    /// Words are separated by whitespace. Punctuation at the start or end of a
    /// word is ignored and case does not matter, so `"The"`, `"the,"` and
    /// `"THE"` are all the word `"the"`. A token with no letters or digits in
    /// it, such as `"--"`, is not a word.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("One fish,\ntwo fish.");
    /// assert_eq!(stats.lines, 2);
    /// assert_eq!(stats.words, 4);
    /// assert_eq!(stats.chars, 19);
    /// ```
    pub fn from_text(text: &str) -> Stats {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for word in text.split_whitespace().filter_map(normalize) {
            *counts.entry(word).or_insert(0) += 1;
        }
        Stats {
            lines: text.lines().count(),
            words: counts.values().sum(),
            chars: text.chars().count(),
            counts,
        }
    }

    /// Number of different words.
    pub fn unique_words(&self) -> usize {
        self.counts.len()
    }

    /// How many times `word` appears. Case and surrounding punctuation are
    /// ignored, just like in [`Stats::from_text`].
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("Spam, spam, SPAM and eggs");
    /// assert_eq!(stats.count("spam"), 3);
    /// assert_eq!(stats.count("ham"), 0);
    /// ```
    pub fn count(&self, word: &str) -> usize {
        normalize(word)
            .and_then(|w| self.counts.get(&w).copied())
            .unwrap_or(0)
    }

    /// Returns up to `n` of the most frequent words with their counts, most
    /// frequent first. Words with the same count are sorted alphabetically,
    /// so the result is always the same for the same text.
    ///
    /// # Examples
    ///
    /// ```
    /// use wordstat::Stats;
    ///
    /// let stats = Stats::from_text("b a b c a b");
    /// assert_eq!(stats.top_words(2), vec![("b", 3), ("a", 2)]);
    /// ```
    pub fn top_words(&self, n: usize) -> Vec<(&str, usize)> {
        let mut pairs: Vec<(&str, usize)> = self
            .counts
            .iter()
            .map(|(word, &count)| (word.as_str(), count))
            .collect();
        pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        pairs.truncate(n);
        pairs
    }

    /// Average word length in characters, or `None` if there are no words.
    pub fn average_word_length(&self) -> Option<f64> {
        if self.words == 0 {
            return None;
        }
        let total: usize = self
            .counts
            .iter()
            .map(|(word, count)| word.chars().count() * count)
            .sum();
        Some(total as f64 / self.words as f64)
    }
}

/// Lowercases a token and strips punctuation from both ends.
/// Returns `None` if nothing is left.
fn normalize(token: &str) -> Option<String> {
    let trimmed = token.trim_matches(|c: char| !c.is_alphanumeric());
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_lowercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_has_no_words() {
        let stats = Stats::from_text("");
        assert_eq!(stats.lines, 0);
        assert_eq!(stats.words, 0);
        assert_eq!(stats.chars, 0);
        assert!(stats.top_words(3).is_empty());
        assert_eq!(stats.average_word_length(), None);
    }

    #[test]
    fn normalize_strips_punctuation_and_case() {
        assert_eq!(normalize("Hello,"), Some("hello".to_string()));
        assert_eq!(normalize("\"don't\""), Some("don't".to_string()));
        assert_eq!(normalize("--"), None);
    }

    #[test]
    fn counts_lines_words_and_chars() {
        let stats = Stats::from_text("héllo world\nhello -- again\n");
        assert_eq!(stats.lines, 2);
        assert_eq!(stats.words, 4);
        assert_eq!(stats.chars, 27);
        assert_eq!(stats.unique_words(), 4);
    }

    #[test]
    fn top_words_breaks_ties_alphabetically() {
        let stats = Stats::from_text("pear apple pear fig apple");
        assert_eq!(
            stats.top_words(10),
            vec![("apple", 2), ("pear", 2), ("fig", 1)]
        );
    }

    #[test]
    fn average_word_length_uses_every_occurrence() {
        let stats = Stats::from_text("a bbb bbb");
        assert_eq!(stats.average_word_length(), Some(7.0 / 3.0));
    }
}
