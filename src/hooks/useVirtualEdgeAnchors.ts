import { useMemo } from 'react';
import { useNodes } from '@xyflow/react';
import { useDiagramStore } from '../store/diagramStore';
import { NODE_SIZE_DEFAULTS } from '../core/nodeSizeConfig';
import { computeVirtualAnchors, type NodeRect, type EdgeInfo, type VirtualEdgeAnchor } from '../core/virtualEdgeAnchors';
import type { NodeShape } from '../core/types';

/**
 * Hook that computes virtual edge anchor positions for all edges.
 *
 * Reads:
 *   - React Flow internal nodes → real-time positions (updated during drag)
 *   - Zustand canonical edges   → topology and handle assignments
 *
 * Returns a Record<edgeId, VirtualEdgeAnchor> consumed by CustomEdge
 * via VirtualAnchorsContext.
 *
 * Must be called inside the ReactFlowProvider scope.
 */
export function useVirtualEdgeAnchors(): Record<string, VirtualEdgeAnchor> {
  // Real-time node positions from React Flow's internal store
  const rfNodes = useNodes();

  // Canonical edges from the diagram store (topology + handles)
  const canonicalEdges = useDiagramStore((s) => s.diagram.edges);

  return useMemo(() => {
    // Build NodeRect map from React Flow nodes
    const nodeRects = new Map<string, NodeRect>();

    for (const rfNode of rfNodes) {
      // Skip non-diagram nodes (e.g. textBoxes are not connectable)
      if (rfNode.type !== 'customNode') continue;

      const shape = (rfNode.data?.shape as NodeShape) || 'process';
      const sizeDefaults = NODE_SIZE_DEFAULTS[shape] ?? NODE_SIZE_DEFAULTS.process;

      // Prefer explicit dimensions from data, fall back to measured, then defaults
      const width = (rfNode.data?.width as number | undefined)
        ?? rfNode.measured?.width
        ?? sizeDefaults.width;
      const height = (rfNode.data?.height as number | undefined)
        ?? rfNode.measured?.height
        ?? sizeDefaults.height;

      // Skip nodes without valid position or dimensions
      if (!rfNode.position || width <= 0 || height <= 0) continue;

      nodeRects.set(rfNode.id, {
        x: rfNode.position.x,
        y: rfNode.position.y,
        width,
        height,
      });
    }

    // Build EdgeInfo array from canonical edges
    const edgeInfos: EdgeInfo[] = canonicalEdges.map((e) => {
      const sourceId = e.from.kind === 'connected' ? e.from.nodeId : `ghostAnchor__${e.id}__from`;
      const targetId = e.to.kind === 'connected' ? e.to.nodeId : `ghostAnchor__${e.id}__to`;
      const sourceHandle = e.from.kind === 'connected' ? (e.from.handleId ?? undefined) : undefined;
      const targetHandle = e.to.kind === 'connected' ? (e.to.handleId ?? undefined) : undefined;
      return {
        id: e.id,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      };
    });

    return computeVirtualAnchors(nodeRects, edgeInfos);
  }, [rfNodes, canonicalEdges]);
}
