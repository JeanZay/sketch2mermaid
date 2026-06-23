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
import type { DiagramNode, DiagramEdge, DiagramDirection } from '../types';
import { NODE_SIZE_DEFAULTS } from '../nodeSizeConfig';

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
    const sc = centerLookup.get(edge.from);
    const tc = centerLookup.get(edge.to);
    if (sc && tc) {
      handles.set(edge.id, selectHandlesGeometrically(sc, tc));
    } else {
      handles.set(edge.id, { ...defaultHandles });
    }
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
export function layoutImportedDiagram(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), handles: new Map(), edgeLabelPositions: new Map() };
  }

  try {
    return dagreLayout(nodes, edges, direction, orderOfAppearance);
  } catch (err) {
    console.error('[mermaidLayout] Dagre layout failed, falling back to grid:', err);
    return gridFallback(nodes, edges, direction);
  }
}

function dagreLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  direction: DiagramDirection,
  orderOfAppearance: string[],
): LayoutResult {
  const rankdir = toRankdir(direction);

  // 1. Create and configure the Dagre graph
  const g = new Graph({ directed: true, multigraph: true, compound: false });
  g.setGraph({
    rankdir,
    ranker: 'network-simplex',
    acyclicer: 'greedy',
    nodesep: BASE_NODE_GAP,
    ranksep: BASE_RANK_GAP,
    edgesep: BASE_EDGE_GAP,
    marginx: 20,
    marginy: 20,
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
  const sortedEdges = [...edges].sort(stableEdgeOrder);
  for (const edge of sortedEdges) {
    const label = edge.label || '';
    const w = label ? label.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X : 0;
    const h = label ? LABEL_LINE_HEIGHT : 0;

    // All edge types (directed, undirected, bidirectional) are given to Dagre
    // to influence rank and proximity. For undirected/bidirectional edges,
    // use a deterministic orientation (lexicographic) for Dagre's DAG.
    // This orientation is internal to layout and has no effect on rendering.
    const dir = edge.direction ?? 'directed';
    if (dir === 'undirected' || dir === 'bidirectional') {
      // Deterministic orientation for layout: lower id → higher id
      const [from, to] = edge.from <= edge.to
        ? [edge.from, edge.to]
        : [edge.to, edge.from];
      g.setEdge(from, to, { width: w, height: h, labelpos: 'c' }, edge.id);
    } else {
      g.setEdge(edge.from, edge.to, { width: w, height: h, labelpos: 'c' }, edge.id);
    }
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
    const sourceCenter = centerPositions.get(edge.from);
    const targetCenter = centerPositions.get(edge.to);

    if (sourceCenter && targetCenter) {
      // Self-loops: use default directional handles
      if (edge.from === edge.to) {
        handles.set(edge.id, { ...defaultHandles });
      } else {
        handles.set(edge.id, selectHandlesGeometrically(sourceCenter, targetCenter));
      }
    } else {
      handles.set(edge.id, { ...defaultHandles });
    }
  }

  // 7. Extract edge label positions computed by Dagre
  const edgeLabelPositions = new Map<string, { x: number; y: number }>();
  for (const edge of sortedEdges) {
    if (!edge.label) continue;
    
    // Dagre requires querying the edge using the exact from/to direction
    // that was passed to g.setEdge. We used 'directed' behavior.
    let from = edge.from;
    let to = edge.to;
    
    // For undirected/bidirectional edges we sorted from/to alphabetically in setEdge
    const dir = edge.direction ?? 'directed';
    if (dir === 'undirected' || dir === 'bidirectional') {
      if (edge.from > edge.to) {
        from = edge.to;
        to = edge.from;
      }
    }
    
    const dagreEdge = g.edge(from, to, edge.id);
    if (dagreEdge && dagreEdge.x !== undefined && dagreEdge.y !== undefined) {
      edgeLabelPositions.set(edge.id, { x: dagreEdge.x, y: dagreEdge.y });
    }
  }

  return { positions, handles, edgeLabelPositions };
}
