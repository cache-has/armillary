// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

/**
 * Snippet-group materialization for the canvas.
 *
 * The store always holds the FULL set of expanded pipeline nodes (one per
 * inner node of every snippet call). For rendering, we collapse each snippet
 * call into a single placeholder node by:
 *
 *   1. Synthesizing one `snippetGroup` node per call-site whose `collapsed`
 *      flag is set, positioned at the centroid of its children.
 *   2. Filtering out the children of collapsed groups.
 *   3. Rewriting edges that cross a group boundary so they point at the group
 *      node instead of the hidden child. Intra-group edges are dropped.
 *
 * The result is what the canvas renders. Saving still uses the raw, unfiltered
 * arrays — provenance fields round-trip on the backend, so the next load
 * reproduces the same groups.
 */

import type {
  CanvasNode,
  PipelineEdge,
  PipelineNode,
  SnippetGroupNode,
} from '../types/pipeline';

export interface CanvasView {
  nodes: CanvasNode[];
  edges: PipelineEdge[];
}

/** Group children of a collapsed snippet group by their `snippetParent` id. */
function groupChildren(nodes: PipelineNode[]): Map<string, PipelineNode[]> {
  const out = new Map<string, PipelineNode[]>();
  for (const n of nodes) {
    const parent = n.data.snippetParent;
    if (!parent) continue;
    const arr = out.get(parent);
    if (arr) arr.push(n);
    else out.set(parent, [n]);
  }
  return out;
}

/** All distinct snippet-group call-site IDs present in `nodes`. */
export function listSnippetGroupIds(nodes: PipelineNode[]): string[] {
  const seen = new Set<string>();
  for (const n of nodes) {
    if (n.data.snippetParent) seen.add(n.data.snippetParent);
  }
  return [...seen];
}

/** Synthesize a single group node at the centroid of its children. */
function makeGroupNode(
  callSiteId: string,
  children: PipelineNode[],
): SnippetGroupNode {
  const cx =
    children.reduce((s, c) => s + c.position.x, 0) / Math.max(children.length, 1);
  const cy =
    children.reduce((s, c) => s + c.position.y, 0) / Math.max(children.length, 1);
  const snippetName = children[0]?.data.snippetName ?? callSiteId;
  return {
    id: callSiteId,
    type: 'snippetGroup',
    position: { x: cx, y: cy },
    draggable: false,
    data: {
      snippetName,
      callSiteId,
      childIds: children.map((c) => c.id),
      collapsed: true,
    },
  };
}

/**
 * Compute the canvas view (nodes + edges) by collapsing the listed snippet
 * groups. `collapsed` is the set of call-site IDs that should appear as a
 * single group node.
 */
export function computeCanvasView(
  rawNodes: PipelineNode[],
  rawEdges: PipelineEdge[],
  collapsed: ReadonlySet<string>,
): CanvasView {
  if (collapsed.size === 0) {
    return { nodes: rawNodes, edges: rawEdges };
  }

  const groups = groupChildren(rawNodes);
  // Map every hidden child id → its group id (only for collapsed groups).
  const childToGroup = new Map<string, string>();
  for (const [callSiteId, children] of groups) {
    if (!collapsed.has(callSiteId)) continue;
    for (const c of children) childToGroup.set(c.id, callSiteId);
  }

  // Filter out hidden children, then append synthetic group nodes.
  const visible: CanvasNode[] = rawNodes.filter((n) => !childToGroup.has(n.id));
  for (const callSiteId of collapsed) {
    const children = groups.get(callSiteId);
    if (!children || children.length === 0) continue;
    visible.push(makeGroupNode(callSiteId, children));
  }

  // Reroute edges. Drop intra-group edges; rewrite boundary edges to the
  // group id; dedupe by `${source}->${target}`.
  const seen = new Set<string>();
  const edges: PipelineEdge[] = [];
  for (const e of rawEdges) {
    const sg = childToGroup.get(e.source);
    const tg = childToGroup.get(e.target);
    if (sg && tg && sg === tg) continue; // intra-group
    const newSource = sg ?? e.source;
    const newTarget = tg ?? e.target;
    const key = `${newSource}->${newTarget}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (newSource === e.source && newTarget === e.target) {
      edges.push(e);
    } else {
      edges.push({ ...e, id: `e-${newSource}-${newTarget}`, source: newSource, target: newTarget });
    }
  }

  return { nodes: visible, edges };
}
