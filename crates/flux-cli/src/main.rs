// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod secret;

#[derive(Parser)]
#[command(
    name = "horizon-flux",
    version,
    about = "Horizon Flux — visual data pipeline builder"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Starting port number for the web server.
    #[arg(long, default_value_t = 8080)]
    port: u16,

    /// Do not auto-open the browser.
    #[arg(long)]
    no_browser: bool,

    /// Proxy frontend requests to the Vite dev server instead of serving
    /// embedded static files.
    #[arg(long)]
    dev: bool,
}

#[derive(Subcommand)]
enum Command {
    /// Manage encrypted secrets.
    Secret {
        #[command(subcommand)]
        action: secret::SecretAction,
    },
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Some(Command::Secret { action }) => {
            secret::handle(action).context("secret command failed")?;
        }
        None => {
            let config = flux_server::ServerConfig {
                port_start: cli.port,
                open_browser: !cli.no_browser,
                dev_mode: cli.dev,
                ..Default::default()
            };

            let rt = tokio::runtime::Runtime::new().context("failed to create tokio runtime")?;
            rt.block_on(flux_server::serve(config))
                .context("server failed")?;
        }
    }

    Ok(())
}
