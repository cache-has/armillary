// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

//! SQLite-backed storage for pipeline definitions.

use crate::pipeline::Pipeline;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Unique identifier for a stored pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PipelineId(pub Uuid);

impl PipelineId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for PipelineId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PipelineId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for PipelineId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

/// A pipeline definition with storage metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineRecord {
    pub id: PipelineId,
    pub pipeline: Pipeline,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
}

/// Errors from pipeline storage operations.
#[derive(Debug, thiserror::Error)]
pub enum PipelineStoreError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("pipeline not found: {0}")]
    NotFound(String),

    #[error("pipeline name `{0}` already exists")]
    NameConflict(String),

    #[error("invalid UUID: {0}")]
    InvalidId(String),
}

/// Persists pipeline definitions in embedded SQLite.
pub struct PipelineStore {
    conn: Mutex<Connection>,
}

impl PipelineStore {
    /// Open (or create) a pipeline store at the given file path.
    pub fn open(path: &Path) -> Result<Self, PipelineStoreError> {
        let conn = Connection::open(path)?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.init_schema()?;
        Ok(store)
    }

    /// Open an in-memory pipeline store (useful for tests).
    pub fn open_in_memory() -> Result<Self, PipelineStoreError> {
        let conn = Connection::open_in_memory()?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.init_schema()?;
        Ok(store)
    }

    fn init_schema(&self) -> Result<(), PipelineStoreError> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS pipelines (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL UNIQUE,
                definition  TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_pipelines_name
                ON pipelines (name);",
        )?;
        Ok(())
    }

    /// Create a new pipeline. Returns the created record.
    pub fn create(&self, pipeline: Pipeline) -> Result<PipelineRecord, PipelineStoreError> {
        let conn = self.conn.lock().unwrap();

        // Check for name conflict.
        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM pipelines WHERE name = ?1)",
            params![pipeline.name],
            |row| row.get(0),
        )?;
        if exists {
            return Err(PipelineStoreError::NameConflict(pipeline.name.clone()));
        }

        let now = SystemTime::now();
        let record = PipelineRecord {
            id: PipelineId::new(),
            pipeline,
            created_at: now,
            updated_at: now,
        };

        let json = serde_json::to_string(&record.pipeline)?;
        conn.execute(
            "INSERT INTO pipelines (id, name, definition, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                record.id.0.to_string(),
                record.pipeline.name,
                json,
                system_time_to_ms(record.created_at),
                system_time_to_ms(record.updated_at),
            ],
        )?;
        Ok(record)
    }

    /// Get a pipeline by ID.
    pub fn get(&self, id: &PipelineId) -> Result<Option<PipelineRecord>, PipelineStoreError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, definition, created_at, updated_at
             FROM pipelines WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id.0.to_string()])?;
        match rows.next()? {
            Some(row) => Ok(Some(row_to_record(row)?)),
            None => Ok(None),
        }
    }

    /// List all pipelines, ordered by name.
    pub fn list(&self, limit: u32, offset: u32) -> Result<Vec<PipelineRecord>, PipelineStoreError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, definition, created_at, updated_at
             FROM pipelines
             ORDER BY name ASC
             LIMIT ?1 OFFSET ?2",
        )?;
        let mut rows = stmt.query(params![limit, offset])?;
        let mut records = Vec::new();
        while let Some(row) = rows.next()? {
            records.push(row_to_record(row)?);
        }
        Ok(records)
    }

    /// Get the total count of pipelines.
    pub fn count(&self) -> Result<u32, PipelineStoreError> {
        let conn = self.conn.lock().unwrap();
        let count: u32 = conn.query_row("SELECT COUNT(*) FROM pipelines", [], |row| row.get(0))?;
        Ok(count)
    }

    /// Update an existing pipeline. Returns the updated record.
    pub fn update(
        &self,
        id: &PipelineId,
        pipeline: Pipeline,
    ) -> Result<PipelineRecord, PipelineStoreError> {
        let conn = self.conn.lock().unwrap();

        // Check if a different pipeline already has this name.
        let conflict: Option<String> = conn
            .query_row(
                "SELECT id FROM pipelines WHERE name = ?1 AND id != ?2",
                params![pipeline.name, id.0.to_string()],
                |row| row.get(0),
            )
            .optional()?;
        if conflict.is_some() {
            return Err(PipelineStoreError::NameConflict(pipeline.name.clone()));
        }

        let now = SystemTime::now();
        let json = serde_json::to_string(&pipeline)?;
        let rows = conn.execute(
            "UPDATE pipelines SET name = ?1, definition = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                pipeline.name,
                json,
                system_time_to_ms(now),
                id.0.to_string(),
            ],
        )?;
        if rows == 0 {
            return Err(PipelineStoreError::NotFound(id.to_string()));
        }

        // Re-read to get created_at.
        drop(conn);
        self.get(id)?
            .ok_or_else(|| PipelineStoreError::NotFound(id.to_string()))
    }

    /// Delete a pipeline by ID.
    pub fn delete(&self, id: &PipelineId) -> Result<(), PipelineStoreError> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute(
            "DELETE FROM pipelines WHERE id = ?1",
            params![id.0.to_string()],
        )?;
        if rows == 0 {
            return Err(PipelineStoreError::NotFound(id.to_string()));
        }
        Ok(())
    }
}

fn row_to_record(row: &rusqlite::Row<'_>) -> Result<PipelineRecord, PipelineStoreError> {
    let id_str: String = row.get(0)?;
    let definition_json: String = row.get(2)?;
    let created_ms: i64 = row.get(3)?;
    let updated_ms: i64 = row.get(4)?;

    let id = Uuid::parse_str(&id_str).map_err(|e| PipelineStoreError::InvalidId(format!("{e}")))?;

    Ok(PipelineRecord {
        id: PipelineId(id),
        pipeline: serde_json::from_str(&definition_json)?,
        created_at: ms_to_system_time(created_ms),
        updated_at: ms_to_system_time(updated_ms),
    })
}

fn system_time_to_ms(t: SystemTime) -> i64 {
    t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}

fn ms_to_system_time(ms: i64) -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(ms as u64)
}

/// Extension trait to add `optional()` to `rusqlite::Result`.
trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Pipeline;

    fn test_pipeline(name: &str) -> Pipeline {
        Pipeline {
            name: name.to_string(),
            version: 1,
            default_environment: "dev".to_string(),
            variables: Default::default(),
            environment_overrides: Default::default(),
            nodes: vec![],
            edges: vec![],
        }
    }

    #[test]
    fn create_and_get() {
        let store = PipelineStore::open_in_memory().unwrap();
        let record = store.create(test_pipeline("test")).unwrap();
        assert_eq!(record.pipeline.name, "test");

        let fetched = store.get(&record.id).unwrap().unwrap();
        assert_eq!(fetched.id, record.id);
        assert_eq!(fetched.pipeline.name, "test");
    }

    #[test]
    fn name_conflict() {
        let store = PipelineStore::open_in_memory().unwrap();
        store.create(test_pipeline("dup")).unwrap();
        let err = store.create(test_pipeline("dup")).unwrap_err();
        assert!(matches!(err, PipelineStoreError::NameConflict(_)));
    }

    #[test]
    fn list_and_count() {
        let store = PipelineStore::open_in_memory().unwrap();
        store.create(test_pipeline("b")).unwrap();
        store.create(test_pipeline("a")).unwrap();

        let all = store.list(100, 0).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].pipeline.name, "a"); // sorted by name
        assert_eq!(all[1].pipeline.name, "b");

        assert_eq!(store.count().unwrap(), 2);
    }

    #[test]
    fn update_pipeline() {
        let store = PipelineStore::open_in_memory().unwrap();
        let record = store.create(test_pipeline("old")).unwrap();

        let updated = store.update(&record.id, test_pipeline("new")).unwrap();
        assert_eq!(updated.pipeline.name, "new");
        assert_eq!(updated.id, record.id);

        // Old name should no longer exist.
        let all = store.list(100, 0).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].pipeline.name, "new");
    }

    #[test]
    fn delete_pipeline() {
        let store = PipelineStore::open_in_memory().unwrap();
        let record = store.create(test_pipeline("doomed")).unwrap();
        store.delete(&record.id).unwrap();
        assert!(store.get(&record.id).unwrap().is_none());
    }

    #[test]
    fn delete_not_found() {
        let store = PipelineStore::open_in_memory().unwrap();
        let err = store.delete(&PipelineId::new()).unwrap_err();
        assert!(matches!(err, PipelineStoreError::NotFound(_)));
    }

    #[test]
    fn pagination() {
        let store = PipelineStore::open_in_memory().unwrap();
        for i in 0..5 {
            store.create(test_pipeline(&format!("p{i}"))).unwrap();
        }

        let page1 = store.list(2, 0).unwrap();
        assert_eq!(page1.len(), 2);
        let page2 = store.list(2, 2).unwrap();
        assert_eq!(page2.len(), 2);
        let page3 = store.list(2, 4).unwrap();
        assert_eq!(page3.len(), 1);
    }
}
