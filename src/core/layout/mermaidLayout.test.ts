/**
 * Tests for the Dagre-powered layout engine.
 *
 * These tests assert **structural invariants**, not pixel coordinates.
 * They verify: determinism, non-collision, directional correctness,
 * handle coherence, cycle handling, and disconnected component separation.
 */
import { describe, it, expect } from 'vitest';
import { layoutImportedDiagram } from './mermaidLayout';
import type { DiagramNode, DiagramEdge, DiagramDirection } from '../types';
import { NODE_SIZE_DEFAULTS } from '../nodeSizeConfig';

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
): DiagramEdge {
  return { id, from, to, label: '', style, direction };
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
