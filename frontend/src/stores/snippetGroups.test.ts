// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { describe, it, expect } from 'vitest';
import { computeCanvasView, listSnippetGroupIds } from './snippetGroups';
import type { PipelineNode, PipelineEdge } from '../types/pipeline';

function n(
  id: string,
  x: number,
  y: number,
  parent?: string,
  snippetName?: string,
): PipelineNode {
  return {
    id,
    type: 'pipeline',
    position: { x, y },
    data: {
      label: id,
      role: 'transform',
      status: 'idle',
      pinnedPosition: false,
      envOverridden: false,
      snippetParent: parent,
      snippetName,
    },
  };
}

function e(source: string, target: string): PipelineEdge {
  return { id: `e-${source}-${target}`, source, target, type: 'pipeline' };
}

describe('snippetGroups', () => {
  it('listSnippetGroupIds returns unique parent ids', () => {
    const nodes = [
      n('a', 0, 0),
      n('g.x', 1, 1, 'g', 'std'),
      n('g.y', 2, 2, 'g', 'std'),
      n('h.z', 3, 3, 'h', 'other'),
    ];
    expect(new Set(listSnippetGroupIds(nodes))).toEqual(new Set(['g', 'h']));
  });

  it('passes nodes through unchanged when nothing is collapsed', () => {
    const nodes = [n('a', 0, 0), n('g.x', 1, 1, 'g', 'std')];
    const edges = [e('a', 'g.x')];
    const out = computeCanvasView(nodes, edges, new Set());
    expect(out.nodes).toBe(nodes);
    expect(out.edges).toBe(edges);
  });

  it('collapses a group into a single placeholder positioned at the centroid', () => {
    const nodes = [
      n('src', 0, 0),
      n('g.a', 10, 20, 'g', 'std'),
      n('g.b', 30, 40, 'g', 'std'),
      n('sink', 100, 100),
    ];
    const edges = [
      e('src', 'g.a'),
      e('g.a', 'g.b'),
      e('g.b', 'sink'),
    ];
    const out = computeCanvasView(nodes, edges, new Set(['g']));
    // Hidden children replaced by one group node
    const ids = out.nodes.map((node) => node.id).sort();
    expect(ids).toEqual(['g', 'sink', 'src']);
    const group = out.nodes.find((node) => node.id === 'g');
    expect(group?.type).toBe('snippetGroup');
    expect(group?.position).toEqual({ x: 20, y: 30 });
    // Edges rerouted: src→g.a becomes src→g, g.b→sink becomes g→sink,
    // g.a→g.b (intra-group) is dropped.
    const eKeys = out.edges.map((edge) => `${edge.source}->${edge.target}`).sort();
    expect(eKeys).toEqual(['g->sink', 'src->g']);
  });

  it('dedupes rerouted edges that collapse onto the same pair', () => {
    const nodes = [
      n('src', 0, 0),
      n('g.a', 1, 1, 'g', 'std'),
      n('g.b', 2, 2, 'g', 'std'),
    ];
    const edges = [e('src', 'g.a'), e('src', 'g.b')];
    const out = computeCanvasView(nodes, edges, new Set(['g']));
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].source).toBe('src');
    expect(out.edges[0].target).toBe('g');
  });
});
