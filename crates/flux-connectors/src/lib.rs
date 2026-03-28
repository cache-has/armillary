// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

//! Concrete source and sink connector implementations for Horizon Flux.
//!
//! This crate provides:
//! - [`ConnectorConfig`]: Typed, serializable configuration for each connector
//! - [`ConnectorRegistry`]: Factory that creates connectors from config and
//!   populates a [`ProviderRegistry`]

pub mod config;
pub mod file_source;
pub mod registry;

pub use config::ConnectorConfig;
pub use file_source::FileSource;
pub use registry::ConnectorRegistry;

use std::sync::Arc;

/// Create a [`ConnectorRegistry`] pre-populated with all built-in connectors.
pub fn default_registry() -> ConnectorRegistry {
    let mut registry = ConnectorRegistry::new();

    let file_source: Arc<dyn flux_datafusion::provider::SourceConnector> =
        Arc::new(FileSource::new());
    // Register under multiple aliases so pipeline JSON can use any of them.
    registry.register_source("file", Arc::clone(&file_source));
    registry.register_source("csv", Arc::clone(&file_source));
    registry.register_source("parquet", file_source);

    registry
}

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
