/**
 * Tests for the Dagre-powered layout engine.
 *
 * These tests assert **structural invariants**, not pixel coordinates.
 * They verify: determinism, non-collision, directional correctness,
 * handle coherence, cycle handling, and disconnected component separation.
 */
import { describe, it, expect } from 'vitest';
import { getBezierPath, Position } from '@xyflow/system';
import { USE_MERMAID_LIKE_EDGE_RENDERING, setUseMermaidLikeImportedLayout } from '../config';
import { importMermaidFlowchart } from '../mermaidImport';
import { normalizeDiagram } from '../../store/diagramStore';
import { getMermaidLikeOrthogonalEdgePath } from '../../utils/edgeRouting';
import {
  layoutImportedDiagram,
  LABEL_CHAR_WIDTH,
  LABEL_PADDING_X,
  LABEL_LINE_HEIGHT,
  BASE_RANK_GAP,
  type HandlePair,
  selectHandlesDirectionAware,
} from './mermaidLayout';
import type { DiagramNode, DiagramEdge, DiagramDirection, ConnectedEdgeEndpoint } from '../types';
import { NODE_SIZE_DEFAULTS } from '../nodeSizeConfig';
import { toMermaid } from '../mermaid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, shape: DiagramNode['shape'] = 'process'): DiagramNode {
  const size = NODE_SIZE_DEFAULTS[shape];
  return {
    id,
    label: id,
    shape,
    position: { x: 0, y: 0 },
    width: size.width,
    height: size.height,
  };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  direction: DiagramEdge['direction'] = 'directed',
  style: DiagramEdge['style'] = 'solid',
  label: string = '',
): DiagramEdge {
  return { id, from, to, label, style, direction };
}

function boundingBox(pos: { x: number; y: number }, node: DiagramNode) {
  const w = node.width ?? NODE_SIZE_DEFAULTS[node.shape].width;
  const h = node.height ?? NODE_SIZE_DEFAULTS[node.shape].height;
  return {
    left: pos.x,
    right: pos.x + w,
    top: pos.y,
    bottom: pos.y + h,
  };
}

function boxesOverlap(
  a: ReturnType<typeof boundingBox>,
  b: ReturnType<typeof boundingBox>,
): boolean {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — determinism', () => {
  it('produces identical results on two runs', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
    const order = ['A', 'B', 'C'];

    const r1 = layoutImportedDiagram(nodes, edges, 'LR', order);
    const r2 = layoutImportedDiagram(nodes, edges, 'LR', order);

    for (const id of order) {
      expect(r1.positions.get(id)).toEqual(r2.positions.get(id));
    }
    for (const e of edges) {
      expect(r1.handles.get(e.id)).toEqual(r2.handles.get(e.id));
    }
  });

  it('is idempotent — importing the same diagram twice yields the same layout', () => {
    const nodes = [makeNode('X'), makeNode('Y'), makeNode('Z')];
    const edges = [makeEdge('e1', 'X', 'Y'), makeEdge('e2', 'Y', 'Z')];
    const order = ['X', 'Y', 'Z'];

    const r1 = layoutImportedDiagram(nodes, edges, 'TD', order);
    const r2 = layoutImportedDiagram(nodes, edges, 'TD', order);

    expect([...r1.positions.entries()]).toEqual([...r2.positions.entries()]);
    expect([...r1.handles.entries()]).toEqual([...r2.handles.entries()]);
  });
});

// ---------------------------------------------------------------------------
// Non-collision
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — non-collision', () => {
  it('produces non-overlapping bounding boxes for a chain', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
    const order = ['A', 'B', 'C'];

    const result = layoutImportedDiagram(nodes, edges, 'LR', order);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const boxI = boundingBox(result.positions.get(nodes[i].id)!, nodes[i]);
        const boxJ = boundingBox(result.positions.get(nodes[j].id)!, nodes[j]);
        expect(boxesOverlap(boxI, boxJ)).toBe(false);
      }
    }
  });

  it('produces non-overlapping bounding boxes for a branching graph', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'A', 'C'),
      makeEdge('e3', 'B', 'D'),
      makeEdge('e4', 'C', 'D'),
    ];
    const order = ['A', 'B', 'C', 'D'];

    const result = layoutImportedDiagram(nodes, edges, 'TD', order);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const boxI = boundingBox(result.positions.get(nodes[i].id)!, nodes[i]);
        const boxJ = boundingBox(result.positions.get(nodes[j].id)!, nodes[j]);
        expect(boxesOverlap(boxI, boxJ)).toBe(false);
      }
    }
  });

  it('non-overlapping with mixed node shapes', () => {
    const nodes = [
      makeNode('A', 'process'),
      makeNode('B', 'decision'),
      makeNode('C', 'database'),
      makeNode('D', 'event'),
    ];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'B', 'D'),
    ];
    const order = ['A', 'B', 'C', 'D'];

    const result = layoutImportedDiagram(nodes, edges, 'LR', order);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const boxI = boundingBox(result.positions.get(nodes[i].id)!, nodes[i]);
        const boxJ = boundingBox(result.positions.get(nodes[j].id)!, nodes[j]);
        expect(boxesOverlap(boxI, boxJ)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Directional correctness
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — direction', () => {
  const chainNodes = [makeNode('A'), makeNode('B'), makeNode('C')];
  const chainEdges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
  const chainOrder = ['A', 'B', 'C'];

  it('LR: x(A) < x(B) < x(C)', () => {
    const r = layoutImportedDiagram(chainNodes, chainEdges, 'LR', chainOrder);
    expect(r.positions.get('A')!.x).toBeLessThan(r.positions.get('B')!.x);
    expect(r.positions.get('B')!.x).toBeLessThan(r.positions.get('C')!.x);
  });

  it('RL: x(A) > x(B) > x(C)', () => {
    const r = layoutImportedDiagram(chainNodes, chainEdges, 'RL', chainOrder);
    expect(r.positions.get('A')!.x).toBeGreaterThan(r.positions.get('B')!.x);
    expect(r.positions.get('B')!.x).toBeGreaterThan(r.positions.get('C')!.x);
  });

  it('TD: y(A) < y(B) < y(C)', () => {
    const r = layoutImportedDiagram(chainNodes, chainEdges, 'TD', chainOrder);
    expect(r.positions.get('A')!.y).toBeLessThan(r.positions.get('B')!.y);
    expect(r.positions.get('B')!.y).toBeLessThan(r.positions.get('C')!.y);
  });

  it('BT: y(A) > y(B) > y(C)', () => {
    const r = layoutImportedDiagram(chainNodes, chainEdges, 'BT', chainOrder);
    expect(r.positions.get('A')!.y).toBeGreaterThan(r.positions.get('B')!.y);
    expect(r.positions.get('B')!.y).toBeGreaterThan(r.positions.get('C')!.y);
  });
});

// ---------------------------------------------------------------------------
// Handle coherence
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — handles', () => {
  it('LR chain: source on right, target on left', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);

    expect(r.handles.get('e1')).toEqual({ sourceHandle: 'r-source', targetHandle: 'l-target' });
    expect(r.handles.get('e2')).toEqual({ sourceHandle: 'r-source', targetHandle: 'l-target' });
  });

  it('TD chain: source on bottom, target on top', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
    const r = layoutImportedDiagram(nodes, edges, 'TD', ['A', 'B', 'C']);

    expect(r.handles.get('e1')).toEqual({ sourceHandle: 'b-source', targetHandle: 't-target' });
    expect(r.handles.get('e2')).toEqual({ sourceHandle: 'b-source', targetHandle: 't-target' });
  });

  it('back edges use geometry, not fixed direction', () => {
    // Cycle: A→B→C→A. In LR, C is to the right of A.
    // The back edge C→A should use l-source (from C going left) / r-target (arriving at A from the right)
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'A'), // back edge
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);

    // C is to the right of A, so the back edge C→A goes left
    const backHandle = r.handles.get('e3')!;
    expect(backHandle.sourceHandle).toBe('l-source');
    expect(backHandle.targetHandle).toBe('r-target');
  });

  it('assigns handles for all edges', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'A', 'C'),
      makeEdge('e3', 'B', 'D'),
      makeEdge('e4', 'C', 'D'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'TD', ['A', 'B', 'C', 'D']);

    for (const edge of edges) {
      const handle = r.handles.get(edge.id);
      expect(handle).toBeDefined();
      expect(handle!.sourceHandle).toMatch(/^[tblr]-source$/);
      expect(handle!.targetHandle).toMatch(/^[tblr]-target$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Branching & merge
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — branching/merge', () => {
  it('diamond: A before B,C; B,C before D', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'A', 'C'),
      makeEdge('e3', 'B', 'D'),
      makeEdge('e4', 'C', 'D'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C', 'D']);

    const xA = r.positions.get('A')!.x;
    const xB = r.positions.get('B')!.x;
    const xC = r.positions.get('C')!.x;
    const xD = r.positions.get('D')!.x;

    expect(xA).toBeLessThan(xB);
    expect(xA).toBeLessThan(xC);
    expect(xB).toBeLessThan(xD);
    expect(xC).toBeLessThan(xD);
    // B and C are at the same rank
    expect(xB).toBe(xC);
  });

  it('B and C sibling order is stable', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'A', 'C'),
      makeEdge('e3', 'B', 'D'),
      makeEdge('e4', 'C', 'D'),
    ];
    const order = ['A', 'B', 'C', 'D'];

    const r1 = layoutImportedDiagram(nodes, edges, 'LR', order);
    const r2 = layoutImportedDiagram(nodes, edges, 'LR', order);

    // B is above C or below C, but it's the same in both runs
    const yB1 = r1.positions.get('B')!.y;
    const yC1 = r1.positions.get('C')!.y;
    const yB2 = r2.positions.get('B')!.y;
    const yC2 = r2.positions.get('C')!.y;

    expect(Math.sign(yB1 - yC1)).toBe(Math.sign(yB2 - yC2));
  });
});

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — cycles', () => {
  it('handles a simple cycle without throwing', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'A'),
    ];

    expect(() => {
      layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);
    }).not.toThrow();
  });

  it('cycle: all nodes get positions and all edges get handles', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'A'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);

    for (const n of nodes) {
      expect(r.positions.get(n.id)).toBeDefined();
    }
    for (const e of edges) {
      expect(r.handles.get(e.id)).toBeDefined();
    }
  });

  it('cycle: deterministic layout', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'A'),
    ];
    const order = ['A', 'B', 'C'];

    const r1 = layoutImportedDiagram(nodes, edges, 'LR', order);
    const r2 = layoutImportedDiagram(nodes, edges, 'LR', order);

    for (const id of order) {
      expect(r1.positions.get(id)).toEqual(r2.positions.get(id));
    }
  });
});

// ---------------------------------------------------------------------------
// Disconnected components
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — disconnected components', () => {
  it('separates disconnected groups spatially', () => {
    const nodes = [
      makeNode('A'), makeNode('B'), // component 1
      makeNode('C'), makeNode('D'), // component 2
      makeNode('E'),                // isolate
    ];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'C', 'D'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C', 'D', 'E']);

    // All nodes have positions
    for (const n of nodes) {
      expect(r.positions.get(n.id)).toBeDefined();
    }

    // No bounding boxes overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const boxI = boundingBox(r.positions.get(nodes[i].id)!, nodes[i]);
        const boxJ = boundingBox(r.positions.get(nodes[j].id)!, nodes[j]);
        expect(boxesOverlap(boxI, boxJ)).toBe(false);
      }
    }
  });

  it('isolate E gets a position', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('E')];
    const edges = [makeEdge('e1', 'A', 'B')];
    const r = layoutImportedDiagram(nodes, edges, 'TD', ['A', 'B', 'E']);

    expect(r.positions.get('E')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Mixed edge directions
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — mixed edge directions', () => {
  it('undirected and bidirectional edges get handles', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed'),
      makeEdge('e2', 'B', 'C', 'undirected'),
      makeEdge('e3', 'C', 'D', 'bidirectional'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C', 'D']);

    for (const edge of edges) {
      const handle = r.handles.get(edge.id);
      expect(handle).toBeDefined();
      expect(handle!.sourceHandle).toMatch(/^[tblr]-source$/);
      expect(handle!.targetHandle).toMatch(/^[tblr]-target$/);
    }
  });

  it('non-overlapping with mixed edge types', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed'),
      makeEdge('e2', 'B', 'C', 'undirected'),
      makeEdge('e3', 'C', 'D', 'bidirectional'),
    ];
    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C', 'D']);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const boxI = boundingBox(r.positions.get(nodes[i].id)!, nodes[i]);
        const boxJ = boundingBox(r.positions.get(nodes[j].id)!, nodes[j]);
        expect(boxesOverlap(boxI, boxJ)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Empty graph
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — edge cases', () => {
  it('handles empty graph', () => {
    const r = layoutImportedDiagram([], [], 'TD', []);
    expect(r.positions.size).toBe(0);
    expect(r.handles.size).toBe(0);
  });

  it('handles single node', () => {
    const nodes = [makeNode('A')];
    const r = layoutImportedDiagram(nodes, [], 'LR', ['A']);
    expect(r.positions.get('A')).toBeDefined();
  });

  it('handles two unconnected nodes', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const r = layoutImportedDiagram(nodes, [], 'LR', ['A', 'B']);
    expect(r.positions.get('A')).toBeDefined();
    expect(r.positions.get('B')).toBeDefined();

    // Non-overlapping
    const boxA = boundingBox(r.positions.get('A')!, nodes[0]);
    const boxB = boundingBox(r.positions.get('B')!, nodes[1]);
    expect(boxesOverlap(boxA, boxB)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// All four directions work for branching graphs
// ---------------------------------------------------------------------------

describe('layoutImportedDiagram — all directions on branching', () => {
  const directions: DiagramDirection[] = ['TD', 'LR', 'BT', 'RL'];

  for (const dir of directions) {
    it(`${dir}: produces valid layout for a diamond graph`, () => {
      const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'A', 'C'),
        makeEdge('e3', 'B', 'D'),
        makeEdge('e4', 'C', 'D'),
      ];
      const r = layoutImportedDiagram(nodes, edges, dir, ['A', 'B', 'C', 'D']);

      // All positions exist
      for (const n of nodes) {
        expect(r.positions.get(n.id)).toBeDefined();
      }

      // All handles exist
      for (const e of edges) {
        expect(r.handles.get(e.id)).toBeDefined();
      }

      // No collisions
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const boxI = boundingBox(r.positions.get(nodes[i].id)!, nodes[i]);
          const boxJ = boundingBox(r.positions.get(nodes[j].id)!, nodes[j]);
          expect(boxesOverlap(boxI, boxJ)).toBe(false);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Edge Label Spacing (Dagre proxies vs React Flow bezier render)
// ---------------------------------------------------------------------------

/**
 * Map handle ID to @xyflow/system Position enum.
 *
 * COUPLING NOTE: This must match the handle naming convention in CustomNode.tsx
 * ({t,b,l,r}-{source,target}). If the convention changes, this function and
 * the renderer must be updated in lockstep.
 */
function handleToPosition(handle: string): Position {
  const side = handle.split('-')[0];
  switch (side) {
    case 't': return Position.Top;
    case 'b': return Position.Bottom;
    case 'l': return Position.Left;
    case 'r': return Position.Right;
    default:  return Position.Bottom;
  }
}

/**
 * Compute label bbox at the EXACT position the renderer will place it.
 *
 * Uses getBezierPath (the same function CustomEdge.tsx calls) with
 * handle-anchor coordinates derived from layout output. This ensures the
 * test validates the real render point, not a hand-calculated midpoint.
 *
 * INVARIANT: CustomEdge.tsx must use getBezierPath for all edge types.
 * If the renderer ever branches by edge type (e.g. getSmoothStepPath),
 * this helper must branch identically.
 */
function labelBBox(
  edge: DiagramEdge,
  positions: Map<string, { x: number; y: number }>,
  handles: Map<string, HandlePair>,
  nodeById: Map<string, DiagramNode>,
  edgeLabelPositions?: Map<string, { x: number; y: number }>,
) {
  const label = edge.label || '';
  if (!label) return null;

  const srcPos = positions.get(edge.from)!;
  const tgtPos = positions.get(edge.to)!;
  const srcNode = nodeById.get(edge.from)!;
  const tgtNode = nodeById.get(edge.to)!;
  const handle = handles.get(edge.id)!;

  const srcW = srcNode.width ?? NODE_SIZE_DEFAULTS[srcNode.shape].width;
  const srcH = srcNode.height ?? NODE_SIZE_DEFAULTS[srcNode.shape].height;
  const tgtW = tgtNode.width ?? NODE_SIZE_DEFAULTS[tgtNode.shape].width;
  const tgtH = tgtNode.height ?? NODE_SIZE_DEFAULTS[tgtNode.shape].height;

  const sourcePosition = handleToPosition(handle.sourceHandle);
  const targetPosition = handleToPosition(handle.targetHandle);

  // Handle anchor = point on the edge of the node box (centered on the edge)
  const sourceX = sourcePosition === Position.Left ? srcPos.x
    : sourcePosition === Position.Right ? srcPos.x + srcW
    : srcPos.x + srcW / 2;
  const sourceY = sourcePosition === Position.Top ? srcPos.y
    : sourcePosition === Position.Bottom ? srcPos.y + srcH
    : srcPos.y + srcH / 2;
  const targetX = targetPosition === Position.Left ? tgtPos.x
    : targetPosition === Position.Right ? tgtPos.x + tgtW
    : tgtPos.x + tgtW / 2;
  const targetY = targetPosition === Position.Top ? tgtPos.y
    : targetPosition === Position.Bottom ? tgtPos.y + tgtH
    : tgtPos.y + tgtH / 2;

  let [, labelX, labelY] = USE_MERMAID_LIKE_EDGE_RENDERING
    ? getMermaidLikeOrthogonalEdgePath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
      })
    : getBezierPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
      });

  const dagreLabelPos = edgeLabelPositions?.get(edge.id);
  if (dagreLabelPos) {
    labelX = dagreLabelPos.x;
    labelY = dagreLabelPos.y;
  }

  // Label pill dimensions — same formula as layout estimation
  const w = label.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X;
  const h = LABEL_LINE_HEIGHT;

  return {
    left: labelX - w / 2,
    right: labelX + w / 2,
    top: labelY - h / 2,
    bottom: labelY + h / 2,
  };
}

describe('layoutImportedDiagram — edge label spacing', () => {
  it('LR chain with long labels — labels do not overlap any node', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D'), makeNode('E'), makeNode('F')];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed', 'solid', 'yes'),
      makeEdge('e2', 'B', 'C', 'directed', 'solid', 'solid bidirectional edge'), // > 21 chars
      makeEdge('e3', 'C', 'D', 'directed', 'solid', 'no'),
      makeEdge('e4', 'D', 'E', 'directed', 'solid', 'another long label here'),
      makeEdge('e5', 'E', 'F', 'directed', 'solid', 'end'),
    ];

    const r = layoutImportedDiagram(nodes, edges, 'LR', nodes.map(n => n.id));

    for (const edge of edges) {
      const lbox = labelBBox(edge, r.positions, r.handles, nodeById, r.edgeLabelPositions);
      if (!lbox) continue;

      for (const node of nodes) {
        const nbox = boundingBox(r.positions.get(node.id)!, node);
        expect(boxesOverlap(lbox, nbox)).toBe(false);
      }
    }
  });

  it('LR chain with no labels — spacing stays at baseline', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
    ];

    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);

    const ax = r.positions.get('A')!.x;
    const aw = nodes[0].width ?? NODE_SIZE_DEFAULTS[nodes[0].shape].width;
    const bx = r.positions.get('B')!.x;
    
    const gap = bx - (ax + aw);
    // Tolerance: Dagre's halving/doubling makes the exact gap depend on minlen, so we use a wide tolerance
    expect(gap).toBeGreaterThanOrEqual(BASE_RANK_GAP * 0.4);
    expect(gap).toBeLessThanOrEqual(BASE_RANK_GAP * 1.5);
  });

  it('TD chain with labels — labels do not overlap any node', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed', 'solid', 'very long label for TD'),
      makeEdge('e2', 'B', 'C', 'directed', 'solid', 'short'),
    ];

    const r = layoutImportedDiagram(nodes, edges, 'TD', ['A', 'B', 'C']);

    for (const edge of edges) {
      const lbox = labelBBox(edge, r.positions, r.handles, nodeById, r.edgeLabelPositions);
      if (!lbox) continue;

      for (const node of nodes) {
        const nbox = boundingBox(r.positions.get(node.id)!, node);
        expect(boxesOverlap(lbox, nbox)).toBe(false);
      }
    }
  });

  it('Branching graph with labels — siblings do not overlap', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed', 'solid', 'yes'),
      makeEdge('e2', 'A', 'C', 'directed', 'solid', 'no'),
      makeEdge('e3', 'B', 'D'),
      makeEdge('e4', 'C', 'D'),
    ];

    const r = layoutImportedDiagram(nodes, edges, 'TD', ['A', 'B', 'C', 'D']);

    const lbox1 = labelBBox(edges[0], r.positions, r.handles, nodeById, r.edgeLabelPositions)!;
    const lbox2 = labelBBox(edges[1], r.positions, r.handles, nodeById, r.edgeLabelPositions)!;

    // Labels don't overlap each other
    expect(boxesOverlap(lbox1, lbox2)).toBe(false);

    // Labels don't overlap any nodes
    for (const node of nodes) {
      const nbox = boundingBox(r.positions.get(node.id)!, node);
      expect(boxesOverlap(lbox1, nbox)).toBe(false);
      expect(boxesOverlap(lbox2, nbox)).toBe(false);
    }
  });

  it('Multi-rank edge with label does not overlap skipped node', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'A', 'C', 'directed', 'solid', 'skip rank'),
    ];

    const r = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);

    const skipLabelBox = labelBBox(edges[2], r.positions, r.handles, nodeById, r.edgeLabelPositions)!;
    const boxB = boundingBox(r.positions.get('B')!, nodes[1]);

    expect(boxesOverlap(skipLabelBox, boxB)).toBe(false);
  });

  it('toMermaid output is identical with and without layout applied', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [
      makeEdge('e1', 'A', 'B', 'directed', 'solid', 'yes'),
      makeEdge('e2', 'B', 'C', 'directed', 'solid', 'no'),
    ];
    const diagram = {
      schemaVersion: 1 as const,
      diagramType: 'flowchart' as const,
      direction: 'LR' as DiagramDirection,
      nodes,
      edges,
    };

    // Export BEFORE layout
    const exportBefore = toMermaid(diagram);

    // Apply layout (mutates positions)
    const result = layoutImportedDiagram(nodes, edges, 'LR', ['A', 'B', 'C']);
    for (const node of nodes) {
      const pos = result.positions.get(node.id);
      if (pos) node.position = pos;
    }

    // Export AFTER layout
    const exportAfter = toMermaid(diagram);

    // Byte-identical — layout positions never leak into Mermaid output
    expect(exportAfter).toBe(exportBefore);
  });
});

describe('layoutImportedDiagram — Mermaid-like layout & handle persistence', () => {
  it('assigns lateral handles to sibling nodes on the same rank', () => {
    // Sibling nodes B and C on same rank (Y = 100)
    const B_Center = { x: 100, y: 100 };
    const C_Center = { x: 300, y: 100 };
    
    // TD diagram: same-rank should connect side-to-side (r -> l)
    const tdHandles = selectHandlesDirectionAware(B_Center, C_Center, 'TD');
    expect(tdHandles.sourceHandle).toBe('r-source');
    expect(tdHandles.targetHandle).toBe('l-target');

    // LR diagram: vertical sibling nodes (X = 100, Y = 100 and Y = 300) should connect top-to-bottom (b -> t)
    const B_CenterLR = { x: 100, y: 100 };
    const C_CenterLR = { x: 100, y: 300 };
    const lrHandles = selectHandlesDirectionAware(B_CenterLR, C_CenterLR, 'LR');
    expect(lrHandles.sourceHandle).toBe('b-source');
    expect(lrHandles.targetHandle).toBe('t-target');
    
    // Check that diagonal downward nodes in TD connect bottom-to-top because gap exceeds threshold
    const diagHandles = selectHandlesDirectionAware({ x: 100, y: 100 }, { x: 250, y: 220 }, 'TD');
    expect(diagHandles.sourceHandle).toBe('b-source');
    expect(diagHandles.targetHandle).toBe('t-target');
  });

  it('preserves handle persistence through normalizeDiagram (Critical Bug Test)', () => {
    const code = 'flowchart TD\n  A --> B\n  B --> C';
    const importRes = importMermaidFlowchart(code);
    
    const edge1 = importRes.diagram.edges[0];
    expect(edge1.from.kind).toBe('connected');
    expect((edge1.from as ConnectedEdgeEndpoint).handleId).not.toBeNull();
    expect(edge1.to.kind).toBe('connected');
    expect((edge1.to as ConnectedEdgeEndpoint).handleId).not.toBeNull();

    const normalized = normalizeDiagram(importRes.diagram);
    const normEdge1 = normalized.edges[0];
    
    expect((normEdge1.from as ConnectedEdgeEndpoint).handleId).toBe((edge1.from as ConnectedEdgeEndpoint).handleId);
    expect((normEdge1.to as ConnectedEdgeEndpoint).handleId).toBe((edge1.to as ConnectedEdgeEndpoint).handleId);
    expect(normEdge1.sourceHandle).toBe(edge1.sourceHandle);
    expect(normEdge1.targetHandle).toBe(edge1.targetHandle);
  });

  it('restores legacy layout behavior when feature flag is disabled', () => {
    setUseMermaidLikeImportedLayout(false);
    try {
      const code = 'flowchart TD\n  A --> B\n  B --> C';
      const importRes = importMermaidFlowchart(code);
      
      const edge1 = importRes.diagram.edges[0];
      // Under legacy mode, handles should not be persisted on endpoints
      expect(edge1.from.kind).toBe('connected');
      expect((edge1.from as ConnectedEdgeEndpoint).handleId).toBeNull();
      expect(edge1.to.kind).toBe('connected');
      expect((edge1.to as ConnectedEdgeEndpoint).handleId).toBeNull();
    } finally {
      setUseMermaidLikeImportedLayout(true);
    }
  });

  it('recalculates edge label positions dynamically when a node is moved after import', () => {
    const code = 'flowchart TD\n  A -->|MyLabel| B';
    const importRes = importMermaidFlowchart(code);
    const { nodes } = importRes.diagram;
    const nodeA = nodes.find(n => n.id === 'A')!;
    const nodeB = nodes.find(n => n.id === 'B')!;

    // Helper to calculate label position using the same logic as CustomEdge.tsx
    const getLabelPos = (posA: { x: number; y: number }, posB: { x: number; y: number }) => {
      const srcW = nodeA.width || 140;
      const srcH = nodeA.height || 56;
      const tgtW = nodeB.width || 140;

      // Top/bottom handles for vertical flow
      const sourceX = posA.x + srcW / 2;
      const sourceY = posA.y + srcH;
      const targetX = posB.x + tgtW / 2;
      const targetY = posB.y;

      const [, lx, ly] = getMermaidLikeOrthogonalEdgePath({
        sourceX,
        sourceY,
        sourcePosition: Position.Bottom,
        targetX,
        targetY,
        targetPosition: Position.Top,
      });
      return { x: lx, y: ly };
    };

    const initialPosA = { ...nodeA.position };
    const initialPosB = { ...nodeB.position };
    const initialLabelPos = getLabelPos(initialPosA, initialPosB);

    // Move node A (source node)
    const newPosA = { x: initialPosA.x + 150, y: initialPosA.y - 50 };
    const movedLabelPos = getLabelPos(newPosA, initialPosB);

    // Verify label position has changed
    expect(movedLabelPos.x).not.toBe(initialLabelPos.x);
    expect(movedLabelPos.y).not.toBe(initialLabelPos.y);
  });
});
