use std::collections::HashMap;

#[derive(Debug)]
pub struct FileDetail {
    pub directory: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub lines: Option<usize>,
}

#[derive(Debug)]
pub struct Summary {
    pub total_files: usize,
    pub total_lines: usize,
    pub total_size: u64,
    pub files_by_extension: HashMap<String, usize>,
    pub lines_by_extension: HashMap<String, usize>,
    pub size_by_extension: HashMap<String, u64>,
    pub details: Vec<FileDetail>,
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
            details: Vec::new(),
        }
    }
}
