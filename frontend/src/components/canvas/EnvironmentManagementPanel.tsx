// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { listTableOverrides, type ApiTableOverride } from '../../api/environments';
import { ConfirmDialog } from './ConfirmDialog';
import './EnvironmentManagementPanel.css';

/** Color mapping for well-known environments. */
const ENV_COLORS: Record<string, string> = {
  prod: '#ef4444',
  production: '#ef4444',
  staging: '#f59e0b',
  dev: '#3b82f6',
  development: '#3b82f6',
};

function envColor(name: string): string {
  return ENV_COLORS[name.toLowerCase()] ?? '#8b5cf6';
}

/** Build a display string for the fallback chain. */
function buildChainDisplay(
  envName: string,
  environments: { name: string; fallback: string | null }[],
): string {
  const byName = new Map(environments.map((e) => [e.name, e]));
  const parts: string[] = [envName];
  let current = byName.get(envName);
  while (current?.fallback) {
    parts.push(current.fallback);
    current = byName.get(current.fallback);
  }
  return parts.join(' \u2192 ');
}

export function EnvironmentManagementPanel() {
  const open = useEnvironmentStore((s) => s.managementPanelOpen);
  const setOpen = useEnvironmentStore((s) => s.setManagementPanelOpen);
  const environments = useEnvironmentStore((s) => s.environments);
  const fetchEnvironments = useEnvironmentStore((s) => s.fetchEnvironments);
  const addEnvironment = useEnvironmentStore((s) => s.addEnvironment);
  const removeEnvironment = useEnvironmentStore((s) => s.removeEnvironment);
  const updateFallback = useEnvironmentStore((s) => s.updateFallback);
  const storeError = useEnvironmentStore((s) => s.error);

  // Per-environment override counts
  const [overrideCounts, setOverrideCounts] = useState<Record<string, number>>({});

  // Create form state
  const [newName, setNewName] = useState('');
  const [newFallback, setNewFallback] = useState('prod');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteOverrides, setDeleteOverrides] = useState<ApiTableOverride[]>([]);

  // Inline fallback editing
  const [editingFallback, setEditingFallback] = useState<string | null>(null);
  const [editFallbackValue, setEditFallbackValue] = useState<string>('');

  // Load override counts when panel opens or environments change
  useEffect(() => {
    if (!open) return;
    fetchEnvironments();
  }, [open, fetchEnvironments]);

  useEffect(() => {
    if (!open || environments.length === 0) return;

    let cancelled = false;
    async function loadCounts() {
      const counts: Record<string, number> = {};
      for (const env of environments) {
        try {
          const overrides = await listTableOverrides(env.name);
          if (cancelled) return;
          counts[env.name] = overrides.length;
        } catch {
          counts[env.name] = 0;
        }
      }
      if (!cancelled) setOverrideCounts(counts);
    }
    loadCounts();
    return () => { cancelled = true; };
  }, [open, environments]);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setFormError(null);
    try {
      await addEnvironment(trimmed, newFallback || undefined);
      setNewName('');
      setNewFallback('prod');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [newName, newFallback, addEnvironment]);

  const handleDeleteClick = useCallback(async (name: string) => {
    try {
      const overrides = await listTableOverrides(name);
      setDeleteOverrides(overrides);
    } catch {
      setDeleteOverrides([]);
    }
    setDeleteTarget(name);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await removeEnvironment(deleteTarget);
    } catch {
      // Error is set in store
    }
    setDeleteTarget(null);
    setDeleteOverrides([]);
  }, [deleteTarget, removeEnvironment]);

  const handleEditFallback = useCallback((envName: string, currentFallback: string | null) => {
    setEditingFallback(envName);
    setEditFallbackValue(currentFallback ?? '');
  }, []);

  const handleSaveFallback = useCallback(async () => {
    if (!editingFallback) return;
    try {
      await updateFallback(editingFallback, editFallbackValue || null);
      setEditingFallback(null);
    } catch {
      // Error is set in store
    }
  }, [editingFallback, editFallbackValue, updateFallback]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditingFallback(null);
    setFormError(null);
  }, [setOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleClose]);

  const deleteMessage = deleteTarget
    ? deleteOverrides.length > 0
      ? `This will delete "${deleteTarget}" and its ${deleteOverrides.length} table override(s): ${deleteOverrides.map((o) => o.table_name).join(', ')}.`
      : `Are you sure you want to delete "${deleteTarget}"?`
    : '';

  return (
    <>
      <div className={`env-panel${open ? ' env-panel--open' : ''}`}>
        <div className="env-panel__header">
          <h2 className="env-panel__title">Environments</h2>
          <button className="env-panel__close" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="env-panel__body">
          {(storeError || formError) && (
            <div className="env-panel__error">{formError || storeError}</div>
          )}

          {environments.length === 0 ? (
            <div className="env-panel__empty">No environments configured</div>
          ) : (
            <ul className="env-panel__list">
              {environments.map((env) => {
                const isProd = env.name === 'prod';
                const chain = buildChainDisplay(env.name, environments);
                const count = overrideCounts[env.name] ?? 0;

                return (
                  <li key={env.name} className="env-panel__item">
                    <div className="env-panel__item-header">
                      <span
                        className="env-panel__item-dot"
                        style={{ background: envColor(env.name) }}
                      />
                      <span className="env-panel__item-name">{env.name}</span>
                      <div className="env-panel__item-actions">
                        {!isProd && (
                          <button
                            className="env-panel__item-btn"
                            onClick={() => handleEditFallback(env.name, env.fallback)}
                            title="Edit fallback"
                          >
                            Edit
                          </button>
                        )}
                        {!isProd && (
                          <button
                            className="env-panel__item-btn env-panel__item-btn--danger"
                            onClick={() => handleDeleteClick(env.name)}
                            title="Delete environment"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="env-panel__item-meta">
                      <span className="env-panel__chain">{chain}</span>
                      <span className="env-panel__overrides-count">
                        {count} table override{count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {editingFallback === env.name && (
                      <div className="env-panel__fallback-editor">
                        <label>Fallback:</label>
                        <select
                          className="env-panel__fallback-select"
                          value={editFallbackValue}
                          onChange={(e) => setEditFallbackValue(e.target.value)}
                        >
                          <option value="">None</option>
                          {environments
                            .filter((e) => e.name !== env.name)
                            .map((e) => (
                              <option key={e.name} value={e.name}>
                                {e.name}
                              </option>
                            ))}
                        </select>
                        <button
                          className="env-panel__fallback-save"
                          onClick={handleSaveFallback}
                          disabled={editFallbackValue === (env.fallback ?? '')}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Create environment form */}
          <div className="env-panel__create">
            <h3 className="env-panel__create-title">Create Environment</h3>
            <div className="env-panel__form">
              <div className="env-panel__field">
                <label htmlFor="env-create-name">Name</label>
                <input
                  id="env-create-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. staging"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                />
              </div>
              <div className="env-panel__field">
                <label htmlFor="env-create-fallback">Fallback</label>
                <select
                  id="env-create-fallback"
                  value={newFallback}
                  onChange={(e) => setNewFallback(e.target.value)}
                >
                  <option value="">None</option>
                  {environments.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="env-panel__create-btn"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Environment"
        message={deleteMessage}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteOverrides([]);
        }}
      />
    </>
  );
}
