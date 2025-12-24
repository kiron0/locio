use crate::cli::Args;
use crate::core::{LineCounterError, Result};
use crate::utils;
use regex::Regex;
use std::fs;
use std::path::Path;

pub struct FilterPatterns {
    pub exclude_patterns: Vec<Regex>,
    pub exclude_extensions: Vec<String>,
    pub include_extensions: Vec<String>,
    pub exclude_dirs: Vec<Regex>,
    pub include_dirs: Vec<Regex>,
    pub exclude_names: Vec<Regex>,
    pub include_names: Vec<Regex>,
}

impl FilterPatterns {
    pub fn from_args(args: &Args) -> Result<Self> {
        let exclude_patterns: Vec<Regex> = args
            .exclude_patterns
            .iter()
            .map(|p| {
                let pattern = if args.ignore_case {
                    format!("(?i){}", p)
                } else {
                    p.clone()
                };
                Regex::new(&pattern)
                    .map_err(|e| LineCounterError::InvalidRegex(format!("{}: {}", p, e)))
            })
            .collect::<Result<Vec<_>>>()?;

        let exclude_extensions: Vec<String> = args
            .exclude_extensions
            .iter()
            .map(|e| e.trim_start_matches('.').to_lowercase())
            .collect();

        let include_extensions: Vec<String> = args
            .include_extensions
            .iter()
            .map(|e| e.trim_start_matches('.').to_lowercase())
            .collect();

        let exclude_dirs: Vec<Regex> = args
            .exclude_dirs
            .iter()
            .map(|p| {
                let pattern = if args.ignore_case {
                    format!("(?i){}", p)
                } else {
                    p.clone()
                };
                Regex::new(&pattern).unwrap()
            })
            .collect();

        let include_dirs: Vec<Regex> = args
            .include_dirs
            .iter()
            .map(|p| {
                let pattern = if args.ignore_case {
                    format!("(?i){}", p)
                } else {
                    p.clone()
                };
                Regex::new(&pattern).unwrap()
            })
            .collect();

        let exclude_names: Vec<Regex> = args
            .exclude_names
            .iter()
            .map(|p| {
                let pattern = if args.ignore_case {
                    format!("(?i){}", p)
                } else {
                    p.clone()
                };
                Regex::new(&pattern).unwrap()
            })
            .collect();

        let include_names: Vec<Regex> = args
            .include_names
            .iter()
            .map(|p| {
                let pattern = if args.ignore_case {
                    format!("(?i){}", p)
                } else {
                    p.clone()
                };
                Regex::new(&pattern).unwrap()
            })
            .collect();

        Ok(Self {
            exclude_patterns,
            exclude_extensions,
            include_extensions,
            exclude_dirs,
            include_dirs,
            exclude_names,
            include_names,
        })
    }
}

pub fn should_exclude_file(path: &Path, args: &Args, patterns: &FilterPatterns) -> bool {
    let path_str = path.to_string_lossy();
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    for pattern in &patterns.exclude_patterns {
        if pattern.is_match(&path_str) {
            return true;
        }
    }

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        for exclude_ext in &patterns.exclude_extensions {
            if ext_lower == exclude_ext.to_lowercase() {
                return true;
            }
        }

        if !patterns.include_extensions.is_empty() {
            let mut matches = false;
            for include_ext in &patterns.include_extensions {
                if ext_lower == include_ext.to_lowercase() {
                    matches = true;
                    break;
                }
            }
            if !matches {
                return true;
            }
        }
    } else if !patterns.include_extensions.is_empty() {
        return true;
    }

    for pattern in &patterns.exclude_dirs {
        if let Some(parent) = path.parent() {
            if pattern.is_match(&parent.to_string_lossy()) {
                return true;
            }
        }
    }

    if !patterns.include_dirs.is_empty() {
        let mut matches = false;
        if let Some(parent) = path.parent() {
            for pattern in &patterns.include_dirs {
                if pattern.is_match(&parent.to_string_lossy()) {
                    matches = true;
                    break;
                }
            }
        }
        if !matches {
            return true;
        }
    }

    for pattern in &patterns.exclude_names {
        if pattern.is_match(file_name) {
            return true;
        }
    }

    if !patterns.include_names.is_empty() {
        let mut matches = false;
        for pattern in &patterns.include_names {
            if pattern.is_match(file_name) {
                matches = true;
                break;
            }
        }
        if !matches {
            return true;
        }
    }

    if args.no_hidden && file_name.starts_with('.') {
        return true;
    }

    if let Ok(metadata) = fs::metadata(path) {
        let size = metadata.len();

        if let Some(ref max_size_str) = args.max_size {
            if let Ok(max_size) = utils::parse_size(max_size_str) {
                if size > max_size {
                    return true;
                }
            }
        }

        if let Some(ref min_size_str) = args.min_size {
            if let Ok(min_size) = utils::parse_size(min_size_str) {
                if size < min_size {
                    return true;
                }
            }
        }

        if args.no_empty && size == 0 {
            return true;
        }
    }

    if args.no_binary && utils::is_binary_file(path) {
        return true;
    }

    false
}
