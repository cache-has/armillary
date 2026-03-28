// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use serde::{Deserialize, Serialize};
use std::fmt;

/// Unique identifier for a node within a pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct NodeId(pub String);

impl NodeId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl<S: Into<String>> From<S> for NodeId {
    fn from(s: S) -> Self {
        Self(s.into())
    }
}

/// A node in the pipeline DAG.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: NodeId,
    pub name: String,
    #[serde(flatten)]
    pub kind: NodeKind,
    /// Canvas position for the frontend.
    #[serde(default)]
    pub position: Position,
    /// Whether the user has pinned this node's position on the canvas.
    #[serde(default)]
    pub pinned_position: bool,
}

/// The type-specific configuration for a node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NodeKind {
    Source(SourceConfig),
    Transform(TransformConfig),
    Sink(SinkConfig),
}

impl NodeKind {
    pub fn is_source(&self) -> bool {
        matches!(self, Self::Source(_))
    }

    pub fn is_transform(&self) -> bool {
        matches!(self, Self::Transform(_))
    }

    pub fn is_sink(&self) -> bool {
        matches!(self, Self::Sink(_))
    }
}

/// Configuration for a source node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceConfig {
    /// Connector type name (e.g. "csv", "parquet", "postgresql", "rest_api").
    pub connector: String,
    /// Connector-specific configuration (opaque JSON).
    #[serde(default)]
    pub config: serde_json::Value,
}

/// The execution mode for a transform node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransformMode {
    Sql,
    Python,
}

/// Configuration for a transform node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformConfig {
    pub mode: TransformMode,
    /// SQL query or Python code.
    #[serde(default)]
    pub code: String,
    /// Whether this node's output should be materialized (cached).
    #[serde(default)]
    pub materialized: bool,
}

/// Configuration for a sink node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinkConfig {
    /// Connector type name (e.g. "csv", "parquet", "postgresql", "stdout").
    pub connector: String,
    /// Connector-specific configuration (opaque JSON).
    #[serde(default)]
    pub config: serde_json::Value,
}

/// 2D position on the canvas.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
