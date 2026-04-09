// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SnippetGroupNode } from '../../types/pipeline';
import { usePipelineStore } from '../../stores/pipelineStore';
import './SnippetGroupNode.css';

/**
 * A collapsed-snippet placeholder. Renders one box per snippet call site,
 * regardless of how many inner nodes the snippet expanded to. Click to
 * expand back into the constituent nodes (which then render flat on the
 * canvas, with their original namespaced IDs).
 */
export const SnippetGroupNodeComponent = memo(function SnippetGroupNodeComponent({
  data,
}: NodeProps<SnippetGroupNode>) {
  const toggle = usePipelineStore((s) => s.toggleSnippetGroup);
  const childCount = data.childIds.length;
  return (
    <div
      className="snippet-group-node"
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggle(data.callSiteId);
      }}
      title={`Snippet "${data.snippetName}" — ${childCount} node${childCount === 1 ? '' : 's'}. Double-click to expand.`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="snippet-group-node__header">
        <span className="snippet-group-node__icon">{'\u25C6'}</span>
        <span className="snippet-group-node__name">{data.snippetName}</span>
      </div>
      <div className="snippet-group-node__meta">
        <span className="snippet-group-node__call-site">{data.callSiteId}</span>
        <span className="snippet-group-node__count">{childCount} nodes</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
