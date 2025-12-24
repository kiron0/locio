use clap::{Parser, ValueEnum};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(
    name = "locio",
    about = "A powerful CLI tool to count lines and files in directories",
    long_about = "Count lines and files in directories with extensive filtering and exclusion options. Supports patterns, extensions, directories, and more."
)]
pub struct Args {
    #[arg(default_value = ".")]
    pub directory: PathBuf,

    #[arg(short = 'f', long = "files-only")]
    pub files_only: bool,

    #[arg(short = 'l', long = "lines-only")]
    pub lines_only: bool,

    #[arg(short = 'e', long = "exclude", value_name = "PATTERN")]
    pub exclude_patterns: Vec<String>,

    #[arg(long = "exclude-ext", value_name = "EXTENSIONS")]
    pub exclude_extensions: Vec<String>,

    #[arg(long = "include-ext", value_name = "EXTENSIONS")]
    pub include_extensions: Vec<String>,

    #[arg(long = "exclude-dir", value_name = "PATTERN")]
    pub exclude_dirs: Vec<String>,

    #[arg(long = "include-dir", value_name = "PATTERN")]
    pub include_dirs: Vec<String>,

    #[arg(long = "exclude-name", value_name = "PATTERN")]
    pub exclude_names: Vec<String>,

    #[arg(long = "include-name", value_name = "PATTERN")]
    pub include_names: Vec<String>,

    #[arg(long = "max-size", value_name = "SIZE")]
    pub max_size: Option<String>,

    #[arg(long = "min-size", value_name = "SIZE")]
    pub min_size: Option<String>,

    #[arg(long = "no-hidden")]
    pub no_hidden: bool,

    #[arg(long = "no-empty")]
    pub no_empty: bool,

    #[arg(long = "follow-links")]
    pub follow_links: bool,

    #[arg(long = "max-depth", value_name = "DEPTH")]
    pub max_depth: Option<usize>,

    #[arg(short = 'o', long = "output", value_enum, default_value = "human")]
    pub output_format: OutputFormat,

    #[arg(long = "stats")]
    pub show_stats: bool,

    #[arg(short = 'p', long = "progress")]
    pub show_progress: bool,

    #[arg(long = "include-blank")]
    pub include_blank: bool,

    #[arg(long = "no-binary")]
    pub no_binary: bool,

    #[arg(short = 'i', long = "ignore-case")]
    pub ignore_case: bool,

    #[arg(short = 'q', long = "quiet")]
    pub quiet: bool,

    #[arg(long = "version")]
    pub version: bool,
}

#[derive(Debug, Clone, ValueEnum)]
pub enum OutputFormat {
    Human,
    Json,
    Csv,
    Tsv,
}
