mod cli;
mod core;
mod scanner;
mod export;
mod utils;

use cli::run_with_exit;
use cli::Args;
use clap::CommandFactory;
use std::io::{self, Write};

fn main() {
    if std::env::args_os().len() == 1 {
        let should_run = show_interactive_home();
        if !should_run {
            return;
        }
    }

    run_with_exit();
}

fn show_interactive_home() -> bool {
    println!("====================================");
    println!("           locio CLI v{}", env!("CARGO_PKG_VERSION"));
    println!("====================================");
    println!("A fast, flexible line and file counter for your projects.\n");

    println!("Select an option:");
    println!("  1) Quick scan of current directory (default settings)");
    println!("  2) Show common command examples");
    println!("  3) View full help (same as --help)");
    println!("  q) Quit\n");

    loop {
        print!("Enter choice (1/2/3/q): ");
        io::stdout().flush().ok();

        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_err() {
            println!("\nFailed to read input. Exiting.");
            return false;
        }

        let choice = input.trim();
        match choice {
            "1" => {
                println!("\nRunning quick scan on current directory (\".\") with default settings...\n");
                return true;
            }
            "2" => {
                println!("\nCommon commands:");
                println!("  locio .");
                println!("      Scan current directory with default settings.");
                println!("  locio . --files-only");
                println!("      Show only file counts.");
                println!("  locio . --lines-only");
                println!("      Show only line counts.");
                println!("  locio . --exclude \"target\" --exclude-dir \".git\"");
                println!("      Ignore build and VCS directories.");
                println!("  locio . --include-ext rs,ts,tsx");
                println!("      Only include specific extensions.");
                println!("  locio . --output json");
                println!("      Print results in JSON format.\n");
                return false;
            }
            "3" => {
                println!();
                let mut cmd = Args::command();
                let _ = cmd.print_help();
                println!("\n");
                return false;
            }
            "q" | "Q" => {
                println!("\nThank you for using locio.");
                return false;
            }
            _ => {
                println!("Invalid choice. Please enter 1, 2, 3, or q.\n");
            }
        }
    }
}
