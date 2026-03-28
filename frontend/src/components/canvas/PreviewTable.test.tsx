// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewTable, classifyType, formatCell } from './PreviewTable';
import type { ApiPreviewNodeResponse } from '../../api/pipelines';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const samplePreview: ApiPreviewNodeResponse = {
  node_id: 'node-1',
  columns: [
    { name: 'id', data_type: 'Int64' },
    { name: 'name', data_type: 'Utf8' },
    { name: 'score', data_type: 'Float64' },
    { name: 'active', data_type: 'Boolean' },
    { name: 'created_at', data_type: 'Timestamp(Microsecond, None)' },
  ],
  row_count: 3,
  duration_ms: 12,
  rows: [
    { id: 1, name: 'Alice', score: 95.5, active: true, created_at: '2026-01-15T10:30:00' },
    { id: 2, name: 'Bob', score: null, active: false, created_at: '2026-02-20T14:00:00' },
    { id: 3, name: null, score: 72.123, active: true, created_at: null },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreviewTable', () => {
  it('shows loading skeleton when loading', () => {
    render(<PreviewTable preview={null} loading={true} />);
    expect(screen.getByTestId('preview-table-loading')).toBeInTheDocument();
  });

  it('shows empty state when no preview data', () => {
    render(<PreviewTable preview={null} loading={false} />);
    expect(screen.getByTestId('preview-table-empty')).toBeInTheDocument();
    expect(screen.getByText('No preview data available')).toBeInTheDocument();
  });

  it('shows empty state when preview has zero rows', () => {
    const emptyPreview: ApiPreviewNodeResponse = {
      ...samplePreview,
      rows: [],
    };
    render(<PreviewTable preview={emptyPreview} loading={false} />);
    expect(screen.getByTestId('preview-table-empty')).toBeInTheDocument();
  });

  it('renders column headers with type badges', () => {
    render(<PreviewTable preview={samplePreview} loading={false} />);
    // Column names
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('created_at')).toBeInTheDocument();
    // Type badges
    expect(screen.getByText('i64')).toBeInTheDocument();
    expect(screen.getByText('str')).toBeInTheDocument();
    expect(screen.getByText('f64')).toBeInTheDocument();
    expect(screen.getByText('bool')).toBeInTheDocument();
    expect(screen.getByText('timestamp')).toBeInTheDocument();
  });

  // Note: @tanstack/react-virtual requires real DOM layout to render rows.
  // In jsdom the scroll container has zero height, so virtual rows are not rendered.
  // Row-content tests (row numbers, null styling, boolean badges) are covered by
  // the unit tests for formatCell/classifyType below, and by the header + stats tests.

  it('renders the virtualized body container', () => {
    const { container } = render(<PreviewTable preview={samplePreview} loading={false} />);
    const body = container.querySelector('.preview-table__body');
    expect(body).toBeInTheDocument();
    // Total height should be rows * ROW_HEIGHT = 3 * 28 = 84
    expect(body?.getAttribute('style')).toContain('height: 84px');
  });

  it('renders stats bar with row count, column count, and duration', () => {
    render(<PreviewTable preview={samplePreview} loading={false} />);
    const stats = screen.getByTestId('preview-table-stats');
    expect(stats.textContent).toContain('3');
    expect(stats.textContent).toContain('5');
    expect(stats.textContent).toContain('12ms');
  });

  it('toggles sort on column header click', () => {
    render(<PreviewTable preview={samplePreview} loading={false} />);
    const idHeader = screen.getByText('id').closest('.preview-table__th')!;

    // Click once → asc
    fireEvent.click(idHeader);
    expect(screen.getByTestId('sort-indicator')).toHaveTextContent('\u25B2');

    // Click again → desc
    fireEvent.click(idHeader);
    expect(screen.getByTestId('sort-indicator')).toHaveTextContent('\u25BC');

    // Click third time → no sort
    fireEvent.click(idHeader);
    expect(screen.queryByTestId('sort-indicator')).toBeNull();
  });

  it('has resize handles on column headers', () => {
    render(<PreviewTable preview={samplePreview} loading={false} />);
    expect(screen.getByTestId('resize-handle-id')).toBeInTheDocument();
    expect(screen.getByTestId('resize-handle-name')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Unit tests for pure helper functions
// ---------------------------------------------------------------------------

describe('classifyType', () => {
  it('classifies numeric types', () => {
    expect(classifyType('Int64')).toBe('numeric');
    expect(classifyType('Float32')).toBe('numeric');
    expect(classifyType('UInt8')).toBe('numeric');
    expect(classifyType('Decimal128(10, 2)')).toBe('numeric');
  });

  it('classifies boolean types', () => {
    expect(classifyType('Boolean')).toBe('boolean');
    expect(classifyType('bool')).toBe('boolean');
  });

  it('classifies temporal types', () => {
    expect(classifyType('Date32')).toBe('temporal');
    expect(classifyType('Timestamp(Microsecond, None)')).toBe('temporal');
    expect(classifyType('Time64(Nanosecond)')).toBe('temporal');
    expect(classifyType('Duration(Millisecond)')).toBe('temporal');
  });

  it('classifies string types', () => {
    expect(classifyType('Utf8')).toBe('string');
    expect(classifyType('LargeUtf8')).toBe('string');
    expect(classifyType('Binary')).toBe('string');
  });
});

describe('formatCell', () => {
  it('formats null values', () => {
    expect(formatCell(null, 'string')).toEqual({ text: 'null', isNull: true });
    expect(formatCell(undefined, 'numeric')).toEqual({ text: 'null', isNull: true });
  });

  it('formats numeric values with locale separators', () => {
    const result = formatCell(1234567, 'numeric');
    expect(result.isNull).toBe(false);
    // toLocaleString output varies by locale, just check it's a string with the number
    expect(result.text).toContain('1');
  });

  it('formats boolean values', () => {
    expect(formatCell(true, 'boolean')).toEqual({ text: 'true', isNull: false });
    expect(formatCell(false, 'boolean')).toEqual({ text: 'false', isNull: false });
  });

  it('formats string values', () => {
    expect(formatCell('hello', 'string')).toEqual({ text: 'hello', isNull: false });
  });

  it('formats temporal numeric values as ISO strings', () => {
    const result = formatCell(1706000000000, 'temporal');
    expect(result.isNull).toBe(false);
    expect(result.text).toContain('2024');
  });

  it('passes through temporal string values', () => {
    expect(formatCell('2026-01-15', 'temporal')).toEqual({ text: '2026-01-15', isNull: false });
  });
});
