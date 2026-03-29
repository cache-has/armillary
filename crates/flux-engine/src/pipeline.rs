// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use crate::edge::Edge;
use crate::node::{Node, NodeId};
use crate::sample::SampleConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A complete pipeline definition: a DAG of source, transform, and sink nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub name: String,
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default = "default_environment")]
    pub default_environment: String,
    #[serde(default)]
    pub variables: HashMap<String, Variable>,
    /// Per-environment, per-node config overrides.
    /// Outer key = environment name, inner key = node id, value = override config.
    #[serde(default)]
    pub environment_overrides: HashMap<String, HashMap<String, serde_json::Value>>,
    /// Default sample configuration for preview execution.
    /// When `None`, previews use `SampleConfig::default()` (first 100 rows).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample_config: Option<SampleConfig>,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

fn default_version() -> u32 {
    1
}

fn default_environment() -> String {
    "dev".to_string()
}

impl Pipeline {
    /// Look up a node by its ID.
    pub fn node(&self, id: &NodeId) -> Option<&Node> {
        self.nodes.iter().find(|n| n.id == *id)
    }

    /// Return an iterator of node IDs.
    pub fn node_ids(&self) -> impl Iterator<Item = &NodeId> {
        self.nodes.iter().map(|n| &n.id)
    }

    /// Return the upstream node IDs for a given node.
    pub fn upstream_of(&self, id: &NodeId) -> Vec<&NodeId> {
        self.edges
            .iter()
            .filter(|e| e.to == *id)
            .map(|e| &e.from)
            .collect()
    }

    /// Return the downstream node IDs for a given node.
    pub fn downstream_of(&self, id: &NodeId) -> Vec<&NodeId> {
        self.edges
            .iter()
            .filter(|e| e.from == *id)
            .map(|e| &e.to)
            .collect()
    }
}

/// A user-defined pipeline variable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    #[serde(rename = "type")]
    pub var_type: VariableType,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
}

/// Supported variable types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VariableType {
    String,
    Integer,
    Float,
    Date,
    Boolean,
}
