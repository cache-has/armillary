// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

//! Shared application state for all API handlers.

use flux_connectors::ConnectorRegistry;
use flux_datafusion::RunStore;
use flux_engine::PipelineStore;
use std::sync::Arc;

/// Shared state available to all request handlers via Axum's `State` extractor.
#[derive(Clone)]
pub struct AppState {
    pub pipeline_store: Arc<PipelineStore>,
    pub run_store: Arc<RunStore>,
    pub connector_registry: Arc<ConnectorRegistry>,
}
