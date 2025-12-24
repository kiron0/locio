use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct FileStats {
    pub path: PathBuf,
    pub lines: usize,
    pub size: u64,
    pub extension: Option<String>,
}

#[derive(Debug)]
pub struct Summary {
    pub total_files: usize,
    pub total_lines: usize,
    pub total_size: u64,
    pub files_by_extension: HashMap<String, usize>,
    pub lines_by_extension: HashMap<String, usize>,
    pub size_by_extension: HashMap<String, u64>,
}

impl Summary {
    pub fn new() -> Self {
        Self {
            total_files: 0,
            total_lines: 0,
            total_size: 0,
            files_by_extension: HashMap::new(),
            lines_by_extension: HashMap::new(),
            size_by_extension: HashMap::new(),
        }
    }
}
