/**
 * Virtual Edge Anchors — Pure, deterministic computation layer.
 *
 * When multiple edges connect to the same side of a node, they all share
 * the same centered handle position in React Flow, causing visual overlap.
 * This module computes "virtual anchor points" distributed evenly along
 * the side, matching Mermaid.js rendering behavior.
 *
 * No React or DOM dependencies — pure functions only.
 */

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type Side = 'top' | 'right' | 'bottom' | 'left';

export type VirtualEdgeAnchor = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceSide: Side;
  targetSide: Side;
  sourceRatio: number;
  targetRatio: number;
};

/**
 * Absolute top-left corner in React Flow canvas coordinates.
 * React Flow stores `node.position` as top-left; we use the same convention.
 */
export type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EdgeInfo = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum margin from the corners of a node side (10% on each end). */
export const ANCHOR_MARGIN_RATIO = 0.10;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Compute the center point from a top-left NodeRect. */
export function getNodeCenter(rect: NodeRect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Resolve side from a handle ID as defined in CustomNode.tsx.
 *
 * Handle IDs follow the pattern: `{t|r|b|l}-{source|target}`
 *   - 't-source', 't-target' → 'top'
 *   - 'r-source', 'r-target' → 'right'
 *   - 'b-source', 'b-target' → 'bottom'
 *   - 'l-source', 'l-target' → 'left'
 *
 * Returns null for undefined or unrecognized IDs.
 */
export function sideFromHandle(handleId?: string): Side | null {
  if (!handleId) return null;

  if (handleId.startsWith('t-')) return 'top';
  if (handleId.startsWith('r-')) return 'right';
  if (handleId.startsWith('b-')) return 'bottom';
  if (handleId.startsWith('l-')) return 'left';

  return null;
}

// ---------------------------------------------------------------------------
// Geometric fallback
// ---------------------------------------------------------------------------

/**
 * Determine the source and target side based on relative node positions.
 * Used when handle IDs are missing or unrecognized.
 *
 * Rule:
 *   dx = targetCenter.x - sourceCenter.x
 *   dy = targetCenter.y - sourceCenter.y
 *   if abs(dx) > abs(dy)  → horizontal dominant
 *     source side = dx >= 0 ? 'right' : 'left'
 *     target side = dx >= 0 ? 'left'  : 'right'
 *   else                  → vertical dominant
 *     source side = dy >= 0 ? 'bottom' : 'top'
 *     target side = dy >= 0 ? 'top'    : 'bottom'
 */
function geometricSides(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): { sourceSide: Side; targetSide: Side } {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  } else {
    return dy >= 0
      ? { sourceSide: 'bottom', targetSide: 'top' }
      : { sourceSide: 'top', targetSide: 'bottom' };
  }
}

// ---------------------------------------------------------------------------
// Ratio → absolute coordinate conversion
// ---------------------------------------------------------------------------

function anchorCoordinate(rect: NodeRect, side: Side, ratio: number): { x: number; y: number } {
  switch (side) {
    case 'left':
      return { x: rect.x, y: rect.y + ratio * rect.height };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + ratio * rect.height };
    case 'top':
      return { x: rect.x + ratio * rect.width, y: rect.y };
    case 'bottom':
      return { x: rect.x + ratio * rect.width, y: rect.y + rect.height };
  }
}

// ---------------------------------------------------------------------------
// Grouping key
// ---------------------------------------------------------------------------

/** Unique key for grouping edges by (nodeId, side, endpoint role). */
type EndpointKey = string; // e.g. "nodeA:left:target"

function makeEndpointKey(nodeId: string, side: Side, role: 'source' | 'target'): EndpointKey {
  return `${nodeId}:${side}:${role}`;
}

// ---------------------------------------------------------------------------
// Internal edge data with resolved sides
// ---------------------------------------------------------------------------

interface ResolvedEdge {
  id: string;
  source: string;
  target: string;
  sourceSide: Side;
  targetSide: Side;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute virtual anchor coordinates for all eligible edges.
 *
 * Pure, deterministic. Output is independent of input edge array ordering.
 *
 * Exclusions (no VirtualEdgeAnchor produced, CustomEdge falls back to RF defaults):
 *   - Self-loops (source === target)
 *   - Edges referencing missing or zero-dimension NodeRects
 */
export function computeVirtualAnchors(
  nodeRects: Map<string, NodeRect>,
  edges: EdgeInfo[],
): Record<string, VirtualEdgeAnchor> {
  const result: Record<string, VirtualEdgeAnchor> = {};

  // 1. Resolve sides for each eligible edge
  const resolvedEdges: ResolvedEdge[] = [];

  for (const edge of edges) {
    // Skip self-loops
    if (edge.source === edge.target) continue;

    const sourceRect = nodeRects.get(edge.source);
    const targetRect = nodeRects.get(edge.target);

    // Skip edges with missing or zero-dimension nodes
    if (!sourceRect || !targetRect) continue;
    if (sourceRect.width <= 0 || sourceRect.height <= 0) continue;
    if (targetRect.width <= 0 || targetRect.height <= 0) continue;

    // Resolve sides from handles, with geometric fallback
    let sourceSide = sideFromHandle(edge.sourceHandle);
    let targetSide = sideFromHandle(edge.targetHandle);

    if (sourceSide === null || targetSide === null) {
      const sourceCenter = getNodeCenter(sourceRect);
      const targetCenter = getNodeCenter(targetRect);
      const geo = geometricSides(sourceCenter, targetCenter);
      if (sourceSide === null) sourceSide = geo.sourceSide;
      if (targetSide === null) targetSide = geo.targetSide;
    }

    resolvedEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceSide,
      targetSide,
    });
  }

  // 2. Group edges by endpoint (nodeId + side + role)
  //    Each edge appears in two groups: once as source endpoint, once as target endpoint.
  const groups = new Map<EndpointKey, ResolvedEdge[]>();

  for (const re of resolvedEdges) {
    const sourceKey = makeEndpointKey(re.source, re.sourceSide, 'source');
    const targetKey = makeEndpointKey(re.target, re.targetSide, 'target');

    if (!groups.has(sourceKey)) groups.set(sourceKey, []);
    groups.get(sourceKey)!.push(re);

    if (!groups.has(targetKey)) groups.set(targetKey, []);
    groups.get(targetKey)!.push(re);
  }

  // 3. For each group, sort and assign ratios
  //    Track per-edge per-endpoint ratio assignments
  const sourceRatios = new Map<string, number>(); // edgeId → source ratio
  const targetRatios = new Map<string, number>(); // edgeId → target ratio
  const sourceSidesMap = new Map<string, Side>();
  const targetSidesMap = new Map<string, Side>();

  for (const [key, group] of groups.entries()) {
    // Parse the key to determine sort axis
    const parts = key.split(':');
    const side = parts[1] as Side;
    const role = parts[2] as 'source' | 'target';

    // Sort by position of the opposite endpoint
    const sortedGroup = [...group].sort((a, b) => {
      // Determine the opposite node for each edge in this group
      const aOppositeId = role === 'source' ? a.target : a.source;
      const bOppositeId = role === 'source' ? b.target : b.source;

      const aOppositeRect = nodeRects.get(aOppositeId);
      const bOppositeRect = nodeRects.get(bOppositeId);

      // If a rect is missing, push to end
      if (!aOppositeRect && !bOppositeRect) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      if (!aOppositeRect) return 1;
      if (!bOppositeRect) return -1;

      const aCenter = getNodeCenter(aOppositeRect);
      const bCenter = getNodeCenter(bOppositeRect);

      if (side === 'left' || side === 'right') {
        // Sort by centerY, tie-break centerX, then edge.id
        if (aCenter.y !== bCenter.y) return aCenter.y - bCenter.y;
        if (aCenter.x !== bCenter.x) return aCenter.x - bCenter.x;
      } else {
        // top or bottom: sort by centerX, tie-break centerY, then edge.id
        if (aCenter.x !== bCenter.x) return aCenter.x - bCenter.x;
        if (aCenter.y !== bCenter.y) return aCenter.y - bCenter.y;
      }

      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    // Assign ratios within the usable range [margin, 1-margin]
    const count = sortedGroup.length;
    for (let i = 0; i < count; i++) {
      const ratio = ANCHOR_MARGIN_RATIO + (i + 1) * (1 - 2 * ANCHOR_MARGIN_RATIO) / (count + 1);
      const edgeId = sortedGroup[i].id;

      if (role === 'source') {
        sourceRatios.set(edgeId, ratio);
        sourceSidesMap.set(edgeId, side);
      } else {
        targetRatios.set(edgeId, ratio);
        targetSidesMap.set(edgeId, side);
      }
    }
  }

  // 4. Compute final coordinates for each resolved edge
  for (const re of resolvedEdges) {
    const sRatio = sourceRatios.get(re.id);
    const tRatio = targetRatios.get(re.id);
    const sSide = sourceSidesMap.get(re.id);
    const tSide = targetSidesMap.get(re.id);

    // Should always be defined at this point, but guard anyway
    if (sRatio === undefined || tRatio === undefined || !sSide || !tSide) continue;

    const sourceRect = nodeRects.get(re.source)!;
    const targetRect = nodeRects.get(re.target)!;

    const sourceCoord = anchorCoordinate(sourceRect, sSide, sRatio);
    const targetCoord = anchorCoordinate(targetRect, tSide, tRatio);

    result[re.id] = {
      sourceX: sourceCoord.x,
      sourceY: sourceCoord.y,
      targetX: targetCoord.x,
      targetY: targetCoord.y,
      sourceSide: sSide,
      targetSide: tSide,
      sourceRatio: sRatio,
      targetRatio: tRatio,
    };
  }

  return result;
}
