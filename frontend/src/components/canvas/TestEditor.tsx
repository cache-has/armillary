// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { useCallback, useRef, useState } from 'react';
import type { ApiAssertion, ApiColumnInfo, TestSeverity } from '../../api/pipelines';
import {
  ASSERTION_KINDS,
  ASSERTION_LABELS,
  defaultAssertion,
  type AssertionKind,
} from '../../api/pipelines';
import './test-editor.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InputSchema {
  nodeName: string;
  columns: ApiColumnInfo[];
}

interface TestEditorProps {
  severity: TestSeverity;
  assertions: ApiAssertion[];
  maxViolationsReported: number;
  inputSchemas: InputSchema[];
  onSeverityChange: (s: TestSeverity) => void;
  onAssertionsChange: (a: ApiAssertion[]) => void;
  onMaxViolationsChange: (n: number) => void;
}

// ---------------------------------------------------------------------------
// Column picker (shared by multi-column and single-column assertions)
// ---------------------------------------------------------------------------

function ColumnChips({
  selected,
  available,
  onChange,
}: {
  selected: string[];
  available: ApiColumnInfo[];
  onChange: (cols: string[]) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unselected = available.filter((c) => !selected.includes(c.name));

  return (
    <div className="test-editor__chips" ref={wrapRef}>
      {selected.map((col) => (
        <span key={col} className="test-editor__chip">
          {col}
          <button
            className="test-editor__chip-remove"
            onClick={() => onChange(selected.filter((c) => c !== col))}
            aria-label={`Remove ${col}`}
          >
            &times;
          </button>
        </span>
      ))}
      <div style={{ position: 'relative' }}>
        <button
          className="test-editor__chip-add"
          onClick={() => setShowDropdown(!showDropdown)}
          title="Add column"
        >
          + add
        </button>
        {showDropdown && unselected.length > 0 && (
          <div className="test-editor__col-dropdown">
            {unselected.map((col) => (
              <button
                key={col.name}
                className="test-editor__col-option"
                onClick={() => {
                  onChange([...selected, col.name]);
                  setShowDropdown(false);
                }}
              >
                {col.name}
                <span className="test-editor__col-type">{col.data_type}</span>
              </button>
            ))}
          </div>
        )}
        {showDropdown && unselected.length === 0 && (
          <div className="test-editor__col-dropdown">
            <span className="test-editor__col-option" style={{ color: 'var(--text)' }}>
              No more columns
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleColumnSelect({
  value,
  available,
  onChange,
}: {
  value: string;
  available: ApiColumnInfo[];
  onChange: (col: string) => void;
}) {
  return (
    <select
      className="test-editor__select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select column...</option>
      {available.map((col) => (
        <option key={col.name} value={col.name}>
          {col.name} ({col.data_type})
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Per-assertion form body
// ---------------------------------------------------------------------------

function AssertionFields({
  assertion,
  columns,
  onChange,
}: {
  assertion: ApiAssertion;
  columns: ApiColumnInfo[];
  onChange: (a: ApiAssertion) => void;
}) {
  switch (assertion.kind) {
    case 'not_null':
      return (
        <div className="test-editor__field">
          <span className="test-editor__label">Columns</span>
          <ColumnChips
            selected={assertion.columns}
            available={columns}
            onChange={(cols) => onChange({ ...assertion, columns: cols })}
          />
        </div>
      );

    case 'unique':
      return (
        <div className="test-editor__field">
          <span className="test-editor__label">Columns (composite key)</span>
          <ColumnChips
            selected={assertion.columns}
            available={columns}
            onChange={(cols) => onChange({ ...assertion, columns: cols })}
          />
        </div>
      );

    case 'accepted_values':
      return (
        <>
          <div className="test-editor__field">
            <span className="test-editor__label">Column</span>
            <SingleColumnSelect
              value={assertion.column}
              available={columns}
              onChange={(col) => onChange({ ...assertion, column: col })}
            />
          </div>
          <div className="test-editor__field">
            <span className="test-editor__label">
              Accepted values (comma-separated)
            </span>
            <input
              className="test-editor__input test-editor__input--wide"
              value={assertion.values.join(', ')}
              onChange={(e) => {
                const vals = e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter((v) => v.length > 0);
                onChange({ ...assertion, values: vals });
              }}
              placeholder="value1, value2, value3"
            />
          </div>
        </>
      );

    case 'row_count_between':
      return (
        <div className="test-editor__row">
          <div className="test-editor__field test-editor__field--flex">
            <span className="test-editor__label">Min</span>
            <input
              className="test-editor__input"
              type="number"
              min={0}
              value={assertion.min}
              onChange={(e) =>
                onChange({ ...assertion, min: Number(e.target.value) })
              }
            />
          </div>
          <div className="test-editor__field test-editor__field--flex">
            <span className="test-editor__label">Max</span>
            <input
              className="test-editor__input"
              type="number"
              min={0}
              value={assertion.max}
              onChange={(e) =>
                onChange({ ...assertion, max: Number(e.target.value) })
              }
            />
          </div>
        </div>
      );

    case 'row_count_equal_to':
      return (
        <div className="test-editor__field">
          <span className="test-editor__label">Expected count</span>
          <input
            className="test-editor__input"
            type="number"
            min={0}
            value={assertion.count}
            onChange={(e) =>
              onChange({ ...assertion, count: Number(e.target.value) })
            }
          />
        </div>
      );

    case 'no_duplicates':
      return (
        <span className="test-editor__hint">
          Checks that all rows are unique across all columns.
        </span>
      );

    case 'column_values_match_regex':
      return (
        <>
          <div className="test-editor__field">
            <span className="test-editor__label">Column</span>
            <SingleColumnSelect
              value={assertion.column}
              available={columns}
              onChange={(col) => onChange({ ...assertion, column: col })}
            />
          </div>
          <div className="test-editor__field">
            <span className="test-editor__label">Regex pattern</span>
            <input
              className="test-editor__input test-editor__input--wide"
              value={assertion.pattern}
              onChange={(e) =>
                onChange({ ...assertion, pattern: e.target.value })
              }
              placeholder="^[A-Z]{2}-\\d+$"
            />
          </div>
        </>
      );

    case 'expression_true':
      return (
        <div className="test-editor__field">
          <span className="test-editor__label">SQL expression (must be true for every row)</span>
          <textarea
            className="test-editor__textarea"
            value={assertion.expression}
            onChange={(e) =>
              onChange({ ...assertion, expression: e.target.value })
            }
            placeholder="amount > 0 AND status IS NOT NULL"
          />
        </div>
      );

    case 'sql':
      return (
        <>
          <div className="test-editor__field">
            <span className="test-editor__label">Name</span>
            <input
              className="test-editor__input test-editor__input--wide"
              value={assertion.name}
              onChange={(e) =>
                onChange({ ...assertion, name: e.target.value })
              }
              placeholder="custom_check"
            />
          </div>
          <div className="test-editor__field">
            <span className="test-editor__label">Query (must return a `failing` count; 0 = pass)</span>
            <textarea
              className="test-editor__textarea"
              value={assertion.query}
              onChange={(e) =>
                onChange({ ...assertion, query: e.target.value })
              }
              placeholder="SELECT COUNT(*) AS failing FROM ${input} WHERE ..."
              rows={4}
            />
            <span className="test-editor__hint">
              Use {'${input}'} to reference the upstream data.
            </span>
          </div>
        </>
      );
  }
}

// ---------------------------------------------------------------------------
// TestEditor
// ---------------------------------------------------------------------------

export function TestEditor({
  severity,
  assertions,
  maxViolationsReported,
  inputSchemas,
  onSeverityChange,
  onAssertionsChange,
  onMaxViolationsChange,
}: TestEditorProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Merge all upstream columns for autocomplete
  const allColumns: ApiColumnInfo[] = inputSchemas.flatMap((s) => s.columns);

  const handleAddAssertion = useCallback(
    (kind: AssertionKind) => {
      onAssertionsChange([...assertions, defaultAssertion(kind)]);
      setAddMenuOpen(false);
    },
    [assertions, onAssertionsChange],
  );

  const handleRemoveAssertion = useCallback(
    (index: number) => {
      onAssertionsChange(assertions.filter((_, i) => i !== index));
    },
    [assertions, onAssertionsChange],
  );

  const handleUpdateAssertion = useCallback(
    (index: number, updated: ApiAssertion) => {
      const next = [...assertions];
      next[index] = updated;
      onAssertionsChange(next);
    },
    [assertions, onAssertionsChange],
  );

  return (
    <div className="test-editor">
      {/* Settings */}
      <div className="test-editor__section">
        <div className="test-editor__section-title">Settings</div>
        <div className="test-editor__row">
          <div className="test-editor__field test-editor__field--flex">
            <span className="test-editor__label">Severity</span>
            <select
              className="test-editor__select"
              value={severity}
              onChange={(e) => onSeverityChange(e.target.value as TestSeverity)}
            >
              <option value="error">Error (fails pipeline)</option>
              <option value="warn">Warn (logs but continues)</option>
            </select>
          </div>
          <div className="test-editor__field">
            <span className="test-editor__label">Max violations reported</span>
            <input
              className="test-editor__input"
              type="number"
              min={1}
              max={1000}
              value={maxViolationsReported}
              onChange={(e) => onMaxViolationsChange(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Upstream schema summary */}
      {inputSchemas.length > 0 && (
        <div className="test-editor__section">
          <div className="test-editor__section-title">
            Upstream Schema
          </div>
          {inputSchemas.map((schema) => (
            <div key={schema.nodeName} style={{ fontSize: 12 }}>
              <strong>{schema.nodeName}</strong>:{' '}
              {schema.columns.map((c) => c.name).join(', ')}
            </div>
          ))}
        </div>
      )}

      {/* Assertions */}
      <div className="test-editor__section">
        <div className="test-editor__section-title">Assertions</div>

        {assertions.length === 0 && (
          <span className="test-editor__empty">
            No assertions yet. Add one below.
          </span>
        )}

        <div className="test-editor__assertions">
          {assertions.map((assertion, i) => (
            <div key={i} className="test-editor__assertion-card">
              <div className="test-editor__assertion-header">
                <span className="test-editor__assertion-kind">
                  {ASSERTION_LABELS[assertion.kind]}
                </span>
                <button
                  className="test-editor__remove-btn"
                  onClick={() => handleRemoveAssertion(i)}
                  title="Remove assertion"
                >
                  &times;
                </button>
              </div>
              <div className="test-editor__assertion-body">
                <AssertionFields
                  assertion={assertion}
                  columns={allColumns}
                  onChange={(a) => handleUpdateAssertion(i, a)}
                />
              </div>
            </div>
          ))}
        </div>

        <div ref={addRef} style={{ position: 'relative' }}>
          <button
            className="test-editor__add-btn"
            onClick={() => setAddMenuOpen(!addMenuOpen)}
          >
            + Add Assertion
          </button>
          {addMenuOpen && (
            <div className="test-editor__col-dropdown" style={{ marginTop: 4 }}>
              {ASSERTION_KINDS.map((kind) => (
                <button
                  key={kind}
                  className="test-editor__col-option"
                  onClick={() => handleAddAssertion(kind)}
                >
                  {ASSERTION_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
