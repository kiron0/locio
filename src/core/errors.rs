use thiserror::Error;

#[derive(Error, Debug)]
pub enum LineCounterError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid size format: {0}")]
    InvalidSizeFormat(String),

    #[error("Invalid regex pattern: {0}")]
    InvalidRegex(String),

    #[error("Directory not found: {0}")]
    DirectoryNotFound(String),

    #[error("Not a directory: {0}")]
    NotADirectory(String),
}

pub type Result<T> = std::result::Result<T, LineCounterError>;
