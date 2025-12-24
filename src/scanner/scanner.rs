use crate::cli::Args;
use crate::core::{Result, FileDetail};
use crate::core::filter::{FilterPatterns, should_exclude_file};
use crate::core::Summary;
use crate::utils;
use ignore::WalkBuilder;
use std::fs;
use std::time::Instant;

pub fn scan_directory(args: &Args) -> Result<Summary> {
    let start_time = Instant::now();
    let mut summary = Summary::new();

    let patterns = FilterPatterns::from_args(args)?;

    let mut walker = WalkBuilder::new(&args.directory);
    walker.hidden(!args.no_hidden);
    walker.follow_links(args.follow_links);

    if let Some(depth) = args.max_depth {
        walker.max_depth(Some(depth));
    }

    let _ = walker.add_ignore(".git");
    let _ = walker.add_ignore(".gitignore");
    let _ = walker.add_ignore(".lcignore");

    let mut processed = 0;
    let mut errors = 0;

    for result in walker.build() {
        match result {
            Ok(entry) => {
                let path = entry.path();

                if !path.is_file() {
                    continue;
                }

                if should_exclude_file(path, args, &patterns) {
                    continue;
                }

                processed += 1;

                if args.show_progress && processed % 100 == 0 && !args.quiet {
                    eprint!("\rProcessed: {} files...", processed);
                }

                let metadata = match fs::metadata(path) {
                    Ok(m) => m,
                    Err(e) => {
                        if !args.quiet {
                            eprintln!("Warning: Could not read metadata for {}: {}", path.display(), e);
                        }
                        errors += 1;
                        continue;
                    }
                };

                let size = metadata.len();
                let extension = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase())
                    .unwrap_or_else(|| "no-extension".to_string());

                summary.total_files += 1;
                summary.total_size += size;

                *summary.files_by_extension.entry(extension.clone()).or_insert(0) += 1;
                *summary.size_by_extension.entry(extension.clone()).or_insert(0) += size;

                let mut lines_opt: Option<usize> = None;

                if !args.files_only {
                    match utils::count_lines(path, args.include_blank) {
                        Ok(lines) => {
                            lines_opt = Some(lines);
                            summary.total_lines += lines;
                            *summary.lines_by_extension.entry(extension.clone()).or_insert(0) += lines;
                        }
                        Err(e) => {
                            if !args.quiet {
                                eprintln!("Warning: Could not count lines in {}: {}", path.display(), e);
                            }
                            errors += 1;
                        }
                    }
                }

                let directory = path
                    .parent()
                    .map(|p| p.display().to_string())
                    .unwrap_or_else(|| ".".to_string());

                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| path.display().to_string());

                summary.details.push(FileDetail {
                    directory,
                    name,
                    extension,
                    size,
                    lines: lines_opt,
                });
            }
            Err(e) => {
                if !args.quiet {
                    eprintln!("Warning: Directory traversal error: {}", e);
                }
                errors += 1;
            }
        }
    }

    if args.show_progress && !args.quiet {
        eprintln!(
            "\rProcessed: {} files ({} errors) in {:?}",
            processed,
            errors,
            start_time.elapsed()
        );
    }

    Ok(summary)
}
