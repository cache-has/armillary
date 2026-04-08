// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

//! Host-side integration test against the **real** bundled OpenBoard plugin.
//!
//! Mirrors `openboard/plugins/flux/test/integration.test.ts` but drives the
//! plugin from the host's own framing/transport code, so format drift between
//! the Rust host and the TypeScript plugin gets caught in horizon_flux's CI.
//!
//! The OpenBoard plugin lives in a sibling repo and is not always present
//! (CI checkouts of just horizon_flux, contributors without the openboard
//! tree, etc.). The test therefore **skips** rather than fails when:
//!   - the sibling `openboard/plugins/flux` directory is missing
//!   - `dist/openboard-plugin.js` hasn't been built
//!   - `node` is not on `PATH`
//!
//! Run a fresh build of the plugin (`npm run build` in `openboard/plugins/flux`)
//! before relying on this test locally.

use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;

use arrow::array::{Int32Array, RecordBatch, StringArray};
use arrow::datatypes::{DataType, Field, Schema};
use flux_plugin_host::manifest::Manifest;
use flux_plugin_host::process::{PluginProcess, SpawnOptions};
use flux_plugin_host::session::PluginSession;
use serde_json::json;
use tempfile::tempdir;

fn locate_openboard_plugin() -> Option<PathBuf> {
    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)?
        .to_path_buf();
    let candidate = workspace_root
        .parent()?
        .join("openboard")
        .join("plugins")
        .join("flux");
    if candidate.join("plugin.toml").is_file()
        && candidate.join("dist").join("openboard-plugin.js").is_file()
    {
        Some(candidate)
    } else {
        None
    }
}

fn node_on_path() -> bool {
    Command::new("node")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    }

#[test]
fn openboard_plugin_full_lifecycle() {
    let Some(plugin_dir) = locate_openboard_plugin() else {
        eprintln!("skipping: openboard plugin not found at sibling repo");
        return;
    };
    if !node_on_path() {
        eprintln!("skipping: `node` not on PATH");
        return;
    }

    let manifest_path = plugin_dir.join("plugin.toml");
    let manifest = Manifest::from_path(&manifest_path).expect("parse plugin.toml");

    let proc = PluginProcess::spawn_with_manifest(
        "openboard",
        &plugin_dir,
        &manifest,
        SpawnOptions::default(),
    )
    .expect("spawn openboard plugin");

    let mut session = PluginSession::new(proc, 1, "0.0.0-test");
    let ack = session.handshake().expect("handshake");
    assert_eq!(ack.plugin_name, "openboard");

    // Stage a fresh OpenBoard project directory so the plugin can write
    // connections/, datasets/, and the DuckDB file into a clean tree.
    let project = tempdir().unwrap();
    let project_path = project.path().to_path_buf();

    let schema = Schema::new(vec![
        Field::new("id", DataType::Int32, false),
        Field::new("name", DataType::Utf8, false),
    ]);

    session
        .configure(
            "openboard_duckdb",
            json!({
                "openboard_project": project_path.to_str().unwrap(),
                "connection_name": "flux_pipelines",
                "database_file": "data/flux.duckdb",
                "table_name": "host_harness_rows",
                "write_mode": "replace",
                "write_dataset_metadata": true,
            }),
            &schema,
        )
        .expect("configure");

    let batch = RecordBatch::try_new(
        Arc::new(schema.clone()),
        vec![
            Arc::new(Int32Array::from(vec![1, 2, 3])),
            Arc::new(StringArray::from(vec!["a", "b", "c"])),
        ],
    )
    .unwrap();
    let ack = session.send_batch(&batch).expect("send batch");
    assert_eq!(ack.rows_accepted, 3);

    let commit = session.commit().expect("commit");
    assert_eq!(commit.rows, 3);
    session.shutdown().expect("shutdown");

    // The plugin promises: target file present, connection + dataset YAML emitted.
    assert!(
        project_path.join("data").join("flux.duckdb").is_file(),
        "expected DuckDB target file to exist after commit"
    );
    assert!(
        project_path
            .join("connections")
            .join("flux_pipelines.yaml")
            .is_file(),
        "expected connection yaml to exist after commit"
    );
    assert!(
        project_path
            .join("datasets")
            .join("host_harness_rows.yaml")
            .is_file(),
        "expected dataset metadata yaml to exist after commit"
    );
}
