/**
 * Ghost Arrows — View-Model Leak Tests
 *
 * Asserts that temporary UI artifacts (ghostAnchor__, draft-, temp-) never
 * leak into the canonical Zustand diagram state after any operation.
 *
 * Operations tested:
 *  - completed arrow creation (connected→connected, connected→detached, detached→detached)
 *  - endpoint detach (moveDetachedEdgeEndpoint)
 *  - endpoint snap/reconnect (reconnectDetachedEdgeEndpoint)
 *  - surgical deletion with detach behavior
 *  - undo
 *  - redo
 *  - save/reload (.s2m round-trip)
 */
import { beforeEach, describe, test, expect } from 'vitest';
import { vi } from 'vitest';
import { useDiagramStore, normalizeDiagram } from './diagramStore';
import { serializeSketch2MermaidFile, parseSketch2MermaidFile } from '../core/s2mFile';
import { toMermaid } from '../core/mermaid';
import type { CanonicalDiagram } from '../core/types';

// ---------------------------------------------------------------------------
// localStorage mock
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
// Assertion helpers
// ---------------------------------------------------------------------------

const BANNED_NODE_PREFIXES = ['ghostAnchor__', 'draft-', 'temp-'];
const BANNED_MERMAID_STRINGS = ['ghostAnchor', 'draft-start-temp-node', 'draft-end-temp-node'];

function assertCanonicalPurity(diagram: CanonicalDiagram, context: string) {
  // 1. diagram.nodes contains no banned prefixes
  for (const node of diagram.nodes) {
    for (const prefix of BANNED_NODE_PREFIXES) {
      if (node.id.startsWith(prefix)) {
        throw new Error(`[${context}] diagram.nodes contains banned ID "${node.id}"`);
      }
    }
  }

  // 2. diagram.edges source/target contains no banned prefixes
  for (const edge of diagram.edges) {
    if (edge.from.kind === 'connected') {
      for (const prefix of BANNED_NODE_PREFIXES) {
        if (edge.from.nodeId.startsWith(prefix)) {
          throw new Error(`[${context}] edge "${edge.id}" from.nodeId has banned ID "${edge.from.nodeId}"`);
        }
      }
    }
    if (edge.to.kind === 'connected') {
      for (const prefix of BANNED_NODE_PREFIXES) {
        if (edge.to.nodeId.startsWith(prefix)) {
          throw new Error(`[${context}] edge "${edge.id}" to.nodeId has banned ID "${edge.to.nodeId}"`);
        }
      }
    }
  }
}

function assertMermaidPurity(mermaid: string, context: string) {
  for (const banned of BANNED_MERMAID_STRINGS) {
    if (mermaid.includes(banned)) {
      throw new Error(`[${context}] Mermaid output contains banned string "${banned}"`);
    }
  }
}

function assertS2mPurity(json: string, context: string) {
  for (const banned of BANNED_MERMAID_STRINGS) {
    if (json.includes(banned)) {
      throw new Error(`[${context}] .s2m output contains banned string "${banned}"`);
    }
  }
}

function runAllPurityChecks(context: string) {
  const diagram = useDiagramStore.getState().diagram;
  assertCanonicalPurity(diagram, context);
  assertCanonicalPurity(normalizeDiagram(diagram), context + ' [normalized]');

  const mermaid = toMermaid(normalizeDiagram(diagram));
  assertMermaidPurity(mermaid, context);

  const json = serializeSketch2MermaidFile(normalizeDiagram(diagram));
  assertS2mPurity(json, context);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  for (const k in localStorageStore) delete localStorageStore[k];
  useDiagramStore.getState().resetDiagram();
  useDiagramStore.setState({ past: [], future: [], checkpoint: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('View-model leak prevention', () => {
  test('VML-1: initial empty diagram is pure', () => {
    runAllPurityChecks('initial');
  });

  test('VML-2: after addNode, diagram is pure', () => {
    useDiagramStore.getState().addNode('process', 100, 100);
    runAllPurityChecks('after addNode');
  });

  test('VML-3: after creating connected→connected edge, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    store.addEdge('n1', 'n2');
    runAllPurityChecks('connected→connected edge');
  });

  test('VML-4: after creating connected→detached edge, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addEdge(
      { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
      { kind: 'detached', point: { x: 300, y: 100 } }
    );
    runAllPurityChecks('connected→detached edge');
  });

  test('VML-5: after creating detached→detached edge, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addEdge(
      { kind: 'detached', point: { x: 50, y: 50 } },
      { kind: 'detached', point: { x: 300, y: 300 } }
    );
    runAllPurityChecks('detached→detached edge');
  });

  test('VML-6: after moveDetachedEdgeEndpoint, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 50, y: 50 } });
    runAllPurityChecks('after moveDetachedEdgeEndpoint');
  });

  test('VML-7: after reconnectDetachedEdgeEndpoint, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'connected', nodeId: 'n2', handleId: null }
    );

    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'from', nodeId: 'n1', handleId: 'r-source' });
    runAllPurityChecks('after reconnectDetachedEdgeEndpoint');
  });

  test('VML-8: after surgical deletion with detach, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'detach',
      endpointPositions: { [edgeId]: { to: { x: 250, y: 50 } } },
    });
    runAllPurityChecks('after surgical deletion (detach)');
  });

  test('VML-9: after undo, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    store.addEdge('n1', 'n2');

    store.undo();
    runAllPurityChecks('after undo');
  });

  test('VML-10: after redo, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    store.addEdge('n1', 'n2');
    store.undo();
    store.redo();
    runAllPurityChecks('after redo');
  });

  test('VML-11: after .s2m save/reload, diagram is pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'to', point: { x: 999, y: 999 } });

    const json = serializeSketch2MermaidFile(normalizeDiagram(useDiagramStore.getState().diagram));
    assertS2mPurity(json, 'saved .s2m');

    const parseResult = parseSketch2MermaidFile(json);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // Load the parsed diagram into the store
    store.loadDiagram(parseResult.diagram, { resetHistory: true });
    runAllPurityChecks('after .s2m reload');
  });

  test('VML-12: normalizeDiagram always produces a pure result', () => {
    // Scenario A: edge whose own ID uses a reserved prefix is dropped entirely
    const raw: CanonicalDiagram = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Real', shape: 'process', position: { x: 0, y: 0 } },
      ],
      edges: [
        {
          id: 'ghostAnchor__e1__from', // reserved edge ID → dropped by flatMap guard
          from: { kind: 'connected', nodeId: 'n1', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        },
      ],
      textBoxes: [],
    };

    const normalized = normalizeDiagram(raw);
    // Edge with reserved ID is dropped entirely (BUG-1 fix)
    expect(normalized.edges).toHaveLength(0);
    assertCanonicalPurity(normalized, 'normalizeDiagram: reserved edge ID dropped');

    const mermaid = toMermaid(normalized);
    assertMermaidPurity(mermaid, 'toMermaid: reserved edge ID dropped');
  });

  test('VML-12b: connected endpoint referencing ghost node ID is gracefully downgraded', () => {
    // Scenario B: edge has a normal ID, but its connected.nodeId is a ghost ID
    // (not in the nodeSet) → downgraded to detached by the nodeSet check
    const raw: CanonicalDiagram = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Real', shape: 'process', position: { x: 0, y: 0 } },
      ],
      edges: [
        {
          id: 'e1',
          from: { kind: 'connected', nodeId: 'ghostAnchor__e1__from', handleId: null },
          to: { kind: 'connected', nodeId: 'n1', handleId: null },
          connectionStatus: 'connected',
          exportMode: 'mermaid',
          label: '',
          style: 'solid',
          direction: 'directed',
        },
      ],
      textBoxes: [],
    };

    const normalized = normalizeDiagram(raw);
    // ghostAnchor__e1__from is not in nodes → from becomes detached
    expect(normalized.edges[0].from.kind).toBe('detached');
    expect(normalized.edges[0].connectionStatus).toBe('detached');

    assertCanonicalPurity(normalized, 'normalizeDiagram: ghost nodeId downgraded to detached');
    const mermaid = toMermaid(normalized);
    assertMermaidPurity(mermaid, 'toMermaid: ghost nodeId downgraded result');
  });


  test('VML-13: Mermaid export of large diagram with many detached edges stays pure', () => {
    const store = useDiagramStore.getState();
    // Add 20 real nodes
    for (let i = 0; i < 20; i++) {
      store.addNode('process', i * 100, 0);
    }
    // Add 10 connected edges
    for (let i = 0; i < 10; i++) {
      store.addEdge(`n${i + 1}`, `n${i + 2}`);
    }
    // Add 15 detached edges
    for (let i = 0; i < 15; i++) {
      store.addEdge(
        { kind: 'detached', point: { x: i * 30, y: i * 30 } },
        { kind: 'detached', point: { x: i * 30 + 100, y: i * 30 + 100 } }
      );
    }

    runAllPurityChecks('large mixed diagram');
  });

  test('VML-14: past/future history states are also pure', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 50, y: 50 } });

    const { past, future } = useDiagramStore.getState();
    for (const historicDiagram of past) {
      assertCanonicalPurity(historicDiagram, 'past history entry');
    }
    for (const historicDiagram of future) {
      assertCanonicalPurity(historicDiagram, 'future history entry');
    }
  });
});
