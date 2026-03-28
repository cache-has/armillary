// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

//! Axum web server for Horizon Flux.
//!
//! Provides HTTP/WebSocket server that serves the React frontend and
//! exposes API routes for pipeline management. Handles single-instance
//! detection via lockfile and auto-opens the browser.

pub mod error;
pub mod lockfile;
pub mod port;
pub mod shutdown;

pub use error::ServerError;

use std::process;

use axum::Router;
use tracing::info;

/// Configuration for the web server.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Starting port number (default: 8080).
    pub port_start: u16,
    /// Ceiling for port scanning, exclusive (default: 8180).
    pub port_ceiling: u16,
    /// Whether to auto-open the browser.
    pub open_browser: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port_start: port::DEFAULT_PORT,
            port_ceiling: port::DEFAULT_PORT_CEILING,
            open_browser: true,
        }
    }
}

/// Start the Horizon Flux web server.
///
/// 1. Checks for an existing running instance (opens browser + exits)
/// 2. Finds an available port and binds the listener
/// 3. Creates a lockfile
/// 4. Opens the browser
/// 5. Serves until shutdown signal
/// 6. Cleans up lockfile via RAII guard
pub async fn serve(config: ServerConfig) -> Result<(), ServerError> {
    let lock_path = lockfile::default_path()?;

    // --- Instance detection ---
    if let Some(existing) = lockfile::check_existing(&lock_path)? {
        let url = format!("http://localhost:{}", existing.port);
        info!(
            "Existing instance found (PID {}, port {})",
            existing.pid, existing.port
        );
        println!("Horizon Flux is already running at {url}");
        if config.open_browser {
            let _ = open::that(&url);
        }
        return Ok(());
    }

    // --- Port selection + bind ---
    let (listener, port) = port::find_and_bind(config.port_start, config.port_ceiling).await?;

    // --- Lockfile ---
    let info = lockfile::InstanceInfo {
        pid: process::id(),
        port,
    };
    lockfile::write(&lock_path, &info)?;
    let _guard = shutdown::LockfileGuard::new(lock_path);

    // --- Build router ---
    // Placeholder: routes are added in later planning sections.
    let app = Router::new();

    let url = format!("http://localhost:{port}");
    info!("Horizon Flux listening on {url}");
    println!("Horizon Flux is running at {url}");

    // --- Open browser ---
    if config.open_browser {
        if let Err(e) = open::that(&url) {
            tracing::warn!("Could not open browser: {e}");
            println!("Open {url} in your browser");
        }
    }

    // --- Serve with graceful shutdown ---
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown::shutdown_signal())
        .await
        .map_err(|e| ServerError::Serve(e.to_string()))?;

    info!("Server shut down gracefully");
    Ok(())
}

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
