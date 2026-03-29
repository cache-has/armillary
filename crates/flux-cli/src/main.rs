// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use std::process::ExitCode;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod secret;
mod server;

/// Exit code for pipeline execution failures (distinct from general errors).
/// Used by `flux run` when the pipeline itself fails (vs. a CLI/config error).
#[allow(dead_code)]
const EXIT_PIPELINE_FAILURE: u8 = 2;

/// Output format: human-readable (default) or JSON for scripting.
#[derive(Debug, Clone, Copy)]
pub enum OutputFormat {
    Human,
    Json,
}

#[derive(Parser)]
#[command(
    name = "horizon-flux",
    version,
    about = "Horizon Flux — visual data pipeline builder"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Output results as JSON instead of human-readable text.
    #[arg(long, global = true)]
    json: bool,
}

#[derive(Subcommand)]
enum Command {
    /// Start the Horizon Flux server.
    Start {
        /// Port number for the web server.
        #[arg(long, short, default_value_t = 8080)]
        port: u16,

        /// Start without opening the browser.
        #[arg(long)]
        headless: bool,

        /// Proxy frontend requests to the Vite dev server.
        #[arg(long)]
        dev: bool,
    },
    /// Stop a running server instance.
    Stop,
    /// Show server status (running, port, PID).
    Status,
    /// Manage encrypted secrets.
    Secret {
        #[command(subcommand)]
        action: secret::SecretAction,
    },
    /// Export a pipeline definition to a JSON file.
    Export {
        /// Pipeline name or UUID.
        pipeline: String,
        /// Output file path (defaults to `{pipeline_name}.json` in the current directory).
        #[arg(short, long)]
        output: Option<std::path::PathBuf>,
    },
    /// Import a pipeline definition from a JSON file.
    Import {
        /// Path to the JSON pipeline file.
        file: std::path::PathBuf,
        /// How to handle name conflicts: reject, rename, or overwrite.
        #[arg(long, default_value = "reject")]
        on_conflict: String,
    },
}

fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();
    let format = if cli.json {
        OutputFormat::Json
    } else {
        OutputFormat::Human
    };

    match run(cli, format) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("Error: {e:#}");
            ExitCode::FAILURE
        }
    }
}

fn run(cli: Cli, format: OutputFormat) -> Result<()> {
    match cli.command {
        // Default (no subcommand) = start the server.
        None => server::start(8080, false, false),

        Some(Command::Start {
            port,
            headless,
            dev,
        }) => server::start(port, headless, dev),

        Some(Command::Stop) => {
            server::handle(server::ServerAction::Stop, format)
        }

        Some(Command::Status) => {
            server::handle(server::ServerAction::Status, format)
        }

        Some(Command::Secret { action }) => {
            secret::handle(action).context("secret command failed")
        }

        Some(Command::Export { pipeline, output }) => {
            export_pipeline(&pipeline, output.as_deref(), format)
        }

        Some(Command::Import { file, on_conflict }) => {
            import_pipeline(&file, &on_conflict, format)
        }
    }
}

fn export_pipeline(
    pipeline: &str,
    output: Option<&std::path::Path>,
    format: OutputFormat,
) -> Result<()> {
    let data_dir = dirs::home_dir()
        .context("could not determine home directory")?
        .join(".horizon-flux");
    let pipelines_dir = data_dir.join("pipelines");
    let pipeline_store = flux_engine::PipelineStore::open(
        &data_dir.join("pipelines.db"),
        &pipelines_dir,
    )
    .context("failed to open pipeline store")?;

    let record = if let Ok(id) = pipeline.parse::<flux_engine::PipelineId>() {
        pipeline_store
            .get(&id)
            .context("failed to read pipeline")?
    } else {
        pipeline_store
            .get_by_name(pipeline)
            .context("failed to read pipeline")?
    }
    .ok_or_else(|| anyhow::anyhow!("pipeline `{pipeline}` not found"))?;

    let json = record
        .pipeline
        .to_json()
        .context("failed to serialize pipeline")?;
    let out_path = match output {
        Some(p) => p.to_path_buf(),
        None => {
            let name: String = record
                .pipeline
                .name
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '-' || c == '_' {
                        c
                    } else {
                        '_'
                    }
                })
                .collect();
            std::path::PathBuf::from(format!("{name}.json"))
        }
    };
    std::fs::write(&out_path, &json)
        .with_context(|| format!("failed to write {}", out_path.display()))?;

    match format {
        OutputFormat::Human => {
            println!(
                "Exported `{}` → {}",
                record.pipeline.name,
                out_path.display()
            );
        }
        OutputFormat::Json => {
            let out = serde_json::json!({
                "pipeline": record.pipeline.name,
                "id": record.id.to_string(),
                "path": out_path.display().to_string(),
            });
            println!("{}", serde_json::to_string_pretty(&out)?);
        }
    }
    Ok(())
}

fn import_pipeline(
    file: &std::path::Path,
    on_conflict: &str,
    format: OutputFormat,
) -> Result<()> {
    let data_dir = dirs::home_dir()
        .context("could not determine home directory")?
        .join(".horizon-flux");
    let pipelines_dir = data_dir.join("pipelines");
    std::fs::create_dir_all(&data_dir).context("failed to create data directory")?;
    let pipeline_store = flux_engine::PipelineStore::open(
        &data_dir.join("pipelines.db"),
        &pipelines_dir,
    )
    .context("failed to open pipeline store")?;

    let json = std::fs::read_to_string(file)
        .with_context(|| format!("failed to read {}", file.display()))?;

    let (mut pipeline, warnings) = flux_engine::Pipeline::from_json_with_warnings(&json)
        .context("failed to parse pipeline")?;

    for w in &warnings.undefined_variables {
        eprintln!("warning: {w}");
    }

    let existing = pipeline_store
        .get_by_name(&pipeline.name)
        .context("failed to check for name conflict")?;

    let record = if let Some(existing_record) = existing {
        match on_conflict {
            "rename" => {
                let base_name = pipeline.name.clone();
                let mut counter = 2u32;
                loop {
                    let candidate = format!("{base_name} ({counter})");
                    if pipeline_store.get_by_name(&candidate)?.is_none() {
                        pipeline.name = candidate;
                        break;
                    }
                    counter += 1;
                    anyhow::ensure!(counter <= 100, "could not find a unique name");
                }
                pipeline_store
                    .create(pipeline)
                    .context("failed to create pipeline")?
            }
            "overwrite" => pipeline_store
                .update(&existing_record.id, pipeline)
                .context("failed to overwrite pipeline")?,
            _ => {
                anyhow::bail!(
                    "pipeline `{}` already exists (use --on-conflict rename or overwrite)",
                    pipeline.name
                );
            }
        }
    } else {
        pipeline_store
            .create(pipeline)
            .context("failed to create pipeline")?
    };

    match format {
        OutputFormat::Human => {
            println!("Imported `{}` (id: {})", record.pipeline.name, record.id);
        }
        OutputFormat::Json => {
            let out = serde_json::json!({
                "pipeline": record.pipeline.name,
                "id": record.id.to_string(),
            });
            println!("{}", serde_json::to_string_pretty(&out)?);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn parse_no_subcommand() {
        let cli = Cli::try_parse_from(["horizon-flux"]).unwrap();
        assert!(cli.command.is_none());
        assert!(!cli.json);
    }

    #[test]
    fn parse_start_defaults() {
        let cli = Cli::try_parse_from(["horizon-flux", "start"]).unwrap();
        match cli.command {
            Some(Command::Start {
                port,
                headless,
                dev,
            }) => {
                assert_eq!(port, 8080);
                assert!(!headless);
                assert!(!dev);
            }
            _ => panic!("expected Start"),
        }
    }

    #[test]
    fn parse_start_with_flags() {
        let cli =
            Cli::try_parse_from(["horizon-flux", "start", "--port", "9090", "--headless"])
                .unwrap();
        match cli.command {
            Some(Command::Start {
                port, headless, ..
            }) => {
                assert_eq!(port, 9090);
                assert!(headless);
            }
            _ => panic!("expected Start"),
        }
    }

    #[test]
    fn parse_stop() {
        let cli = Cli::try_parse_from(["horizon-flux", "stop"]).unwrap();
        assert!(matches!(cli.command, Some(Command::Stop)));
    }

    #[test]
    fn parse_status() {
        let cli = Cli::try_parse_from(["horizon-flux", "status"]).unwrap();
        assert!(matches!(cli.command, Some(Command::Status)));
    }

    #[test]
    fn parse_global_json_flag() {
        let cli = Cli::try_parse_from(["horizon-flux", "--json", "status"]).unwrap();
        assert!(cli.json);
        assert!(matches!(cli.command, Some(Command::Status)));
    }

    #[test]
    fn parse_json_flag_after_subcommand() {
        let cli = Cli::try_parse_from(["horizon-flux", "stop", "--json"]).unwrap();
        assert!(cli.json);
        assert!(matches!(cli.command, Some(Command::Stop)));
    }

    #[test]
    fn parse_export() {
        let cli = Cli::try_parse_from([
            "horizon-flux",
            "export",
            "my-pipeline",
            "-o",
            "out.json",
        ])
        .unwrap();
        match cli.command {
            Some(Command::Export { pipeline, output }) => {
                assert_eq!(pipeline, "my-pipeline");
                assert_eq!(output.unwrap().to_str().unwrap(), "out.json");
            }
            _ => panic!("expected Export"),
        }
    }

    #[test]
    fn parse_import() {
        let cli = Cli::try_parse_from([
            "horizon-flux",
            "import",
            "pipeline.json",
            "--on-conflict",
            "rename",
        ])
        .unwrap();
        match cli.command {
            Some(Command::Import {
                file, on_conflict, ..
            }) => {
                assert_eq!(file.to_str().unwrap(), "pipeline.json");
                assert_eq!(on_conflict, "rename");
            }
            _ => panic!("expected Import"),
        }
    }

    #[test]
    fn exit_code_constants() {
        assert_eq!(EXIT_PIPELINE_FAILURE, 2);
    }
}
