use crate::core::{LineCounterError, Result};
use std::fs;
use std::path::Path;

pub fn parse_size(size_str: &str) -> Result<u64> {
    let size_str = size_str.trim().to_uppercase();
    let (number, unit) = if size_str.ends_with("KB") {
        (&size_str[..size_str.len() - 2], 1024)
    } else if size_str.ends_with("MB") {
        (&size_str[..size_str.len() - 2], 1024 * 1024)
    } else if size_str.ends_with("GB") {
        (&size_str[..size_str.len() - 2], 1024 * 1024 * 1024)
    } else if size_str.ends_with("B") && size_str.len() > 1 {
        (&size_str[..size_str.len() - 1], 1)
    } else {
        (size_str.as_str(), 1)
    };

    number
        .parse::<f64>()
        .map(|n| (n * unit as f64) as u64)
        .map_err(|_| LineCounterError::InvalidSizeFormat(size_str.to_string()))
}

pub fn is_binary_file(path: &Path) -> bool {
    if let Ok(contents) = fs::read(path) {
        if contents.len() > 8192 {
            contents[..contents.len().min(8192)]
                .iter()
                .any(|&b| b == 0)
        } else {
            contents.iter().any(|&b| b == 0)
        }
    } else {
        false
    }
}

pub fn count_lines(path: &Path, include_blank: bool) -> Result<usize> {
    let contents = fs::read_to_string(path)?;
    if include_blank {
        Ok(contents.lines().count())
    } else {
        Ok(contents.lines().filter(|l| !l.trim().is_empty()).count())
    }
}
