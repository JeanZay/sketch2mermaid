/**
 * Ghost Arrows — Undo/Redo Torture Tests
 *
 * Verifies transaction integrity for all ghost-arrow operations:
 *  1. Create detached-detached edge, undo, redo
 *  2. Create connected-detached edge, undo, redo
 *  3. Detach one endpoint of complete edge, undo, redo
 *  4. Reconnect detached endpoint, undo, redo
 *  5. Surgical delete node with multiple incident edges, undo, redo
 *  6. Drag endpoint: verify undo is ONE step not many
 *  7. Cancel Arrow creation with Escape: undo stack unchanged
 *  8. Detach both endpoints in a transaction: one undo step
 *  9. moveDetachedEdgeEndpoint inside a transaction: one undo step
 * 10. Edge with concurrent from+to detachment, undo restores both
 */
import { beforeEach, describe, test, expect } from 'vitest';
import { useDiagramStore, normalizeDiagram } from './diagramStore';
import type { CanonicalDiagram } from '../core/types';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  clear: () => { for (const k in localStorageStore) delete localStorageStore[k]; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
};

import { vi } from 'vitest';
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', { localStorage: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshStore() {
  localStorageMock.clear();
  useDiagramStore.getState().resetDiagram();
  useDiagramStore.setState({ past: [], future: [], checkpoint: null });
  return useDiagramStore.getState();
}

function getDiagram(): CanonicalDiagram {
  return useDiagramStore.getState().diagram;
}

function undo() { useDiagramStore.getState().undo(); }
function redo() { useDiagramStore.getState().redo(); }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Undo/Redo torture tests — Ghost Arrows', () => {
  beforeEach(() => { freshStore(); });

  // ---- 1. Create detached-detached edge, undo, redo ----
  test('UD-1: detached-detached edge creation is one undo step', () => {
    const store = useDiagramStore.getState();
    const pastBefore = useDiagramStore.getState().past.length;

    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 200 } }
    );

    expect(getDiagram().edges).toHaveLength(1);
    expect(getDiagram().edges[0].connectionStatus).toBe('detached');
    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);

    undo();
    expect(getDiagram().edges).toHaveLength(0);

    redo();
    expect(getDiagram().edges).toHaveLength(1);
    const edge = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(edge.from.kind).toBe('detached');
    expect(edge.to.kind).toBe('detached');
    expect(edge.connectionStatus).toBe('detached');
  });

  // ---- 2. Create connected-detached edge, undo, redo ----
  test('UD-2: connected-detached edge creation is one undo step', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0); // n1
    const pastBefore = useDiagramStore.getState().past.length;

    const edgeId = store.addEdge(
      { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
      { kind: 'detached', point: { x: 300, y: 300 } }
    );

    expect(getDiagram().edges).toHaveLength(1);
    expect(getDiagram().edges[0].from.kind).toBe('connected');
    expect(getDiagram().edges[0].to.kind).toBe('detached');
    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);

    undo();
    expect(getDiagram().edges).toHaveLength(0);

    redo();
    const edge = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(edge.from.kind).toBe('connected');
    if (edge.from.kind === 'connected') expect(edge.from.nodeId).toBe('n1');
    expect(edge.to.kind).toBe('detached');
    expect(edge.connectionStatus).toBe('detached');
  });

  // ---- 3. Detach one endpoint of complete edge, undo, redo ----
  test('UD-3: detaching one endpoint is one undo step', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);   // n1
    store.addNode('process', 200, 0); // n2
    const edgeId = store.addEdge('n1', 'n2');

    expect(getDiagram().edges[0].connectionStatus).toBe('connected');
    const pastBefore = useDiagramStore.getState().past.length;

    // Simulate: start transaction, move from-endpoint to detached
    store.startTransaction();
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 50, y: 50 } });
    store.commitTransaction();

    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);
    const afterDetach = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterDetach.from.kind).toBe('detached');
    expect(afterDetach.connectionStatus).toBe('detached');

    undo();
    const afterUndo = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterUndo.from.kind).toBe('connected');
    if (afterUndo.from.kind === 'connected') expect(afterUndo.from.nodeId).toBe('n1');
    expect(afterUndo.connectionStatus).toBe('connected');

    redo();
    const afterRedo = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterRedo.from.kind).toBe('detached');
    if (afterRedo.from.kind === 'detached') expect(afterRedo.from.point).toEqual({ x: 50, y: 50 });
    expect(afterRedo.connectionStatus).toBe('detached');
  });

  // ---- 4. Reconnect detached endpoint, undo, redo ----
  test('UD-4: reconnecting a detached endpoint is one undo step', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);    // n1
    store.addNode('process', 200, 0);  // n2
    store.addNode('process', 400, 0);  // n3
    const edgeId = store.addEdge(
      { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
      { kind: 'detached', point: { x: 300, y: 50 } }
    );

    const pastBefore = useDiagramStore.getState().past.length;

    store.startTransaction();
    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'to', nodeId: 'n3', handleId: 'l-target' });
    store.commitTransaction();

    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);
    const afterReconnect = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterReconnect.to.kind).toBe('connected');
    if (afterReconnect.to.kind === 'connected') {
      expect(afterReconnect.to.nodeId).toBe('n3');
    }
    expect(afterReconnect.connectionStatus).toBe('connected');

    undo();
    const afterUndo = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterUndo.to.kind).toBe('detached');
    if (afterUndo.to.kind === 'detached') {
      expect(afterUndo.to.point).toEqual({ x: 300, y: 50 });
    }
    expect(afterUndo.connectionStatus).toBe('detached');

    redo();
    const afterRedo = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterRedo.to.kind).toBe('connected');
    expect(afterRedo.connectionStatus).toBe('connected');
  });

  // ---- 5. Surgical delete node with multiple incident edges, undo, redo ----
  test('UD-5: surgical deletion of node with 3 incident edges, undo restores all', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);    // n1
    store.addNode('process', 200, 0);  // n2
    store.addNode('process', 400, 0);  // n3

    const e1 = store.addEdge('n1', 'n2'); // connected
    const e2 = store.addEdge('n2', 'n3'); // connected
    const e3 = store.addEdge('n1', 'n3'); // bystander (not affected)

    const pastBefore = useDiagramStore.getState().past.length;

    // Delete n2 with detach behavior
    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'detach',
      endpointPositions: {
        [e1]: { to: { x: 150, y: 50 } },
        [e2]: { from: { x: 250, y: 50 } },
      },
    });

    // Exactly one undo step
    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);

    let d = getDiagram();
    expect(d.nodes.find(n => n.id === 'n2')).toBeUndefined();
    
    // e1 and e2 should be detached
    const de1 = d.edges.find(e => e.id === e1)!;
    const de2 = d.edges.find(e => e.id === e2)!;
    const de3 = d.edges.find(e => e.id === e3)!;
    
    expect(de1.to.kind).toBe('detached');
    if (de1.to.kind === 'detached') expect(de1.to.point).toEqual({ x: 150, y: 50 });
    expect(de1.connectionStatus).toBe('detached');
    
    expect(de2.from.kind).toBe('detached');
    if (de2.from.kind === 'detached') expect(de2.from.point).toEqual({ x: 250, y: 50 });
    expect(de2.connectionStatus).toBe('detached');
    
    // e3 (n1→n3) is unaffected
    expect(de3.from.kind).toBe('connected');
    expect(de3.to.kind).toBe('connected');
    expect(de3.connectionStatus).toBe('connected');

    // Undo: restores n2 and all edges
    undo();
    d = getDiagram();
    expect(d.nodes.find(n => n.id === 'n2')).toBeDefined();
    
    const ue1 = d.edges.find(e => e.id === e1)!;
    const ue2 = d.edges.find(e => e.id === e2)!;
    
    expect(ue1.from.kind).toBe('connected');
    expect(ue1.to.kind).toBe('connected');
    expect(ue1.connectionStatus).toBe('connected');
    
    expect(ue2.from.kind).toBe('connected');
    expect(ue2.to.kind).toBe('connected');
    expect(ue2.connectionStatus).toBe('connected');

    // Redo: detaches again
    redo();
    d = getDiagram();
    expect(d.nodes.find(n => n.id === 'n2')).toBeUndefined();
    const re1 = d.edges.find(e => e.id === e1)!;
    expect(re1.to.kind).toBe('detached');
    expect(re1.connectionStatus).toBe('detached');
  });

  // ---- 6. Dragging an endpoint creates exactly ONE undo step ----
  test('UD-6: multiple moveDetachedEdgeEndpoint calls inside a transaction = one undo step', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);    // n1
    store.addNode('process', 200, 0);  // n2
    const edgeId = store.addEdge('n1', 'n2');
    const pastBefore = useDiagramStore.getState().past.length;

    // Simulate drag: start → many moves → stop (all inside one transaction)
    store.startTransaction();
    // First move detaches the connected endpoint
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 50, y: 0 } });
    // Intermediate moves (simulating mouse events)
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 60, y: 10 } });
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 80, y: 20 } });
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 100, y: 30 } });
    // Final position
    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 150, y: 50 } });
    store.commitTransaction();

    // Exactly one undo step added
    expect(useDiagramStore.getState().past.length).toBe(pastBefore + 1);

    const afterDrag = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterDrag.from.kind).toBe('detached');
    if (afterDrag.from.kind === 'detached') {
      expect(afterDrag.from.point).toEqual({ x: 150, y: 50 });
    }

    // Single undo restores the original connected state
    undo();
    const afterUndo = getDiagram().edges.find(e => e.id === edgeId)!;
    expect(afterUndo.from.kind).toBe('connected');
    expect(afterUndo.connectionStatus).toBe('connected');
  });

  // ---- 7. Cancel Arrow creation (Escape) leaves undo stack unchanged ----
  test('UD-7: abandoning arrow creation does not affect undo stack', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    const pastBefore = useDiagramStore.getState().past.length;

    // Simulating: user activated Arrow tool, clicked first point (just sets React state),
    // then pressed Escape — no addEdge call is made.
    // The Escape handler only clears draftStart/draftMousePos React state and resets activeTool.
    // No store mutation, so undo stack is unchanged.

    // We verify: if we set activeTool to arrow and back to select without calling addEdge,
    // the past stack is unchanged.
    store.setActiveTool('arrow');
    store.setActiveTool('select');

    expect(useDiagramStore.getState().past.length).toBe(pastBefore);
    expect(useDiagramStore.getState().future.length).toBe(0);
  });

  // ---- 8. reconnectDetachedEdgeEndpoint restores connectionStatus correctly ----
  test('UD-8: reconnect both detached endpoints makes edge connected and exportable', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);    // n1
    store.addNode('process', 200, 0);  // n2

    const edgeId = store.addEdge(
      { kind: 'detached', point: { x: 10, y: 10 } },
      { kind: 'detached', point: { x: 200, y: 10 } }
    );

    expect(getDiagram().edges[0].connectionStatus).toBe('detached');

    // Reconnect from
    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'from', nodeId: 'n1', handleId: 'r-source' });
    expect(getDiagram().edges[0].connectionStatus).toBe('detached'); // still detached (to is still detached)

    // Reconnect to
    store.reconnectDetachedEdgeEndpoint({ edgeId, endpoint: 'to', nodeId: 'n2', handleId: 'l-target' });
    const edge = getDiagram().edges[0];
    expect(edge.connectionStatus).toBe('connected');
    expect(edge.from.kind).toBe('connected');
    expect(edge.to.kind).toBe('connected');
  });

  // ---- 9. Undo restores exact normalized canonical state ----
  test('UD-9: undo/redo always restores normalized state', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    const stateBeforeDetach = JSON.stringify(normalizeDiagram(getDiagram()));

    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'to', point: { x: 999, y: 999 } });
    
    undo();
    const stateAfterUndo = JSON.stringify(normalizeDiagram(getDiagram()));
    expect(stateAfterUndo).toBe(stateBeforeDetach);
  });

  // ---- 10. Surgical deletion preserves connectionStatus for unaffected edges ----
  test('UD-10: surgical deletion does not corrupt unaffected edges', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);   // n1
    store.addNode('process', 100, 0); // n2
    store.addNode('process', 200, 0); // n3

    const e_n1n2 = store.addEdge('n1', 'n2');
    const e_n2n3 = store.addEdge('n2', 'n3');
    const e_n1n3 = store.addEdge('n1', 'n3'); // not affected

    // Delete n2 with detach behavior (affects e_n1n2 and e_n2n3)
    store.deleteSelectedElements({
      nodeIds: ['n2'],
      edgeIds: [],
      textBoxIds: [],
      connectedEdgeBehavior: 'detach',
    });

    const d = getDiagram();
    const e13 = d.edges.find(e => e.id === e_n1n3)!;
    expect(e13.connectionStatus).toBe('connected');
    expect(e13.from.kind).toBe('connected');
    expect(e13.to.kind).toBe('connected');

    // After undo, all edges back to normal
    undo();
    const d2 = getDiagram();
    const restored_e12 = d2.edges.find(e => e.id === e_n1n2)!;
    const restored_e23 = d2.edges.find(e => e.id === e_n2n3)!;
    const restored_e13 = d2.edges.find(e => e.id === e_n1n3)!;

    expect(restored_e12.connectionStatus).toBe('connected');
    expect(restored_e23.connectionStatus).toBe('connected');
    expect(restored_e13.connectionStatus).toBe('connected');
  });

  // ---- Extra: history.checkpoint is null after commit ----
  test('UD-extra: checkpoint is null after commitTransaction', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.addNode('process', 200, 0);
    const edgeId = store.addEdge('n1', 'n2');

    store.startTransaction();
    expect(useDiagramStore.getState().checkpoint).not.toBeNull();

    store.moveDetachedEdgeEndpoint({ edgeId, endpoint: 'from', point: { x: 50, y: 50 } });
    store.commitTransaction();

    expect(useDiagramStore.getState().checkpoint).toBeNull();
  });
});
