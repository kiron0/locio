use crate::cli::Args;
use crate::core::Result;
use crate::scanner::scan_directory;
use crate::export::export_report;
use clap::Parser;
use std::process;

pub fn run() -> Result<()> {
    let args = Args::parse();

    if args.version {
        println!("locio {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    if !args.directory.exists() {
        return Err(crate::core::LineCounterError::DirectoryNotFound(
            args.directory.display().to_string(),
        ));
    }

    if !args.directory.is_dir() {
        return Err(crate::core::LineCounterError::NotADirectory(
            args.directory.display().to_string(),
        ));
    }

    let summary = scan_directory(&args)?;
    export_report(&summary, &args);

    Ok(())
}

pub fn run_with_exit() {
    let exit_code = match run() {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("Error: {}", e);
            1
        }
    };
    process::exit(exit_code);
}
