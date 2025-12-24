use crate::cli::{Args, OutputFormat};
use crate::core::{Summary, FileDetail};
use crate::utils;
use colored::*;
use serde_json::json;
use std::fs;
use std::io::Write;

fn display_directory(args: &Args) -> String {
    let dir = args.directory.display().to_string();
    if dir == "." {
        "current".to_string()
    } else {
        dir
    }
}

fn build_human_report(summary: &Summary, args: &Args) -> String {
    let mut out = String::new();

    if args.quiet {
        out.push_str(&format!("{} {}\n", summary.total_files, summary.total_lines));
        return out;
    }

    out.push_str(&format!("{}\n", "=".repeat(60)));
    out.push_str("LINE COUNTER RESULTS\n");
    out.push_str(&format!("{}\n\n", "=".repeat(60)));

    out.push_str(&format!("Directory: {}\n", display_directory(args)));

    if !args.lines_only {
        out.push_str(&format!(
            "\nTotal Files: {} ({})\n",
            summary.total_files,
            utils::format_size(summary.total_size)
        ));
    }

    if !args.files_only {
        out.push_str(&format!("\nTotal Lines: {}\n", summary.total_lines));
    }

    if !summary.files_by_extension.is_empty() {
        let mut extensions: Vec<_> = summary.files_by_extension.keys().collect();
        extensions.sort();
        let ext_list: Vec<String> = extensions.iter().map(|ext| ext.to_string()).collect();
        out.push_str(&format!("\nExtensions: {}\n", ext_list.join(", ")));
    }

    if args.show_stats && !summary.files_by_extension.is_empty() {
        let mut extensions: Vec<_> = summary.files_by_extension.keys().collect();
        extensions.sort();

        out.push_str("\nStatistics by Extension:\n");
        out.push_str(&format!("{}\n", "-".repeat(60)));

        for ext in extensions {
            let files = summary.files_by_extension[ext];
            let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
            let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);

            out.push_str(&format!("  {}: {} files", ext, files));

            if !args.lines_only {
                out.push_str(&format!(", {}", utils::format_size(size)));
            }

            if !args.files_only {
                out.push_str(&format!(", {} lines", lines));
            }

            out.push('\n');
        }
    }

    if args.show_stats && !summary.details.is_empty() {
        use std::collections::BTreeMap;

        out.push_str("\nFiles by Directory:\n");
        out.push_str(&format!("{}\n", "-".repeat(60)));

        let mut by_dir: BTreeMap<&str, Vec<&FileDetail>> = BTreeMap::new();
        for detail in &summary.details {
            by_dir
                .entry(detail.directory.as_str())
                .or_default()
                .push(detail);
        }

        for (dir, files) in by_dir {
            out.push_str(&format!("Directory: {}\n", dir));

            for f in files {
                let size_str = utils::format_size(f.size);
                let lines_str = match f.lines {
                    Some(l) if !args.files_only => format!(" | {} lines", l),
                    _ => String::new(),
                };

                out.push_str(&format!(
                    "  - {} ({}, {}{})\n",
                    f.name, f.extension, size_str, lines_str
                ));
            }

            out.push('\n');
        }
    }

    out.push('\n');

    out
}

pub fn human_report(summary: &Summary, args: &Args) {
    if args.quiet {
        println!("{} {}", summary.total_files, summary.total_lines);
        return;
    }

    println!("\n{}", "=".repeat(60).bright_cyan());
    println!("{}", "LINE COUNTER RESULTS".bright_cyan().bold());
    println!("{}", "=".repeat(60).bright_cyan());

    println!(
        "\n{} {}",
        "Directory:".bright_green().bold(),
        display_directory(args)
    );

    if !args.lines_only {
        println!(
            "\n{} {} {}",
            "Total Files:".bright_green().bold(),
            summary.total_files.to_string().bright_yellow(),
            utils::format_size(summary.total_size).bright_white()
        );
    }

    if !args.files_only {
        println!(
            "\n{} {}",
            "Total Lines:".bright_green().bold(),
            summary.total_lines.to_string().bright_yellow()
        );
    }

    if !summary.files_by_extension.is_empty() {
        let mut extensions: Vec<_> = summary.files_by_extension.keys().collect();
        extensions.sort();

        print!("\n{} ", "Extensions:".bright_green().bold());
        let ext_list: Vec<String> = extensions.iter().map(|ext| ext.to_string()).collect();
        println!("{}", ext_list.join(", ").bright_white());
    }

    if args.show_stats && !summary.files_by_extension.is_empty() {
        println!("\n{}", "Statistics by Extension:".bright_cyan().bold());
        println!("{}", "-".repeat(60).bright_black());

        let mut extensions: Vec<_> = summary.files_by_extension.keys().collect();
        extensions.sort();

        for ext in extensions {
            let files = summary.files_by_extension[ext];
            let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
            let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);

            print!(
                "  {}: {} files",
                ext.bright_white(),
                files.to_string().bright_yellow()
            );

            if !args.lines_only {
                print!(", {}", utils::format_size(size).bright_white());
            }

            if !args.files_only {
                print!(", {} lines", lines.to_string().bright_yellow());
            }

            println!();
        }
    }

    if args.show_stats && !summary.details.is_empty() {
        use std::collections::BTreeMap;

        println!("\n{}", "Files by Directory:".bright_cyan().bold());
        println!("{}", "-".repeat(60).bright_black());

        let mut by_dir: BTreeMap<&str, Vec<&FileDetail>> = BTreeMap::new();
        for detail in &summary.details {
            by_dir
                .entry(detail.directory.as_str())
                .or_default()
                .push(detail);
        }

        for (dir, files) in by_dir {
            println!(
                "{}",
                format!("Directory: {}", dir).bright_green().bold()
            );

            for f in files {
                let size_str = utils::format_size(f.size);
                let lines_str = match f.lines {
                    Some(l) if !args.files_only => format!(" | {} lines", l),
                    _ => String::new(),
                };

                println!(
                    "  - {} ({}, {}{})",
                    f.name.bright_white(),
                    f.extension.bright_blue(),
                    size_str.bright_white(),
                    lines_str
                );
            }

            println!();
        }
    }

    println!();
}

fn build_json_output(summary: &Summary, args: &Args) -> String {
    let mut output = json!({
        "directory": display_directory(args),
        "files": summary.total_files,
        "size": summary.total_size,
        "size_formatted": utils::format_size(summary.total_size),
    });

    if !args.files_only {
        output["lines"] = json!(summary.total_lines);
    }

    if args.show_stats {
        let mut stats = json!({});
        for (ext, count) in &summary.files_by_extension {
            stats[ext] = json!({
                "files": count,
                "lines": summary.lines_by_extension.get(ext).copied().unwrap_or(0),
                "size": summary.size_by_extension.get(ext).copied().unwrap_or(0),
            });
        }
        output["by_extension"] = stats;
    }

    serde_json::to_string_pretty(&output).unwrap()
}

fn build_csv_output(summary: &Summary, _args: &Args) -> String {
    let mut out = String::new();
    out.push_str(&format!("# Directory,{}\n", display_directory(_args)));
    out.push_str("Extension,Files,Lines,Size\n");
    for (ext, count) in &summary.files_by_extension {
        let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);
        let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
        out.push_str(&format!("{},{},{},{}\n", ext, count, lines, size));
    }
    out
}

fn build_tsv_output(summary: &Summary, _args: &Args) -> String {
    let mut out = String::new();
    out.push_str(&format!("# Directory\t{}\n", display_directory(_args)));
    out.push_str("Extension\tFiles\tLines\tSize\n");
    for (ext, count) in &summary.files_by_extension {
        let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);
        let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
        out.push_str(&format!("{}\t{}\t{}\t{}\n", ext, count, lines, size));
    }
    out
}

fn write_report_file(summary: &Summary, args: &Args) {
    let format = args.export.clone().unwrap_or(OutputFormat::Human);

    let (ext, content) = match format {
        OutputFormat::Human => ("txt", build_human_report(summary, args)),
        OutputFormat::Json => ("json", build_json_output(summary, args)),
        OutputFormat::Csv => ("csv", build_csv_output(summary, args)),
        OutputFormat::Tsv => ("tsv", build_tsv_output(summary, args)),
    };

    let filename = format!("locio-report.{}", ext);

    match fs::File::create(&filename) {
        Ok(mut file) => {
            if let Err(e) = file.write_all(content.as_bytes()) {
                eprintln!("Failed to write report to {}: {}", filename, e);
            } else if !args.quiet {
                println!("Report written to {}", filename);
            }
        }
        Err(e) => {
            eprintln!("Failed to create report file {}: {}", filename, e);
        }
    }
}

pub fn export_report(summary: &Summary, args: &Args) {
    if args.export.is_some() {
        write_report_file(summary, args);
        return;
    }

    human_report(summary, args);
}
