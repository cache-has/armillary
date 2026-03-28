// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

use crate::node::NodeId;

/// Errors that can occur during DAG construction and validation.
#[derive(Debug, thiserror::Error)]
pub enum DagError {
    #[error("cycle detected involving node `{0}`")]
    CycleDetected(NodeId),

    #[error("orphan node `{0}` has no edges connecting it to the pipeline")]
    OrphanNode(NodeId),

    #[error("edge references unknown node `{0}`")]
    UnknownNode(NodeId),

    #[error("source node `{0}` must not have upstream edges")]
    SourceHasUpstream(NodeId),

    #[error("sink node `{0}` must not have downstream edges")]
    SinkHasDownstream(NodeId),

    #[error("transform node `{0}` must have at least one upstream edge")]
    TransformMissingUpstream(NodeId),

    #[error("sink node `{0}` must have at least one upstream edge")]
    SinkMissingUpstream(NodeId),

    #[error("duplicate node id `{0}`")]
    DuplicateNodeId(NodeId),

    #[error("duplicate edge from `{from}` to `{to}`")]
    DuplicateEdge { from: NodeId, to: NodeId },

    #[error("pipeline has no nodes")]
    EmptyPipeline,
}

/// Top-level engine error type.
#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error(transparent)]
    Dag(#[from] DagError),

    #[error("pipeline `{0}` not found")]
    PipelineNotFound(String),

    #[error("{0}")]
    Other(String),
}
