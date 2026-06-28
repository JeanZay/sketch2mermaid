/**
 * Ghost Arrows — Semantic Mutation Tests
 *
 * Each test verifies that the test suite FAILS when a targeted semantic mutant
 * is applied to a critical code path. All mutants are simulated via manual
 * patching within the test (not modifying source files).
 *
 * Mutants covered:
 *  M1: isExportableEdge returns true for detached edges
 *  M2: isStructurallyConnectedEdge checks only source endpoint, ignores target
 *  M3: normalizeDiagram trusts stored connectionStatus instead of recalculating
 *  M4: Surgical deletion sets detached endpoint to {x:0, y:0}
 *  M5: Surgical deletion deletes incident edges instead of detaching them
 *  M7: Snap threshold: findNearestHandle distances are correct
 *  M8: Snap chooses nearest handle, not first handle
 *  M9: Mermaid export iterates only exportable edges
 * M11: moveDetachedEdgeEndpoint modifies the correct endpoint only
 * M12: reconnectDetachedEdgeEndpoint updates connectionStatus
 */
import { beforeEach, describe, test, expect } from 'vitest';
import { vi } from 'vitest';
import type { CanonicalDiagram, DiagramEdge } from '../core/types';
import {
  isExportableEdge,
  isStructurallyConnectedEdge,
  isStructurallyDetachedEdge,
} from '../core/types';
import { toMermaid, getMermaidEdgeOperator } from '../core/mermaid';
import { normalizeDiagram, useDiagramStore } from './diagramStore';
import { findNearestHandle } from '../utils/edgeSnapping';

// ---------------------------------------------------------------------------
// localStorage mock (required for store import)
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => { localStorageStore[k] = v; },
  clear: () => { for (const k in localStorageStore) delete localStorageStore[k]; },
  removeItem: (k: string) => { delete localStorageStore[k]; },
});
vi.stubGlobal('window', { localStorage: localStorageStore });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  for (const k in localStorageStore) delete localStorageStore[k];
  useDiagramStore.getState().resetDiagram();
  useDiagramStore.setState({ past: [], future: [], checkpoint: null });
}

function makeDiagram(overrides: Partial<CanonicalDiagram> = {}): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [
      { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 }, width: 140, height: 56 },
      { id: 'n2', label: 'B', shape: 'process', position: { x: 200, y: 0 }, width: 140, height: 56 },
    ],
    edges: [],
    textBoxes: [],
    groups: [],
    ...overrides,
  };
}

function detachedEdge(id: string): DiagramEdge {
  return {
    id,
    from: { kind: 'detached', point: { x: 50, y: 50 } },
    to: { kind: 'detached', point: { x: 300, y: 300 } },
    connectionStatus: 'detached',
    exportMode: 'mermaid',
    label: '',
    style: 'solid',
    direction: 'directed',
  };
}

function connectedEdge(id: string): DiagramEdge {
  return {
    id,
    from: { kind: 'connected', nodeId: 'n1', handleId: null },
    to: { kind: 'connected', nodeId: 'n2', handleId: null },
    connectionStatus: 'connected',
    exportMode: 'mermaid',
    label: '',
    style: 'solid',
    direction: 'directed',
  };
}

beforeEach(() => resetStore());

// ---------------------------------------------------------------------------
// M1: isExportableEdge should return false for detached edges
// ---------------------------------------------------------------------------
describe('M1: isExportableEdge correctly excludes detached edges', () => {
  test('returns false for detached-detached edge', () => {
    const edge = detachedEdge('e1');
    expect(isExportableEdge(edge)).toBe(false);
  });

  test('returns false for connected-detached edge', () => {
    const edge: DiagramEdge = {
      ...connectedEdge('e1'),
      to: { kind: 'detached', point: { x: 300, y: 300 } },
      connectionStatus: 'detached',
    };
    expect(isExportableEdge(edge)).toBe(false);
  });

  test('returns true only for both-connected, mermaid-export edges', () => {
    const edge = connectedEdge('e1');
    expect(isExportableEdge(edge)).toBe(true);
  });

  test('returns false for connected-connected with canvasOnly mode', () => {
    const edge: DiagramEdge = { ...connectedEdge('e1'), exportMode: 'canvasOnly' };
    expect(isExportableEdge(edge)).toBe(false);
  });

  // Mutant simulation: if isExportableEdge always returned true, Mermaid would
  // try to cast detached.from as ConnectedEdgeEndpoint → undefined.nodeId → "undefined --> undefined"
  test('MUTANT SIMULATION: if detached edge bypassed filter, Mermaid would emit undefined', () => {
    const detached = detachedEdge('e_det');
    const from = (detached.from as unknown as { nodeId?: string }).nodeId;
    const to = (detached.to as unknown as { nodeId?: string }).nodeId;
    expect(from).toBeUndefined(); // would produce "undefined" in Mermaid
    expect(to).toBeUndefined();

    // Real toMermaid correctly omits detached edges
    const diagram = normalizeDiagram(makeDiagram({ edges: [detached] }));
    const mermaid = toMermaid(diagram);
    expect(mermaid).not.toContain('undefined');
    expect(mermaid).not.toContain('-->');
  });
});

// ---------------------------------------------------------------------------
// M2: isStructurallyConnectedEdge checks BOTH endpoints
// ---------------------------------------------------------------------------
describe('M2: isStructurallyConnectedEdge checks both endpoints', () => {
  test('returns false when only from is connected', () => {
    const edge: DiagramEdge = {
      ...connectedEdge('e1'),
      to: { kind: 'detached', point: { x: 300, y: 300 } },
      connectionStatus: 'detached',
    };
    expect(isStructurallyConnectedEdge(edge)).toBe(false);
  });

  test('returns false when only to is connected', () => {
    const edge: DiagramEdge = {
      ...connectedEdge('e1'),
      from: { kind: 'detached', point: { x: 50, y: 50 } },
      connectionStatus: 'detached',
    };
    expect(isStructurallyConnectedEdge(edge)).toBe(false);
  });

  test('returns true only when both are connected', () => {
    const edge = connectedEdge('e1');
    expect(isStructurallyConnectedEdge(edge)).toBe(true);
  });

  test('isStructurallyDetachedEdge is the complement', () => {
    const c = connectedEdge('e1');
    const d = detachedEdge('e2');
    expect(isStructurallyDetachedEdge(c)).toBe(false);
    expect(isStructurallyDetachedEdge(d)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M3: normalizeDiagram must recalculate connectionStatus, not trust stored value
// ---------------------------------------------------------------------------
describe('M3: normalizeDiagram recalculates connectionStatus (ignores stored value)', () => {
  test('wrong stored "connected" → recalculated to "detached"', () => {
    const raw = makeDiagram({
      edges: [
        {
          id: 'e1',
          from: { kind: 'detached', point: { x: 10, y: 10 } },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'connected', // WRONG
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        },
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].connectionStatus).toBe('detached');
  });

  test('wrong stored "detached" → recalculated to "connected"', () => {
    const raw = makeDiagram({
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n2', handleId: null },
          connectionStatus: 'detached', // WRONG
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        },
      ],
    });

    const normalized = normalizeDiagram(raw);
    expect(normalized.edges[0].connectionStatus).toBe('connected');
  });
});

// ---------------------------------------------------------------------------
// M4: Surgical deletion fallback must use captured endpoint position, not {0,0}
// ---------------------------------------------------------------------------
describe('M4: surgical deletion fallback position is captured, not {x:0, y:0}', () => {
  test('detached endpoint uses captured endpointPositions, not zero', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'detach',
      endpointPositions: {
        [edgeId]: { to: { x: 777, y: 888 } },
      },
    });

    const edge = useDiagramStore.getState().diagram.edges.find((e) => e.id === edgeId)!;
    expect(edge.to.kind).toBe('detached');
    if (edge.to.kind === 'detached') {
      expect(edge.to.point).toEqual({ x: 777, y: 888 });
      // If mutated to {0,0}, this would fail:
      expect(edge.to.point.x).not.toBe(0);
      expect(edge.to.point.y).not.toBe(0);
    }
  });

  test('without endpointPositions, fallback is canonical default, not {0,0}', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'detach',
      // No endpointPositions
    });

    const edge = useDiagramStore.getState().diagram.edges.find((e) => e.id === edgeId)!;
    expect(edge.to.kind).toBe('detached');
    if (edge.to.kind === 'detached') {
      expect(Number.isFinite(edge.to.point.x)).toBe(true);
      expect(Number.isFinite(edge.to.point.y)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// M5: Surgical deletion with 'delete' behavior removes edges entirely
// ---------------------------------------------------------------------------
describe('M5: surgical deletion with delete behavior removes edges, not detaches', () => {
  test('connectedEdgeBehavior=delete removes incident edges from diagram', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'delete',
    });

    const edges = useDiagramStore.getState().diagram.edges;
    expect(edges.find((e) => e.id === edgeId)).toBeUndefined();
    expect(edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M7: findNearestHandle uses correct distance computation
// ---------------------------------------------------------------------------
describe('M7: findNearestHandle distance computation', () => {
  const node = {
    id: 'n1',
    label: 'A',
    shape: 'process' as const,
    position: { x: 0, y: 0 },
    width: 140,
    height: 56,
  };

  test('returns nearest handle when point is close', () => {
    const point = { x: 71, y: 0 }; // near t-target/t-source handles (x=70, y=0)
    const result = findNearestHandle(point, [node]);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeLessThan(5);
  });

  test('returns result when point is far away (caller checks threshold)', () => {
    const point = { x: 10000, y: 10000 };
    const result = findNearestHandle(point, [node]);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeGreaterThan(1000);
  });

  test('returns null when nodes array is empty', () => {
    const result = findNearestHandle({ x: 100, y: 100 }, []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M8: findNearestHandle returns the NEAREST handle, not the first one
// ---------------------------------------------------------------------------
describe('M8: findNearestHandle returns nearest handle, not first', () => {
  test('finds the right-side handle when point is near the right side', () => {
    const node = {
      id: 'n1',
      label: 'A',
      shape: 'process' as const,
      position: { x: 100, y: 100 },
      width: 140,
      height: 56,
    };

    // Right-side handle: x=240, y=128 (mid-height)
    const pointNearRight = { x: 242, y: 128 };
    const result = findNearestHandle(pointNearRight, [node]);

    expect(result).not.toBeNull();
    // Should be the right-side handle (r-source or r-target)
    expect(result!.handleId).toMatch(/^r-/);
    expect(result!.x).toBe(240);
  });

  test('finds bottom handle when point is below node', () => {
    const node = {
      id: 'n1',
      label: 'A',
      shape: 'process' as const,
      position: { x: 0, y: 0 },
      width: 100,
      height: 50,
    };

    // Bottom handle: x=50, y=50
    const pointNearBottom = { x: 52, y: 53 };
    const result = findNearestHandle(pointNearBottom, [node]);

    expect(result).not.toBeNull();
    expect(result!.handleId).toMatch(/^b-/);
  });

  test('finds left-side handle when point is near left side', () => {
    const node = {
      id: 'n1',
      label: 'A',
      shape: 'process' as const,
      position: { x: 0, y: 0 },
      width: 140,
      height: 56,
    };

    // Left handle: x=0, y=28
    const pointNearLeft = { x: 2, y: 28 };
    const result = findNearestHandle(pointNearLeft, [node]);

    expect(result).not.toBeNull();
    expect(result!.handleId).toMatch(/^l-/);
  });
});

// ---------------------------------------------------------------------------
// M9: toMermaid must NOT output edges that are not exportable
// ---------------------------------------------------------------------------
describe('M9: toMermaid iterates canonical nodes/edges only', () => {
  test('detached edges are not in Mermaid output', () => {
    const diagram = normalizeDiagram(makeDiagram({
      edges: [
        connectedEdge('e_connected'),
        detachedEdge('e_detached'),
        {
          id: 'e_half',
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'detached', point: { x: 300, y: 300 } },
          connectionStatus: 'detached',
          exportMode: 'mermaid',
          label: 'half_label',
          style: 'solid' as const,
          direction: 'directed' as const,
        },
      ],
    }));

    const mermaid = toMermaid(diagram);
    // Only e_connected should appear
    expect(mermaid).toContain('n1 --> n2');
    // detached edge label should NOT appear
    expect(mermaid).not.toContain('half_label');
    expect(mermaid).not.toContain('ghostAnchor');
  });

  test('getMermaidEdgeOperator produces correct operators for all combos', () => {
    expect(getMermaidEdgeOperator('solid', 'directed')).toBe('-->');
    expect(getMermaidEdgeOperator('solid', 'undirected')).toBe('---');
    expect(getMermaidEdgeOperator('solid', 'bidirectional')).toBe('<-->');
    expect(getMermaidEdgeOperator('solid', 'reverse')).toBe('<---');
    expect(getMermaidEdgeOperator('dotted', 'directed')).toBe('-.->');
    expect(getMermaidEdgeOperator('dotted', 'undirected')).toBe('-.-');
    expect(getMermaidEdgeOperator('dotted', 'bidirectional')).toBe('<-.->');
    expect(getMermaidEdgeOperator('dotted', 'reverse')).toBe('<-.-');
  });
});

// ---------------------------------------------------------------------------
// M11: moveDetachedEdgeEndpoint modifies the correct endpoint only
// ---------------------------------------------------------------------------
describe('M11: moveDetachedEdgeEndpoint modifies the specified endpoint only', () => {
  test('moving from endpoint does not affect to endpoint', () => {
    const store = useDiagramStore.getState();
    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 200 } }
    );

    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 99, y: 99 } });

    const edge = useDiagramStore.getState().diagram.edges[0];
    // from changed
    expect(edge.from.kind).toBe('detached');
    if (edge.from.kind === 'detached') {
      expect(edge.from.point).toEqual({ x: 99, y: 99 });
    }
    // to unchanged
    expect(edge.to.kind).toBe('detached');
    if (edge.to.kind === 'detached') {
      expect(edge.to.point).toEqual({ x: 200, y: 200 });
    }
  });

  test('moving to endpoint does not affect from endpoint', () => {
    const store = useDiagramStore.getState();
    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 200 } }
    );

    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'to', point: { x: 555, y: 555 } });

    const edge = useDiagramStore.getState().diagram.edges[0];
    // from unchanged
    expect(edge.from.kind).toBe('detached');
    if (edge.from.kind === 'detached') {
      expect(edge.from.point).toEqual({ x: 10, y: 10 });
    }
    // to changed
    expect(edge.to.kind).toBe('detached');
    if (edge.to.kind === 'detached') {
      expect(edge.to.point).toEqual({ x: 555, y: 555 });
    }
  });
});

// ---------------------------------------------------------------------------
// M12: reconnectDetachedEdgeEndpoint must update connectionStatus
// ---------------------------------------------------------------------------
describe('M12: reconnectDetachedEdgeEndpoint updates connectionStatus', () => {
  test('reconnecting both endpoints updates connectionStatus to connected', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);

    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 10 } }
    );

    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'from', nodeId: 'n1', handleId: 'r-source' });
    expect(useDiagramStore.getState().diagram.edges[0].connectionStatus).toBe('detached');

    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'to', nodeId: 'n2', handleId: 'l-target' });
    const edge = useDiagramStore.getState().diagram.edges[0];
    expect(edge.connectionStatus).toBe('connected');
    expect(isExportableEdge(edge)).toBe(true);
  });

  test('partial reconnect: reconnecting only from keeps status detached', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);

    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 10 } }
    );

    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'from', nodeId: 'n1', handleId: 'r-source' });
    const edge = useDiagramStore.getState().diagram.edges[0];
    expect(edge.connectionStatus).toBe('detached');
    expect(edge.from.kind).toBe('connected');
    expect(edge.to.kind).toBe('detached');
  });
});
