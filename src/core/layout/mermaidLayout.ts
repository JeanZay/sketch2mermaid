/**
 * Mermaid-like layout engine using @dagrejs/dagre.
 *
 * Dagre is the same layout engine that Mermaid.js uses internally,
 * so "Mermaid-like" layout is achieved literally, not approximately.
 *
 * This module is a pure function: deterministic for a given input,
 * no DOM or React dependencies. The engine is isolated behind a
 * clean interface so it can be swapped for ELK or a custom Sugiyama
 * implementation without touching the rest of the codebase.
 */
import { Graph, layout } from '@dagrejs/dagre';
import type {
  DiagramNode,
  DiagramEdge,
  DiagramDirection,
  ConnectedEdgeEndpoint,
  DiagramEdgeEndpoint,
  DiagramGroup,
  EdgePoint,
  ImportedEdgeData,
} from '../types';
import { isStructurallyConnectedEdge } from '../types';
import { NODE_SIZE_DEFAULTS } from '../nodeSizeConfig';
import { createImportedEdgeData, createImportedEdgeNodeSnapshot } from '../../utils/importedEdgeRouting';
import {
  USE_MERMAID_LIKE_IMPORTED_LAYOUT,
  MERMAID_LIKE_RANK_SEP,
  MERMAID_LIKE_NODE_SEP,
  MERMAID_LIKE_MARGIN_X,
  MERMAID_LIKE_MARGIN_Y,
  MERMAID_LIKE_LABEL_PADDING,
  MERMAID_LIKE_SAME_RANK_THRESHOLD,
  MERMAID_LIKE_SUBGRAPH_RANK_SEP_EXTRA,
  MERMAID_LIKE_CLUSTER_PADDING,
  MERMAID_LIKE_GROUP_TITLE_HEIGHT,
  GROUP_PADDING,
} from '../config';

// ---------------------------------------------------------------------------
// Label-sizing constants for Dagre edge-label proxies
// ---------------------------------------------------------------------------
// Dagre's `makeSpaceForEdgeLabels` inserts a proxy node for each edge with
// non-zero width/height. We estimate label size deterministically (no
// `measureText`) so layout is environment-stable and reproducible.
//
// Derivation:
//   - LABEL_CHAR_WIDTH = 7 px/char — conservative over-estimate. The true
//     average advance of a 10px sans-serif font is ~5–5.5 px/char. The ~35%
//     safety margin absorbs wide glyphs (W, M, @) and avoids overlap at the
//     cost of slightly generous inter-rank gaps. This is intentional: overlap
//     is a bug, extra whitespace is a cosmetic trade-off. NOT a measured font
//     metric — an empirical safety factor.
//   - LABEL_PADDING_X = 32 px — CSS pill padding (3+8 px/side = 22px) plus
//     visual clearance so the pill doesn't abut a node box.
//   - LABEL_LINE_HEIGHT = 20 px — single-line height including CSS border,
//     padding, and shadow of `.edge-label-container`.
// ---------------------------------------------------------------------------
export const LABEL_CHAR_WIDTH  = 7;
export const LABEL_PADDING_X   = 32;
export const LABEL_LINE_HEIGHT = 20;

// ---------------------------------------------------------------------------
// Graph spacing constants
// ---------------------------------------------------------------------------
// Dagre's `makeSpaceForEdgeLabels` halves `ranksep` internally (→ 30) then
// doubles each labeled edge's `minlen`, so net unlabeled spacing ≈ 60.
// The proxy node's size adds on top for labeled edges.
// ---------------------------------------------------------------------------
export const BASE_RANK_GAP  = 60;
export const BASE_NODE_GAP  = 50;
export const BASE_EDGE_GAP  = 10;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HandlePair {
  sourceHandle: string;
  targetHandle: string;
}

export interface LayoutResult {
  /** Top-left positions for React Flow nodes, keyed by node id. */
  positions: Map<string, { x: number; y: number }>;
  /** Direction-aware handles for React Flow edges, keyed by edge id. */
  handles: Map<string, HandlePair>;
  /** Dagre's computed center coordinates for edge labels, keyed by edge id. */
  edgeLabelPositions?: Map<string, { x: number; y: number }>;
  /** Shape-clipped Dagre routes for imported edges, keyed by edge id. */
  edgeRoutes?: Map<string, ImportedEdgeData>;
  /** Top-left positions for groups, keyed by group id. */
  groupPositions?: Map<string, { x: number; y: number }>;
  /** Sizes for groups, keyed by group id. */
  groupSizes?: Map<string, { width: number; height: number }>;
}

// ---------------------------------------------------------------------------
// Direction → Dagre rankdir mapping
// ---------------------------------------------------------------------------

function toRankdir(direction: DiagramDirection): 'TB' | 'BT' | 'LR' | 'RL' {
  // CanonicalDiagram uses 'TD' where Dagre expects 'TB'
  if (direction === 'TD') return 'TB';
  return direction;
}

// ---------------------------------------------------------------------------
// Default (directional) handle pairs — used only as fallback
// ---------------------------------------------------------------------------

function defaultHandlesForDirection(direction: DiagramDirection): HandlePair {
  switch (direction) {
    case 'LR': return { sourceHandle: 'r-source', targetHandle: 'l-target' };
    case 'RL': return { sourceHandle: 'l-source', targetHandle: 'r-target' };
    case 'BT': return { sourceHandle: 't-source', targetHandle: 'b-target' };
    case 'TD':
    default:   return { sourceHandle: 'b-source', targetHandle: 't-target' };
  }
}

// ---------------------------------------------------------------------------
// Geometric handle selection (per-edge, post-layout)
// ---------------------------------------------------------------------------

/**
 * Selects the best source/target handle pair for an edge based on the
 * relative positions of the two nodes after Dagre has placed them.
 *
 * Strategy: compute the angle from source center to target center.
 * Pick the handle on the side of the source that faces the target,
 * and the handle on the side of the target that faces the source.
 *
 * The 8 named handles in CustomNode are:
 *   {t,b,l,r}-{source,target}
 * positioned at Top, Bottom, Left, Right.
 */
function selectHandlesGeometrically(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): HandlePair {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Determine which side of the source faces the target
  let sourceSide: 't' | 'b' | 'l' | 'r';
  let targetSide: 't' | 'b' | 'l' | 'r';

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Primarily horizontal
    if (dx >= 0) {
      sourceSide = 'r'; // target is to the right
      targetSide = 'l'; // source is to the left of target
    } else {
      sourceSide = 'l';
      targetSide = 'r';
    }
  } else {
    // Primarily vertical
    if (dy >= 0) {
      sourceSide = 'b'; // target is below
      targetSide = 't'; // source is above target
    } else {
      sourceSide = 't';
      targetSide = 'b';
    }
  }

  return {
    sourceHandle: `${sourceSide}-source`,
    targetHandle: `${targetSide}-target`,
  };
}

/**
 * Direction-Aware Handle Selection (First layout correction pass).
 * Uses diagram flow direction and a dynamic/configured threshold to correctly identify
 * lateral sibling nodes and vertical flows, preventing excessive orthogonal S-curves.
 *
 * Note: This represents an initial correction pass for visual fidelity. Subsequent
 * iterations may introduce advanced edge collision avoidance or custom routing paths.
 */
export function selectHandlesDirectionAware(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  direction: DiagramDirection,
): HandlePair {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  const rankSep = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_RANK_SEP : BASE_RANK_GAP;
  // Calculate same-rank threshold dynamically from rank separation.
  // Uses MERMAID_LIKE_SAME_RANK_THRESHOLD when imported layout is active.
  const threshold = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_SAME_RANK_THRESHOLD : rankSep / 2;

  let sourceSide: 't' | 'b' | 'l' | 'r';
  let targetSide: 't' | 'b' | 'l' | 'r';

  if (direction === 'TD') {
    if (dy >= threshold) {
      sourceSide = 'b';
      targetSide = 't';
    } else if (dy <= -threshold) {
      sourceSide = 't';
      targetSide = 'b';
    } else {
      // Lateral/sibling
      if (dx >= 0) {
        sourceSide = 'r';
        targetSide = 'l';
      } else {
        sourceSide = 'l';
        targetSide = 'r';
      }
    }
  } else if (direction === 'BT') {
    if (dy <= -threshold) {
      sourceSide = 't';
      targetSide = 'b';
    } else if (dy >= threshold) {
      sourceSide = 'b';
      targetSide = 't';
    } else {
      // Lateral/sibling
      if (dx >= 0) {
        sourceSide = 'r';
        targetSide = 'l';
      } else {
        sourceSide = 'l';
        targetSide = 'r';
      }
    }
  } else if (direction === 'LR') {
    if (dx >= threshold) {
      sourceSide = 'r';
      targetSide = 'l';
    } else if (dx <= -threshold) {
      sourceSide = 'l';
      targetSide = 'r';
    } else {
      // Vertical sibling
      if (dy >= 0) {
        sourceSide = 'b';
        targetSide = 't';
      } else {
        sourceSide = 't';
        targetSide = 'b';
      }
    }
  } else { // RL
    if (dx <= -threshold) {
      sourceSide = 'l';
      targetSide = 'r';
    } else if (dx >= threshold) {
      sourceSide = 'r';
      targetSide = 'l';
    } else {
      // Vertical sibling
      if (dy >= 0) {
        sourceSide = 'b';
        targetSide = 't';
      } else {
        sourceSide = 't';
        targetSide = 'b';
      }
    }
  }

  return {
    sourceHandle: `${sourceSide}-source`,
    targetHandle: `${targetSide}-target`,
  };
}

// ---------------------------------------------------------------------------
// Stable sort helpers for determinism
// ---------------------------------------------------------------------------

function stableNodeOrder(orderOfAppearance: string[]): (a: string, b: string) => number {
  const indexMap = new Map<string, number>();
  orderOfAppearance.forEach((id, i) => indexMap.set(id, i));
  return (a, b) => (indexMap.get(a) ?? Infinity) - (indexMap.get(b) ?? Infinity);
}

function stableEdgeOrder(a: DiagramEdge, b: DiagramEdge): number {
  if (a.from !== b.from) return a.from < b.from ? -1 : 1;
  if (a.to !== b.to) return a.to < b.to ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Grid fallback (used only when Dagre throws an unexpected exception)
// ---------------------------------------------------------------------------

function gridFallback(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const handles = new Map<string, HandlePair>();

  // Lay out in a grid: sqrt(N) columns, sorted by id for determinism
  const sortedNodes = [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const cols = Math.max(1, Math.ceil(Math.sqrt(sortedNodes.length)));
  const gapX = 200;
  const gapY = 150;

  for (let i = 0; i < sortedNodes.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(sortedNodes[i].id, {
      x: Math.round(col * gapX),
      y: Math.round(row * gapY),
    });
  }

  // Build center lookup for geometric handle selection
  const centerLookup = new Map<string, { x: number; y: number }>();
  for (const node of sortedNodes) {
    const pos = positions.get(node.id)!;
    const size = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
    centerLookup.set(node.id, {
      x: pos.x + size.width / 2,
      y: pos.y + size.height / 2,
    });
  }

  const defaultHandles = defaultHandlesForDirection(direction);
  for (const edge of edges) {
    if (edge.from.kind === 'connected' && edge.to.kind === 'connected') {
      const sc = centerLookup.get(edge.from.nodeId);
      const tc = centerLookup.get(edge.to.nodeId);
      if (sc && tc) {
        handles.set(edge.id, selectHandlesGeometrically(sc, tc));
        continue;
      }
    }
    handles.set(edge.id, { ...defaultHandles });
  }

  return { positions, handles };
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Computes Dagre layout for an imported Mermaid diagram.
 *
 * Pure, deterministic function. Given the same inputs in the same order,
 * always produces identical output.
 *
 * @param nodes - Canonical diagram nodes (positions will be overwritten)
 * @param edges - Canonical diagram edges
 * @param direction - Flowchart direction (TD, LR, BT, RL)
 * @param orderOfAppearance - Node IDs in the order they appeared in the source
 * @returns Positions and handle pairs for all nodes and edges
 */
function normalizeLayoutEdges(edges: DiagramEdge[]): DiagramEdge[] {
  return edges.map((edge) => {
    let fromEndpoint: DiagramEdgeEndpoint;
    if (typeof edge.from === 'string') {
      fromEndpoint = { kind: 'connected', nodeId: edge.from, handleId: edge.sourceHandle || null };
    } else {
      fromEndpoint = edge.from;
    }

    let toEndpoint: DiagramEdgeEndpoint;
    if (typeof edge.to === 'string') {
      toEndpoint = { kind: 'connected', nodeId: edge.to, handleId: edge.targetHandle || null };
    } else {
      toEndpoint = edge.to;
    }

    return {
      ...edge,
      from: fromEndpoint,
      to: toEndpoint,
      connectionStatus: fromEndpoint.kind === 'connected' && toEndpoint.kind === 'connected' ? 'connected' : 'detached',
      exportMode: edge.exportMode || 'mermaid',
    };
  });
}

function runTwoPassLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
  groups: DiagramGroup[]
): LayoutResult {
  // Pass 1: Flat Dagre layout of all nodes
  const flatResult = dagreLayout(nodes, edges, direction, orderOfAppearance);
  
  const positions = new Map<string, { x: number; y: number }>(flatResult.positions);
  const groupPositions = new Map<string, { x: number; y: number }>();
  const groupSizes = new Map<string, { width: number; height: number }>();

  if (!groups || groups.length === 0) {
    return {
      positions,
      handles: flatResult.handles,
      edgeLabelPositions: flatResult.edgeLabelPositions,
      edgeRoutes: flatResult.edgeRoutes,
      groupPositions,
      groupSizes
    };
  }

  // 1. Separate lanes and subgraphs
  const lanes = groups.filter(g => g.kind === 'lane' || g.kind === 'pool');
  const subgraphs = groups.filter(g => g.kind === 'subgraph');

  const padding = GROUP_PADDING;
  const laneSpacing = 50;
  const defaultWidth = 100;
  const defaultHeight = 40;

  // 2. Handle Swim-lanes first (if any)
  if (lanes.length > 0) {
    const getAvgCoord = (laneId: string, dim: 'x' | 'y') => {
      const children = nodes.filter(n => n.parentGroupId === laneId);
      if (children.length === 0) return 0;
      const sum = children.reduce((acc, n) => {
        const pos = positions.get(n.id) || { x: 0, y: 0 };
        return acc + pos[dim];
      }, 0);
      return sum / children.length;
    };

    if (direction === 'LR' || direction === 'RL') {
      lanes.sort((a, b) => getAvgCoord(a.id, 'y') - getAvgCoord(b.id, 'y'));

      const laneNodeIds = new Set(nodes.filter(n => n.parentGroupId && lanes.some(l => l.id === n.parentGroupId)).map(n => n.id));
      let minX = Infinity;
      let maxX = -Infinity;
      for (const n of nodes) {
        if (laneNodeIds.has(n.id)) {
          const pos = positions.get(n.id) || { x: 0, y: 0 };
          const w = n.width ?? defaultWidth;
          if (pos.x < minX) minX = pos.x;
          if (pos.x + w > maxX) maxX = pos.x + w;
        }
      }
      if (minX === Infinity) { minX = 0; maxX = 300; }

      const laneWidth = (maxX - minX) + 2 * padding;
      let currentY = 0;

      for (const lane of lanes) {
        const laneChildren = nodes.filter(n => n.parentGroupId === lane.id);
        if (laneChildren.length > 0) {
          const childYCoords = laneChildren.map(c => (positions.get(c.id)?.y ?? 0));
          const childMinY = Math.min(...childYCoords);
          const childMaxY = Math.max(...laneChildren.map(c => (positions.get(c.id)?.y ?? 0) + (c.height ?? defaultHeight)));
          const laneHeight = (childMaxY - childMinY) + 2 * padding;

          const laneX = minX - padding;
          const laneY = currentY;
          groupPositions.set(lane.id, { x: laneX, y: laneY });
          groupSizes.set(lane.id, { width: laneWidth, height: laneHeight });

          const deltaY = laneY + padding - childMinY;
          for (const child of laneChildren) {
            const currentPos = positions.get(child.id) || { x: 0, y: 0 };
            positions.set(child.id, { x: currentPos.x, y: currentPos.y + deltaY });
          }

          currentY += laneHeight + laneSpacing;
        } else {
          groupPositions.set(lane.id, { x: minX - padding, y: currentY });
          groupSizes.set(lane.id, { width: laneWidth, height: 200 });
          currentY += 200 + laneSpacing;
        }
      }
    } else {
      lanes.sort((a, b) => getAvgCoord(a.id, 'x') - getAvgCoord(b.id, 'x'));

      const laneNodeIds = new Set(nodes.filter(n => n.parentGroupId && lanes.some(l => l.id === n.parentGroupId)).map(n => n.id));
      let minY = Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        if (laneNodeIds.has(n.id)) {
          const pos = positions.get(n.id) || { x: 0, y: 0 };
          const h = n.height ?? defaultHeight;
          if (pos.y < minY) minY = pos.y;
          if (pos.y + h > maxY) maxY = pos.y + h;
        }
      }
      if (minY === Infinity) { minY = 0; maxY = 200; }

      const laneHeight = (maxY - minY) + 2 * padding;
      let currentX = 0;

      for (const lane of lanes) {
        const laneChildren = nodes.filter(n => n.parentGroupId === lane.id);
        if (laneChildren.length > 0) {
          const childXCoords = laneChildren.map(c => (positions.get(c.id)?.x ?? 0));
          const childMinX = Math.min(...childXCoords);
          const childMaxX = Math.max(...laneChildren.map(c => (positions.get(c.id)?.x ?? 0) + (c.width ?? defaultWidth)));
          const laneWidth = (childMaxX - childMinX) + 2 * padding;

          const laneX = currentX;
          const laneY = minY - padding;
          groupPositions.set(lane.id, { x: laneX, y: laneY });
          groupSizes.set(lane.id, { width: laneWidth, height: laneHeight });

          const deltaX = laneX + padding - childMinX;
          for (const child of laneChildren) {
            const currentPos = positions.get(child.id) || { x: 0, y: 0 };
            positions.set(child.id, { x: currentPos.x + deltaX, y: currentPos.y });
          }

          currentX += laneWidth + laneSpacing;
        } else {
          groupPositions.set(lane.id, { x: currentX, y: minY - padding });
          groupSizes.set(lane.id, { width: 300, height: laneHeight });
          currentX += 300 + laneSpacing;
        }
      }
    }
  }

  // 3. Handle General Subgraphs
  if (subgraphs.length > 0) {
    const computedBoxes = subgraphs.map(sub => {
      const children = nodes.filter(n => n.parentGroupId === sub.id);
      if (children.length > 0) {
        const xs = children.map(c => positions.get(c.id)!.x);
        const ys = children.map(c => positions.get(c.id)!.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...children.map(c => positions.get(c.id)!.x + (c.width ?? defaultWidth)));
        const minY = Math.min(...ys);
        const maxY = Math.max(...children.map(c => positions.get(c.id)!.y + (c.height ?? defaultHeight)));

        return {
          id: sub.id,
          x: minX - padding,
          y: minY - padding,
          width: (maxX - minX) + 2 * padding,
          height: (maxY - minY) + 2 * padding,
          hasChildren: true
        };
      } else {
        return {
          id: sub.id,
          x: 100,
          y: 100,
          width: 300,
          height: 200,
          hasChildren: false
        };
      }
    });

    const isHorizontal = direction === 'LR' || direction === 'RL';
    computedBoxes.sort((a, b) => isHorizontal ? a.x - b.x : a.y - b.y);

    for (let i = 0; i < computedBoxes.length; i++) {
      const boxA = computedBoxes[i];
      for (let j = i + 1; j < computedBoxes.length; j++) {
        const boxB = computedBoxes[j];
        
        const overlapsX = boxA.x < boxB.x + boxB.width && boxA.x + boxA.width > boxB.x;
        const overlapsY = boxA.y < boxB.y + boxB.height && boxA.y + boxA.height > boxB.y;

        if (overlapsX && overlapsY) {
          if (isHorizontal) {
            const shiftX = (boxA.x + boxA.width + 40) - boxB.x;
            boxB.x += shiftX;
            const bChildren = nodes.filter(n => n.parentGroupId === boxB.id);
            for (const child of bChildren) {
              const pos = positions.get(child.id)!;
              positions.set(child.id, { x: pos.x + shiftX, y: pos.y });
            }
          } else {
            const shiftY = (boxA.y + boxA.height + 40) - boxB.y;
            boxB.y += shiftY;
            const bChildren = nodes.filter(n => n.parentGroupId === boxB.id);
            for (const child of bChildren) {
              const pos = positions.get(child.id)!;
              positions.set(child.id, { x: pos.x, y: pos.y + shiftY });
            }
          }
        }
      }
    }

    for (const box of computedBoxes) {
      groupPositions.set(box.id, { x: box.x, y: box.y });
      groupSizes.set(box.id, { width: box.width, height: box.height });
    }
  }

  // Pass 3: Re-evaluate edge handles using direction aware layout
  const handles = new Map<string, HandlePair>();
  const defaultHandles = defaultHandlesForDirection(direction);

  const centerPositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    const w = node.width ?? defaultWidth;
    const h = node.height ?? defaultHeight;
    centerPositions.set(node.id, {
      x: pos.x + w / 2,
      y: pos.y + h / 2,
    });
  }

  for (const edge of edges) {
    if (edge.from.kind === 'connected' && edge.to.kind === 'connected') {
      const fromId = edge.from.nodeId;
      const toId = edge.to.nodeId;
      const sourceCenter = centerPositions.get(fromId);
      const targetCenter = centerPositions.get(toId);

      if (sourceCenter && targetCenter) {
        if (fromId === toId) {
          handles.set(edge.id, { ...defaultHandles });
        } else {
          const handlePair = USE_MERMAID_LIKE_IMPORTED_LAYOUT
            ? selectHandlesDirectionAware(sourceCenter, targetCenter, direction)
            : selectHandlesGeometrically(sourceCenter, targetCenter);
          handles.set(edge.id, handlePair);
        }
      } else {
        handles.set(edge.id, { ...defaultHandles });
      }
    } else {
      handles.set(edge.id, { ...defaultHandles });
    }
  }

  return {
    positions,
    handles,
    edgeLabelPositions: flatResult.edgeLabelPositions,
    groupPositions,
    groupSizes
  };
}

// ---------------------------------------------------------------------------
// Mermaid-style compound subgraph layout
// ---------------------------------------------------------------------------
// Mirrors Mermaid's dagre wrapper contract
// (packages/mermaid/src/rendering-util/layout-algorithms/dagre/):
//   1. Subgraphs are compound clusters in the SAME dagre graph
//      (compound: true + setParent), so grouping shapes ranks.
//   2. A cluster with NO external edges — or with an explicit `direction`
//      keyword — is *extracted*: its members are laid out recursively in
//      their own graph (rankdir = explicit dir, else flipped parent dir;
//      ranksep + 25), then the whole cluster is re-inserted as one node.
//   3. Edges pointing at a cluster id are re-anchored onto a representative
//      leaf child (Mermaid's findNonClusterChild).
//   4. Cluster frames add padding (8) around the children bounding box plus
//      a title band at the top.
// ---------------------------------------------------------------------------

/**
 * Default direction for an extracted cluster without an explicit `direction`.
 * Mermaid (mermaid-graphlib.js extractor):
 *   `let dir = graphSettings.rankdir === 'TB' ? 'LR' : 'TB';`
 */
function flipDirection(direction: DiagramDirection): DiagramDirection {
  return direction === 'TD' ? 'LR' : 'TD';
}

function normalizeGroupDirection(dir: DiagramGroup['direction']): DiagramDirection | undefined {
  if (!dir) return undefined;
  return dir === 'TB' ? 'TD' : dir;
}

interface SubgraphLayoutResult {
  /** Positions of leaf nodes relative to this graph's origin (top-left anchored). */
  positions: Map<string, { x: number; y: number }>;
  /** Frames of groups fully laid out at this level or below (top-left + size). */
  groupFrames: Map<string, { x: number; y: number; width: number; height: number }>;
  /** Dagre-computed edge label centers, relative to this graph's origin. */
  edgeLabelCenters: Map<string, { x: number; y: number }>;
  /** Unclipped Dagre edge routes, relative to this graph's origin. */
  edgeRoutes: Map<string, EdgePoint[]>;
  /** Total bounding box of this graph's content. */
  width: number;
  height: number;
}

interface GroupTreeContext {
  /** Direct member node ids per group id. */
  nodesByGroup: Map<string, DiagramNode[]>;
  /** Direct child groups per group id (undefined key = root). */
  childGroups: Map<string | undefined, DiagramGroup[]>;
  /** groupId -> every descendant leaf node id (for external-edge detection). */
  descendantNodeIds: Map<string, Set<string>>;
  /** Whether a group has at least one edge crossing its boundary. */
  hasExternalEdges: Map<string, boolean>;
  groupById: Map<string, DiagramGroup>;
}

function buildGroupTreeContext(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  groups: DiagramGroup[],
): GroupTreeContext {
  const groupById = new Map<string, DiagramGroup>(groups.map((g) => [g.id, g]));
  const nodesByGroup = new Map<string, DiagramNode[]>();
  const childGroups = new Map<string | undefined, DiagramGroup[]>();

  for (const g of groups) {
    const parentKey = g.parentGroupId && groupById.has(g.parentGroupId) ? g.parentGroupId : undefined;
    const list = childGroups.get(parentKey) ?? [];
    list.push(g);
    childGroups.set(parentKey, list);
  }
  for (const n of nodes) {
    if (n.parentGroupId && groupById.has(n.parentGroupId)) {
      const list = nodesByGroup.get(n.parentGroupId) ?? [];
      list.push(n);
      nodesByGroup.set(n.parentGroupId, list);
    }
  }

  // Descendant leaf sets (bottom-up via memoized recursion)
  const descendantNodeIds = new Map<string, Set<string>>();
  const collectDescendants = (groupId: string): Set<string> => {
    const cached = descendantNodeIds.get(groupId);
    if (cached) return cached;
    const set = new Set<string>();
    descendantNodeIds.set(groupId, set); // set before recursing (cycle safety)
    for (const n of nodesByGroup.get(groupId) ?? []) set.add(n.id);
    for (const child of childGroups.get(groupId) ?? []) {
      for (const id of collectDescendants(child.id)) set.add(id);
    }
    return set;
  };
  for (const g of groups) collectDescendants(g.id);

  // External edge detection: an edge is external to a group when exactly one
  // endpoint is among the group's descendants (Mermaid: d1 ^ d2).
  const hasExternalEdges = new Map<string, boolean>();
  for (const g of groups) hasExternalEdges.set(g.id, false);
  for (const edge of edges) {
    if (!isStructurallyConnectedEdge(edge)) continue;
    const fromId = (edge.from as ConnectedEdgeEndpoint).nodeId;
    const toId = (edge.to as ConnectedEdgeEndpoint).nodeId;
    for (const g of groups) {
      const inside = descendantNodeIds.get(g.id)!;
      const d1 = inside.has(fromId);
      const d2 = inside.has(toId);
      if (d1 !== d2) hasExternalEdges.set(g.id, true);
    }
  }

  return { nodesByGroup, childGroups, descendantNodeIds, hasExternalEdges, groupById };
}

/**
 * Determines whether a group is laid out recursively in its own graph.
 * Mermaid extracts clusters that have no external connections, or that carry
 * an explicit `direction` keyword (issue #4648 behavior).
 */
function isExtractedGroup(group: DiagramGroup, ctx: GroupTreeContext): boolean {
  if (normalizeGroupDirection(group.direction)) return true;
  return !ctx.hasExternalEdges.get(group.id);
}

/**
 * Cluster frame size for a laid-out subgraph interior: content + padding +
 * title band, mirroring Mermaid's snug cluster rects. A small floor keeps
 * degenerate (near-empty) clusters visible; the app's MIN_GROUP_* constants
 * only govern manual resizing and are intentionally not applied here.
 */
function clusterFrameSize(innerWidth: number, innerHeight: number): { width: number; height: number } {
  return {
    width: Math.max(innerWidth, 40) + 2 * MERMAID_LIKE_CLUSTER_PADDING,
    height: Math.max(innerHeight, 40) + 2 * MERMAID_LIKE_CLUSTER_PADDING + MERMAID_LIKE_GROUP_TITLE_HEIGHT,
  };
}

/** Deterministic edge-label proxy size (same estimate as dagreLayout). */
function edgeLabelProxySize(edge: DiagramEdge): { width: number; height: number } {
  const label = edge.label || '';
  const labelPadding = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_LABEL_PADDING : LABEL_PADDING_X;
  return {
    width: label ? label.length * LABEL_CHAR_WIDTH + labelPadding : 0,
    height: label ? LABEL_LINE_HEIGHT : 0,
  };
}

/**
 * Recursively lays out one level of the group tree.
 *
 * At each level the dagre graph contains:
 *   - leaf nodes directly at this level,
 *   - extracted child groups as single placeholder nodes (their content laid
 *     out recursively beforehand, Mermaid's `clusterNode` path),
 *   - compound child groups' descendants with setParent (Mermaid's
 *     non-extracted cluster path).
 *
 * Edges whose endpoints live in extracted child groups are re-anchored to the
 * placeholder node at this level.
 *
 * Returns top-left-anchored positions relative to this graph's origin.
 */
function layoutLevel(
  levelGroupId: string | undefined,
  direction: DiagramDirection,
  rankSepExtra: number,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  orderOfAppearance: string[],
  ctx: GroupTreeContext,
): SubgraphLayoutResult {
  const rankdir = toRankdir(direction);
  const clusterPadding = MERMAID_LIKE_CLUSTER_PADDING;
  const titleHeight = MERMAID_LIKE_GROUP_TITLE_HEIGHT;

  const directNodes = levelGroupId === undefined
    ? nodes.filter((n) => !n.parentGroupId || !ctx.groupById.has(n.parentGroupId))
    : (ctx.nodesByGroup.get(levelGroupId) ?? []);
  const directGroups = ctx.childGroups.get(levelGroupId) ?? [];

  // 1. Recursively lay out extracted child groups first (Mermaid's
  //    recursiveRender), producing placeholder sizes.
  const extracted = new Map<string, SubgraphLayoutResult>();
  const compoundGroups: DiagramGroup[] = [];
  for (const g of directGroups) {
    if (isExtractedGroup(g, ctx)) {
      const childDir = normalizeGroupDirection(g.direction) ?? flipDirection(direction);
      extracted.set(
        g.id,
        layoutLevel(g.id, childDir, rankSepExtra + MERMAID_LIKE_SUBGRAPH_RANK_SEP_EXTRA, nodes, edges, orderOfAppearance, ctx),
      );
    } else {
      compoundGroups.push(g);
    }
  }

  // 2. Build the dagre graph for this level.
  const g = new Graph({ directed: true, multigraph: true, compound: true });
  g.setGraph({
    rankdir,
    nodesep: MERMAID_LIKE_NODE_SEP,
    ranksep: MERMAID_LIKE_RANK_SEP + rankSepExtra,
    marginx: MERMAID_LIKE_MARGIN_X,
    marginy: MERMAID_LIKE_MARGIN_Y,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeComparator = stableNodeOrder(orderOfAppearance);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Map of leaf node id -> the graph-node id representing it at this level.
  // Leaves inside extracted child groups are represented by the placeholder.
  const anchorOf = new Map<string, string>();

  // 2a. Direct leaf nodes
  const directLeafIds = directNodes.map((n) => n.id).sort(nodeComparator);
  for (const id of directLeafIds) {
    const node = nodeById.get(id)!;
    const sizeConfig = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
    g.setNode(id, { width: node.width ?? sizeConfig.width, height: node.height ?? sizeConfig.height });
    anchorOf.set(id, id);
  }

  // 2b. Extracted child groups → single placeholder nodes
  const sortedExtractedIds = [...extracted.keys()].sort();
  for (const groupId of sortedExtractedIds) {
    const inner = extracted.get(groupId)!;
    const { width: w, height: h } = clusterFrameSize(inner.width, inner.height);
    g.setNode(groupId, { width: w, height: h });
    for (const leafId of ctx.descendantNodeIds.get(groupId)!) {
      anchorOf.set(leafId, groupId);
    }
  }

  // 2c. Compound child groups → cluster + all descendants with setParent.
  //     Nested extracted groups inside a compound group become placeholders
  //     within the cluster; nested compound groups stay compound.
  const addCompoundGroup = (group: DiagramGroup, parentClusterId: string | undefined) => {
    g.setNode(group.id, {});
    if (parentClusterId) g.setParent(group.id, parentClusterId);

    const members = (ctx.nodesByGroup.get(group.id) ?? []).map((n) => n.id).sort(nodeComparator);
    for (const id of members) {
      const node = nodeById.get(id)!;
      const sizeConfig = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
      g.setNode(id, { width: node.width ?? sizeConfig.width, height: node.height ?? sizeConfig.height });
      g.setParent(id, group.id);
      anchorOf.set(id, id);
    }
    const children = [...(ctx.childGroups.get(group.id) ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const child of children) {
      if (isExtractedGroup(child, ctx)) {
        const childDir = normalizeGroupDirection(child.direction) ?? flipDirection(direction);
        const inner = layoutLevel(child.id, childDir, rankSepExtra + MERMAID_LIKE_SUBGRAPH_RANK_SEP_EXTRA, nodes, edges, orderOfAppearance, ctx);
        extracted.set(child.id, inner);
        const { width: w, height: h } = clusterFrameSize(inner.width, inner.height);
        g.setNode(child.id, { width: w, height: h });
        g.setParent(child.id, group.id);
        for (const leafId of ctx.descendantNodeIds.get(child.id)!) {
          anchorOf.set(leafId, child.id);
        }
      } else {
        addCompoundGroup(child, group.id);
      }
    }
  };
  const sortedCompound = [...compoundGroups].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const group of sortedCompound) addCompoundGroup(group, undefined);

  // 3. Edges: keep only those whose BOTH anchors exist at this level, skip
  //    edges collapsing into the same anchor (fully inside one extracted
  //    child — they were routed in the recursive pass).
  const sortedEdges = [...edges].filter(isStructurallyConnectedEdge).sort(stableEdgeOrder);
  for (const edge of sortedEdges) {
    const fromAnchor = anchorOf.get((edge.from as ConnectedEdgeEndpoint).nodeId);
    const toAnchor = anchorOf.get((edge.to as ConnectedEdgeEndpoint).nodeId);
    if (!fromAnchor || !toAnchor) continue;
    if (fromAnchor === toAnchor && fromAnchor !== (edge.from as ConnectedEdgeEndpoint).nodeId) continue;
    const { width, height } = edgeLabelProxySize(edge);
    g.setEdge(fromAnchor, toAnchor, { width, height, labelpos: 'c' }, edge.id);
  }

  // 4. Layout
  layout(g);

  // 5. Read back geometry. Dagre reports centers; convert to top-left and
  //    normalize so the content bounding box starts at (0,0).
  const rawRects = new Map<string, { x: number; y: number; width: number; height: number }>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const registerRect = (id: string) => {
    const label = g.node(id);
    if (!label || label.x === undefined || label.y === undefined) return;
    const w = label.width ?? 0;
    const h = label.height ?? 0;
    const rect = { x: label.x - w / 2, y: label.y - h / 2, width: w, height: h };
    rawRects.set(id, rect);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  };
  for (const id of g.nodes()) {
    // Compound cluster parents get x/y/width/height from dagre too.
    registerRect(id);
  }
  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 0; maxY = 0;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const groupFrames = new Map<string, { x: number; y: number; width: number; height: number }>();
  const edgeLabelCenters = new Map<string, { x: number; y: number }>();
  const edgeRoutes = new Map<string, EdgePoint[]>();

  // Dagre-computed routes and label centers for edges laid out at this level.
  for (const edge of sortedEdges) {
    const fromAnchor = anchorOf.get((edge.from as ConnectedEdgeEndpoint).nodeId);
    const toAnchor = anchorOf.get((edge.to as ConnectedEdgeEndpoint).nodeId);
    if (!fromAnchor || !toAnchor) continue;
    const dagreEdge = g.edge(fromAnchor, toAnchor, edge.id);
    if (dagreEdge?.points?.length) {
      edgeRoutes.set(
        edge.id,
        dagreEdge.points.map((point: EdgePoint) => ({ x: point.x - minX, y: point.y - minY })),
      );
    }
    if (edge.label && dagreEdge && dagreEdge.x !== undefined && dagreEdge.y !== undefined) {
      edgeLabelCenters.set(edge.id, { x: dagreEdge.x - minX, y: dagreEdge.y - minY });
    }
  }

  const toLocal = (r: { x: number; y: number; width: number; height: number }) => ({
    x: r.x - minX,
    y: r.y - minY,
    width: r.width,
    height: r.height,
  });

  // 5a. Leaves placed directly by dagre at this level: direct leaves AND
  //     members of compound clusters (anchor === own id).
  for (const [leafId, anchorId] of anchorOf) {
    if (anchorId !== leafId) continue;
    const r = rawRects.get(leafId);
    if (r) {
      const local = toLocal(r);
      positions.set(leafId, { x: local.x, y: local.y });
    }
  }

  // 5b. Extracted groups: place the frame, then translate inner content into
  //     it (content starts below the title band, inset by padding).
  for (const [groupId, inner] of extracted) {
    const r = rawRects.get(groupId);
    if (!r) continue;
    const frame = toLocal(r);
    groupFrames.set(groupId, frame);
    // Center the inner content when the frame was clamped to the minimum
    // group size (otherwise slack = 0 and this is exactly padding/title).
    const slackX = frame.width - (inner.width + 2 * clusterPadding);
    const slackY = frame.height - (inner.height + 2 * clusterPadding + titleHeight);
    const offsetX = frame.x + clusterPadding + Math.max(0, slackX) / 2;
    const offsetY = frame.y + clusterPadding + titleHeight + Math.max(0, slackY) / 2;
    for (const [leafId, pos] of inner.positions) {
      positions.set(leafId, { x: pos.x + offsetX, y: pos.y + offsetY });
    }
    for (const [innerGroupId, innerFrame] of inner.groupFrames) {
      groupFrames.set(innerGroupId, {
        x: innerFrame.x + offsetX,
        y: innerFrame.y + offsetY,
        width: innerFrame.width,
        height: innerFrame.height,
      });
    }
    for (const [edgeId, center] of inner.edgeLabelCenters) {
      edgeLabelCenters.set(edgeId, { x: center.x + offsetX, y: center.y + offsetY });
    }
    for (const [edgeId, points] of inner.edgeRoutes) {
      edgeRoutes.set(edgeId, points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY })));
    }
  }

  // 5c. Compound groups: members were placed directly by dagre; the frame is
  //     recomputed from the children bounds (leaf members + nested frames)
  //     with cluster padding and a title band, mirroring Mermaid's cluster
  //     rect. Process deepest-first so parents include child frames.
  const compoundDepth = (group: DiagramGroup): number => {
    let depth = 0;
    let current: DiagramGroup | undefined = group;
    while (current?.parentGroupId && ctx.groupById.has(current.parentGroupId)) {
      depth++;
      current = ctx.groupById.get(current.parentGroupId);
    }
    return depth;
  };
  const allCompoundAtLevel: DiagramGroup[] = [];
  const collectCompound = (group: DiagramGroup) => {
    allCompoundAtLevel.push(group);
    for (const child of ctx.childGroups.get(group.id) ?? []) {
      if (!extracted.has(child.id)) collectCompound(child);
    }
  };
  for (const group of sortedCompound) collectCompound(group);
  allCompoundAtLevel.sort((a, b) => compoundDepth(b) - compoundDepth(a) || (a.id < b.id ? -1 : 1));

  for (const group of allCompoundAtLevel) {
    let bMinX = Infinity;
    let bMinY = Infinity;
    let bMaxX = -Infinity;
    let bMaxY = -Infinity;
    const include = (r: { x: number; y: number; width: number; height: number }) => {
      bMinX = Math.min(bMinX, r.x);
      bMinY = Math.min(bMinY, r.y);
      bMaxX = Math.max(bMaxX, r.x + r.width);
      bMaxY = Math.max(bMaxY, r.y + r.height);
    };
    for (const n of ctx.nodesByGroup.get(group.id) ?? []) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      const sizeConfig = NODE_SIZE_DEFAULTS[n.shape] ?? NODE_SIZE_DEFAULTS.process;
      include({ x: pos.x, y: pos.y, width: n.width ?? sizeConfig.width, height: n.height ?? sizeConfig.height });
    }
    for (const child of ctx.childGroups.get(group.id) ?? []) {
      const frame = groupFrames.get(child.id);
      if (frame) include(frame);
    }
    if (bMinX === Infinity) {
      // Empty compound group: fall back to dagre's own cluster rect if any.
      const r = rawRects.get(group.id);
      const frame = r ? toLocal(r) : { x: 0, y: 0, width: 300, height: 200 };
      groupFrames.set(group.id, frame);
      continue;
    }
    groupFrames.set(group.id, {
      x: bMinX - clusterPadding,
      y: bMinY - clusterPadding - titleHeight,
      width: (bMaxX - bMinX) + 2 * clusterPadding,
      height: (bMaxY - bMinY) + 2 * clusterPadding + titleHeight,
    });
  }

  // Recompute the level bounding box including expanded compound frames
  // (title band may extend above the previous minimum).
  let totalMaxX = maxX - minX;
  let totalMaxY = maxY - minY;
  let totalMinX = 0;
  let totalMinY = 0;
  for (const frame of groupFrames.values()) {
    totalMinX = Math.min(totalMinX, frame.x);
    totalMinY = Math.min(totalMinY, frame.y);
    totalMaxX = Math.max(totalMaxX, frame.x + frame.width);
    totalMaxY = Math.max(totalMaxY, frame.y + frame.height);
  }
  if (totalMinX < 0 || totalMinY < 0) {
    const shiftX = -totalMinX;
    const shiftY = -totalMinY;
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + shiftX, y: pos.y + shiftY });
    }
    for (const [id, frame] of groupFrames) {
      groupFrames.set(id, { ...frame, x: frame.x + shiftX, y: frame.y + shiftY });
    }
    for (const [id, center] of edgeLabelCenters) {
      edgeLabelCenters.set(id, { x: center.x + shiftX, y: center.y + shiftY });
    }
    for (const [id, points] of edgeRoutes) {
      edgeRoutes.set(id, points.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })));
    }
    totalMaxX += shiftX;
    totalMaxY += shiftY;
  }

  return { positions, groupFrames, edgeLabelCenters, edgeRoutes, width: totalMaxX, height: totalMaxY };
}

/**
 * Mermaid-contract layout for diagrams containing subgraphs (no lanes).
 * Runs the recursive compound layout, then derives handles and edge-label
 * positions from the FINAL node positions.
 */
function layoutWithSubgraphs(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
  groups: DiagramGroup[],
): LayoutResult {
  const subgraphs = groups.filter((gr) => gr.kind === 'subgraph');
  const ctx = buildGroupTreeContext(nodes, edges, subgraphs);
  const root = layoutLevel(undefined, direction, 0, nodes, edges, orderOfAppearance, ctx);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of root.positions) {
    positions.set(id, { x: Math.round(pos.x), y: Math.round(pos.y) });
  }
  // Safety net: any node dagre could not place (shouldn't happen) keeps (0,0).
  for (const node of nodes) {
    if (!positions.has(node.id)) positions.set(node.id, { x: 0, y: 0 });
  }

  const groupPositions = new Map<string, { x: number; y: number }>();
  const groupSizes = new Map<string, { width: number; height: number }>();
  for (const group of subgraphs) {
    const frame = root.groupFrames.get(group.id);
    if (frame) {
      groupPositions.set(group.id, { x: Math.round(frame.x), y: Math.round(frame.y) });
      groupSizes.set(group.id, { width: Math.round(frame.width), height: Math.round(frame.height) });
    }
  }

  // Handles + label positions from FINAL geometry.
  const handles = new Map<string, HandlePair>();
  const edgeLabelPositions = new Map<string, { x: number; y: number }>();
  const edgeRoutes = new Map<string, ImportedEdgeData>();
  const defaultHandles = defaultHandlesForDirection(direction);

  const centerOf = (id: string): { x: number; y: number } | undefined => {
    const node = nodes.find((n) => n.id === id);
    const pos = positions.get(id);
    if (!node || !pos) return undefined;
    const sizeConfig = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
    return {
      x: pos.x + (node.width ?? sizeConfig.width) / 2,
      y: pos.y + (node.height ?? sizeConfig.height) / 2,
    };
  };

  for (const edge of edges) {
    if (!isStructurallyConnectedEdge(edge)) {
      handles.set(edge.id, { ...defaultHandles });
      continue;
    }
    const fromId = (edge.from as ConnectedEdgeEndpoint).nodeId;
    const toId = (edge.to as ConnectedEdgeEndpoint).nodeId;
    const sc = centerOf(fromId);
    const tc = centerOf(toId);
    if (!sc || !tc || fromId === toId) {
      handles.set(edge.id, { ...defaultHandles });
    } else {
      handles.set(edge.id, selectHandlesDirectionAware(sc, tc, direction));
    }
    if (edge.label) {
      const dagreCenter = root.edgeLabelCenters.get(edge.id);
      if (dagreCenter) {
        edgeLabelPositions.set(edge.id, { x: dagreCenter.x, y: dagreCenter.y });
      } else if (sc && tc) {
        edgeLabelPositions.set(edge.id, { x: (sc.x + tc.x) / 2, y: (sc.y + tc.y) / 2 });
      }
    }

    const dagrePoints = root.edgeRoutes.get(edge.id);
    const sourceNode = nodes.find((node) => node.id === fromId);
    const targetNode = nodes.find((node) => node.id === toId);
    const sourcePosition = positions.get(fromId);
    const targetPosition = positions.get(toId);
    if (dagrePoints && sourceNode && targetNode && sourcePosition && targetPosition) {
      const route = createImportedEdgeData(
        dagrePoints,
        createImportedEdgeNodeSnapshot(sourceNode, sourcePosition),
        createImportedEdgeNodeSnapshot(targetNode, targetPosition),
        root.edgeLabelCenters.get(edge.id),
      );
      if (route) edgeRoutes.set(edge.id, route);
    }
  }

  return { positions, handles, edgeLabelPositions, edgeRoutes, groupPositions, groupSizes };
}

export function layoutImportedDiagram(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
  groups?: DiagramGroup[]
): LayoutResult {
  const normalizedEdges = normalizeLayoutEdges(edges);
  if (nodes.length === 0) {
    return {
      positions: new Map(),
      handles: new Map(),
      edgeLabelPositions: new Map(),
      edgeRoutes: new Map(),
      groupPositions: new Map(),
      groupSizes: new Map(),
    };
  }

  try {
    if (groups && groups.length > 0) {
      const hasLanes = groups.some((g) => g.kind === 'lane' || (g.kind as string) === 'pool');
      // Mermaid-style compound layout only applies to pure-subgraph diagrams
      // (Mermaid has no swimlane concept); lanes keep the legacy algorithm.
      if (USE_MERMAID_LIKE_IMPORTED_LAYOUT && !hasLanes) {
        return layoutWithSubgraphs(nodes, normalizedEdges, direction, orderOfAppearance, groups);
      }
      return runTwoPassLayout(nodes, normalizedEdges, direction, orderOfAppearance, groups);
    }
    return dagreLayout(nodes, normalizedEdges, direction, orderOfAppearance);
  } catch (err) {
    console.error('[mermaidLayout] Dagre layout failed, falling back to grid:', err);
    return gridFallback(nodes, normalizedEdges, direction);
  }
}

function dagreLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
): LayoutResult {
  const rankdir = toRankdir(direction);

  const nodeSep = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_NODE_SEP : BASE_NODE_GAP;
  const rankSep = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_RANK_SEP : BASE_RANK_GAP;
  const marginX = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_MARGIN_X : 20;
  const marginY = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_MARGIN_Y : 20;

  // 1. Create and configure the Dagre graph.
  // Mermaid's contract (rendering-util/layout-algorithms/dagre/index.js):
  // { rankdir, nodesep, ranksep, marginx: 8, marginy: 8 } — no `edgesep`
  // and no `acyclicer` (Dagre defaults apply). The legacy branch keeps the
  // historical extra options for backwards-compatible layouts.
  const g = new Graph({ directed: true, multigraph: true, compound: false });
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
    ...(USE_MERMAID_LIKE_IMPORTED_LAYOUT
      ? {}
      : { ranker: 'network-simplex', acyclicer: 'greedy', edgesep: BASE_EDGE_GAP }),
  });

  // 2. Insert nodes in stable order (determinism prerequisite)
  const nodeComparator = stableNodeOrder(orderOfAppearance);
  const sortedNodeIds = nodes.map((n) => n.id).sort(nodeComparator);
  const nodeById = new Map<string, DiagramNode>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

  for (const id of sortedNodeIds) {
    const node = nodeById.get(id)!;
    const sizeConfig = NODE_SIZE_DEFAULTS[node.shape] ?? NODE_SIZE_DEFAULTS.process;
    const w = node.width ?? sizeConfig.width;
    const h = node.height ?? sizeConfig.height;
    g.setNode(id, { width: w, height: h });
  }

  // 3. Insert edges in stable order
  const sortedEdges = [...edges].filter(isStructurallyConnectedEdge).sort(stableEdgeOrder);
  for (const edge of sortedEdges) {
    const label = edge.label || '';
    const labelPadding = USE_MERMAID_LIKE_IMPORTED_LAYOUT ? MERMAID_LIKE_LABEL_PADDING : LABEL_PADDING_X;
    const w = label ? label.length * LABEL_CHAR_WIDTH + labelPadding : 0;
    const h = label ? LABEL_LINE_HEIGHT : 0;

    const fromId = (edge.from as ConnectedEdgeEndpoint).nodeId;
    const toId = (edge.to as ConnectedEdgeEndpoint).nodeId;

    // All edge types are given to Dagre to influence rank and proximity.
    // Use the natural parsed direction (from -> to) to align hierarchy with
    // Mermaid's native layout engine behavior.
    g.setEdge(fromId, toId, { width: w, height: h, labelpos: 'c' }, edge.id);
  }

  // 4. Run Dagre layout
  layout(g);

  // 5. Extract positions (Dagre: center anchor → React Flow: top-left anchor)
  const positions = new Map<string, { x: number; y: number }>();
  const centerPositions = new Map<string, { x: number; y: number }>();

  for (const id of sortedNodeIds) {
    const nodeLabel = g.node(id);
    if (!nodeLabel || nodeLabel.x === undefined || nodeLabel.y === undefined) continue;

    const w = nodeLabel.width ?? 0;
    const h = nodeLabel.height ?? 0;

    positions.set(id, {
      x: Math.round(nodeLabel.x - w / 2),
      y: Math.round(nodeLabel.y - h / 2),
    });

    centerPositions.set(id, {
      x: nodeLabel.x,
      y: nodeLabel.y,
    });
  }

  // 6. Assign handles per edge using geometric selection (post-layout)
  const handles = new Map<string, HandlePair>();
  const defaultHandles = defaultHandlesForDirection(direction);

  for (const edge of sortedEdges) {
    const fromId = (edge.from as ConnectedEdgeEndpoint).nodeId;
    const toId = (edge.to as ConnectedEdgeEndpoint).nodeId;
    const sourceCenter = centerPositions.get(fromId);
    const targetCenter = centerPositions.get(toId);

    if (sourceCenter && targetCenter) {
      // Self-loops: use default directional handles
      if (fromId === toId) {
        handles.set(edge.id, { ...defaultHandles });
      } else {
        const handlePair = USE_MERMAID_LIKE_IMPORTED_LAYOUT
          ? selectHandlesDirectionAware(sourceCenter, targetCenter, direction)
          : selectHandlesGeometrically(sourceCenter, targetCenter);
        handles.set(edge.id, handlePair);
      }
    } else {
      handles.set(edge.id, { ...defaultHandles });
    }
  }

  // 7. Extract edge label positions computed by Dagre
  const edgeLabelPositions = new Map<string, { x: number; y: number }>();
  const edgeRoutes = new Map<string, ImportedEdgeData>();
  for (const edge of sortedEdges) {
    // Dagre requires querying the edge using the exact from/to direction
    // that was passed to g.setEdge. We used 'directed' behavior.
    const from = (edge.from as ConnectedEdgeEndpoint).nodeId;
    const to = (edge.to as ConnectedEdgeEndpoint).nodeId;
    
    const dagreEdge = g.edge(from, to, edge.id);
    if (edge.label && dagreEdge && dagreEdge.x !== undefined && dagreEdge.y !== undefined) {
      edgeLabelPositions.set(edge.id, { x: dagreEdge.x, y: dagreEdge.y });
    }

    const sourceNode = nodeById.get(from);
    const targetNode = nodeById.get(to);
    const sourcePosition = positions.get(from);
    const targetPosition = positions.get(to);
    if (dagreEdge?.points && sourceNode && targetNode && sourcePosition && targetPosition) {
      const route = createImportedEdgeData(
        dagreEdge.points,
        createImportedEdgeNodeSnapshot(sourceNode, sourcePosition),
        createImportedEdgeNodeSnapshot(targetNode, targetPosition),
        edgeLabelPositions.get(edge.id),
      );
      if (route) edgeRoutes.set(edge.id, route);
    }
  }

  return { positions, handles, edgeLabelPositions, edgeRoutes };
}
