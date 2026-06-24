import { describe, test, expect } from 'vitest';
import {
  computeVirtualAnchors,
  getNodeCenter,
  sideFromHandle,
  ANCHOR_MARGIN_RATIO,
  type NodeRect,
  type EdgeInfo,
} from './virtualEdgeAnchors';

// ---------------------------------------------------------------------------
// Helper to compute expected ratio for a given index and count
// ---------------------------------------------------------------------------
function expectedRatio(index: number, count: number): number {
  return ANCHOR_MARGIN_RATIO + (index + 1) * (1 - 2 * ANCHOR_MARGIN_RATIO) / (count + 1);
}

// ---------------------------------------------------------------------------
// Utility: getNodeCenter
// ---------------------------------------------------------------------------
describe('getNodeCenter', () => {
  test('computes center from top-left rect', () => {
    const rect: NodeRect = { x: 100, y: 200, width: 80, height: 60 };
    const center = getNodeCenter(rect);
    expect(center.x).toBe(140);
    expect(center.y).toBe(230);
  });

  test('handles zero position', () => {
    const rect: NodeRect = { x: 0, y: 0, width: 100, height: 100 };
    const center = getNodeCenter(rect);
    expect(center.x).toBe(50);
    expect(center.y).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Utility: sideFromHandle
// ---------------------------------------------------------------------------
describe('sideFromHandle', () => {
  test('resolves top handles', () => {
    expect(sideFromHandle('t-source')).toBe('top');
    expect(sideFromHandle('t-target')).toBe('top');
  });

  test('resolves right handles', () => {
    expect(sideFromHandle('r-source')).toBe('right');
    expect(sideFromHandle('r-target')).toBe('right');
  });

  test('resolves bottom handles', () => {
    expect(sideFromHandle('b-source')).toBe('bottom');
    expect(sideFromHandle('b-target')).toBe('bottom');
  });

  test('resolves left handles', () => {
    expect(sideFromHandle('l-source')).toBe('left');
    expect(sideFromHandle('l-target')).toBe('left');
  });

  test('returns null for undefined', () => {
    expect(sideFromHandle(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(sideFromHandle('')).toBeNull();
  });

  test('returns null for unrecognized format', () => {
    expect(sideFromHandle('x-source')).toBeNull();
    expect(sideFromHandle('top')).toBeNull();
    expect(sideFromHandle('source')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — ratio distribution
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — ratio distribution', () => {
  // Standard node rects for testing
  const nodeA: NodeRect = { x: 0, y: 0, width: 100, height: 100 };
  const nodeB: NodeRect = { x: 300, y: 0, width: 100, height: 100 };

  test('1 edge on a side → ratio 50%', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', nodeA],
      ['B', nodeB],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1']).toBeDefined();
    expect(result['e1'].sourceRatio).toBeCloseTo(0.5);
    expect(result['e1'].targetRatio).toBeCloseTo(0.5);
  });

  test('2 edges on same side → 36.67%, 63.33%', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', nodeA],
      ['B', { ...nodeB, y: -50 }],
      ['C', { ...nodeB, y: 50 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e2', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Both target the right side of A — should be distributed
    const r1 = expectedRatio(0, 2); // ~0.3667
    const r2 = expectedRatio(1, 2); // ~0.6333
    expect(result['e1'].targetRatio).toBeCloseTo(r1, 4);
    expect(result['e2'].targetRatio).toBeCloseTo(r2, 4);
  });

  test('3 edges on same side → 30%, 50%, 70%', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', nodeA],
      ['B', { ...nodeB, y: -100 }],
      ['C', { ...nodeB, y: 0 }],
      ['D', { ...nodeB, y: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e2', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e3', source: 'D', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1'].targetRatio).toBeCloseTo(0.30, 4);
    expect(result['e2'].targetRatio).toBeCloseTo(0.50, 4);
    expect(result['e3'].targetRatio).toBeCloseTo(0.70, 4);
  });

  test('margin is respected — no anchor < 10% or > 90%', () => {
    // 6 edges targeting the right side of A
    const nodeRects = new Map<string, NodeRect>([['A', nodeA]]);
    const edges: EdgeInfo[] = [];
    for (let i = 0; i < 6; i++) {
      const nId = `N${i}`;
      nodeRects.set(nId, { x: 300, y: -150 + i * 60, width: 100, height: 100 });
      edges.push({
        id: `e${i}`,
        source: nId,
        target: 'A',
        sourceHandle: 'l-source',
        targetHandle: 'r-target',
      });
    }

    const result = computeVirtualAnchors(nodeRects, edges);

    for (let i = 0; i < 6; i++) {
      const anchor = result[`e${i}`];
      expect(anchor).toBeDefined();
      expect(anchor.targetRatio).toBeGreaterThanOrEqual(ANCHOR_MARGIN_RATIO);
      expect(anchor.targetRatio).toBeLessThanOrEqual(1 - ANCHOR_MARGIN_RATIO);
    }
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — geometric sorting (no crossings)
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — geometric sorting', () => {
  test('edges sorted by opposite node centerY on left/right sides', () => {
    // A is on the left, B/C/D arrive on A's right side from different Y positions
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['top', { x: 300, y: -100, width: 100, height: 100 }],
      ['mid', { x: 300, y: 50, width: 100, height: 100 }],
      ['bot', { x: 300, y: 200, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      // Deliberately out of Y order
      { id: 'eBot', source: 'bot', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'eTop', source: 'top', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'eMid', source: 'mid', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // On A's right side, edges should be sorted by source centerY:
    // top (Y=-50) < mid (Y=100) < bot (Y=250)
    expect(result['eTop'].targetRatio).toBeLessThan(result['eMid'].targetRatio);
    expect(result['eMid'].targetRatio).toBeLessThan(result['eBot'].targetRatio);
  });

  test('edges sorted by opposite node centerX on top/bottom sides', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 200, y: 0, width: 100, height: 100 }],
      ['left', { x: 0, y: 200, width: 100, height: 100 }],
      ['mid', { x: 200, y: 200, width: 100, height: 100 }],
      ['right', { x: 400, y: 200, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'eRight', source: 'right', target: 'A', sourceHandle: 't-source', targetHandle: 'b-target' },
      { id: 'eLeft', source: 'left', target: 'A', sourceHandle: 't-source', targetHandle: 'b-target' },
      { id: 'eMid', source: 'mid', target: 'A', sourceHandle: 't-source', targetHandle: 'b-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // On A's bottom side, edges sorted by source centerX:
    // left (X=50) < mid (X=250) < right (X=450)
    expect(result['eLeft'].targetRatio).toBeLessThan(result['eMid'].targetRatio);
    expect(result['eMid'].targetRatio).toBeLessThan(result['eRight'].targetRatio);
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — geometric fallback (no handle)
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — geometric fallback', () => {
  test('edges without handles use geometric side resolution', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: 0, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B' }, // no handles
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1']).toBeDefined();
    // B is to the right of A → source=right, target=left
    expect(result['e1'].sourceSide).toBe('right');
    expect(result['e1'].targetSide).toBe('left');
  });

  test('vertical geometric fallback', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 0, y: 300, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // B is below A → source=bottom, target=top
    expect(result['e1'].sourceSide).toBe('bottom');
    expect(result['e1'].targetSide).toBe('top');
  });

  test('partial handle — one side from handle, other from geometry', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: 0, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source' }, // target handle missing
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1'].sourceSide).toBe('right');
    expect(result['e1'].targetSide).toBe('left'); // geometric fallback
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — exclusions
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — exclusions', () => {
  test('self-loops are excluded', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'A', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1']).toBeUndefined();
  });

  test('edges with missing node rects are excluded', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      // 'B' is missing
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1']).toBeUndefined();
  });

  test('edges with zero-dimension nodes are excluded', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: 0, width: 0, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['e1']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — determinism / stable ordering
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — determinism', () => {
  test('tie-breaker: same position → sorted by edge.id', () => {
    // Two edges with identical opposite node positions
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: 0, width: 100, height: 100 }],
      ['C', { x: 300, y: 0, width: 100, height: 100 }], // same position as B
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e2', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e1', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Both edges have the same opposite center — tie-broken by edge.id
    // 'e1' < 'e2' → e1 gets lower ratio
    expect(result['e1'].targetRatio).toBeLessThan(result['e2'].targetRatio);
  });

  test('same topology, reversed edge array order → same ratios per edge ID', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: -50, width: 100, height: 100 }],
      ['C', { x: 300, y: 50, width: 100, height: 100 }],
      ['D', { x: 300, y: 150, width: 100, height: 100 }],
    ]);
    const edgesForward: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e2', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e3', source: 'D', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];
    const edgesReversed: EdgeInfo[] = [...edgesForward].reverse();

    const resultForward = computeVirtualAnchors(nodeRects, edgesForward);
    const resultReversed = computeVirtualAnchors(nodeRects, edgesReversed);

    // Same ratios regardless of input order
    expect(resultForward['e1'].targetRatio).toBeCloseTo(resultReversed['e1'].targetRatio, 10);
    expect(resultForward['e2'].targetRatio).toBeCloseTo(resultReversed['e2'].targetRatio, 10);
    expect(resultForward['e3'].targetRatio).toBeCloseTo(resultReversed['e3'].targetRatio, 10);
    expect(resultForward['e1'].sourceRatio).toBeCloseTo(resultReversed['e1'].sourceRatio, 10);
    expect(resultForward['e2'].sourceRatio).toBeCloseTo(resultReversed['e2'].sourceRatio, 10);
    expect(resultForward['e3'].sourceRatio).toBeCloseTo(resultReversed['e3'].sourceRatio, 10);
  });

  test('same topology, shuffled edge array → same ratios per edge ID', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: -50, width: 100, height: 100 }],
      ['C', { x: 300, y: 50, width: 100, height: 100 }],
    ]);
    const edgesOrder1: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e2', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];
    const edgesOrder2: EdgeInfo[] = [
      { id: 'e2', source: 'C', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'l-source', targetHandle: 'r-target' },
    ];

    const result1 = computeVirtualAnchors(nodeRects, edgesOrder1);
    const result2 = computeVirtualAnchors(nodeRects, edgesOrder2);

    expect(result1['e1'].targetRatio).toBeCloseTo(result2['e1'].targetRatio, 10);
    expect(result1['e2'].targetRatio).toBeCloseTo(result2['e2'].targetRatio, 10);
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — coordinate computation
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — coordinates', () => {
  test('left side: x = node.x, y varies along height', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 100, y: 50, width: 80, height: 120 }],
      ['B', { x: -200, y: 50, width: 80, height: 120 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Target is left side of A: x = 100, y = 50 + 0.5 * 120 = 110
    expect(result['e1'].targetX).toBe(100);
    expect(result['e1'].targetY).toBe(50 + 0.5 * 120);
  });

  test('right side: x = node.x + width, y varies along height', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 100, y: 50, width: 80, height: 120 }],
      ['B', { x: 400, y: 50, width: 80, height: 120 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Source is right side of A: x = 100 + 80 = 180, y = 50 + 0.5 * 120 = 110
    expect(result['e1'].sourceX).toBe(180);
    expect(result['e1'].sourceY).toBe(50 + 0.5 * 120);
  });

  test('top side: y = node.y, x varies along width', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 100, y: 200, width: 80, height: 120 }],
      ['B', { x: 100, y: -100, width: 80, height: 120 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'B', target: 'A', sourceHandle: 'b-source', targetHandle: 't-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Target is top side of A: x = 100 + 0.5 * 80 = 140, y = 200
    expect(result['e1'].targetX).toBe(140);
    expect(result['e1'].targetY).toBe(200);
  });

  test('bottom side: y = node.y + height, x varies along width', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 100, y: 50, width: 80, height: 120 }],
      ['B', { x: 100, y: 300, width: 80, height: 120 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'b-source', targetHandle: 't-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    // Source is bottom side of A: x = 100 + 0.5 * 80 = 140, y = 50 + 120 = 170
    expect(result['e1'].sourceX).toBe(140);
    expect(result['e1'].sourceY).toBe(170);
  });
});

// ---------------------------------------------------------------------------
// computeVirtualAnchors — empty / edge cases
// ---------------------------------------------------------------------------
describe('computeVirtualAnchors — edge cases', () => {
  test('empty edges → empty result', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
    ]);
    const result = computeVirtualAnchors(nodeRects, []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('empty nodes → empty result', () => {
    const edges: EdgeInfo[] = [
      { id: 'e1', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];
    const result = computeVirtualAnchors(new Map(), edges);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('mix of valid, self-loop, and missing-node edges', () => {
    const nodeRects = new Map<string, NodeRect>([
      ['A', { x: 0, y: 0, width: 100, height: 100 }],
      ['B', { x: 300, y: 0, width: 100, height: 100 }],
    ]);
    const edges: EdgeInfo[] = [
      { id: 'valid', source: 'A', target: 'B', sourceHandle: 'r-source', targetHandle: 'l-target' },
      { id: 'self', source: 'A', target: 'A', sourceHandle: 'r-source', targetHandle: 'l-target' },
      { id: 'missing', source: 'A', target: 'Z', sourceHandle: 'r-source', targetHandle: 'l-target' },
    ];

    const result = computeVirtualAnchors(nodeRects, edges);

    expect(result['valid']).toBeDefined();
    expect(result['self']).toBeUndefined();
    expect(result['missing']).toBeUndefined();
  });
});
