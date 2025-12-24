use crate::cli::{Args, OutputFormat};
use crate::core::Summary;
use crate::utils;
use colored::*;
use serde_json::json;

pub fn print_human_output(summary: &Summary, args: &Args) {
    if args.quiet {
        println!("{} {}", summary.total_files, summary.total_lines);
        return;
    }

    println!("\n{}", "=".repeat(60).bright_cyan());
    println!("{}", "LINE COUNTER RESULTS".bright_cyan().bold());
    println!("{}", "=".repeat(60).bright_cyan());

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

    println!();
}

pub fn print_json_output(summary: &Summary, args: &Args) {
    let mut output = json!({
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

    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

pub fn print_csv_output(summary: &Summary, _args: &Args) {
    println!("Extension,Files,Lines,Size");
    for (ext, count) in &summary.files_by_extension {
        let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);
        let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
        println!("{},{},{},{}", ext, count, lines, size);
    }
}

pub fn print_tsv_output(summary: &Summary, _args: &Args) {
    println!("Extension\tFiles\tLines\tSize");
    for (ext, count) in &summary.files_by_extension {
        let lines = summary.lines_by_extension.get(ext).copied().unwrap_or(0);
        let size = summary.size_by_extension.get(ext).copied().unwrap_or(0);
        println!("{}\t{}\t{}\t{}", ext, count, lines, size);
    }
}

pub fn print_output(summary: &Summary, args: &Args) {
    match args.output_format {
        OutputFormat::Human => print_human_output(summary, args),
        OutputFormat::Json => print_json_output(summary, args),
        OutputFormat::Csv => print_csv_output(summary, args),
        OutputFormat::Tsv => print_tsv_output(summary, args),
    }
}
