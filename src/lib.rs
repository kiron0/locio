pub mod cli;
pub mod core;
pub mod scanner;
pub mod output;
pub mod utils;

pub use cli::Args;
pub use core::{LineCounterError, Result};
pub use scanner::scan_directory;
pub use output::print_output;
pub use core::Summary;
