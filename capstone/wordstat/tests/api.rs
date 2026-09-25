use wordstat::{Config, Stats};

const POEM: &str = "\
Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.
Twinkle, twinkle, little star,
How I wonder what you are!
";

#[test]
fn stats_for_a_whole_poem() {
    let stats = Stats::from_text(POEM);
    assert_eq!(stats.lines, 6);
    assert_eq!(stats.words, 32);
    assert_eq!(stats.count("TWINKLE"), 4);
    assert_eq!(
        stats.top_words(3),
        vec![("twinkle", 4), ("are", 2), ("how", 2)]
    );
}

#[test]
fn config_controls_how_many_words_are_listed() {
    let args = ["--top", "1"].map(String::from);
    let config = Config::from_args(args).unwrap();
    let stats = Stats::from_text(POEM);
    assert_eq!(stats.top_words(config.top), vec![("twinkle", 4)]);
}
