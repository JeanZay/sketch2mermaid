import { beforeEach, describe, test, expect, vi } from 'vitest';
import { useDiagramStore, getNextNodeId, getNextEdgeId, loadInitialDiagram } from './diagramStore';
import type { DiagramNode, DiagramEdge } from '../core/types';

// Mock localStorage for Node test environment
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value.toString();
  },
  clear: () => {
    for (const key in localStorageStore) {
      delete localStorageStore[key];
    }
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
};
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', { localStorage: localStorageMock });

describe('Zustand diagram store tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useDiagramStore.getState().resetDiagram();
  });

  test('addNode and sequential stable ID generation', () => {
    const store = useDiagramStore.getState();
    
    const id1 = store.addNode('process', 10, 20);
    expect(id1).toBe('n1');

    const id2 = store.addNode('decision', 30, 40);
    expect(id2).toBe('n2');

    const state = useDiagramStore.getState().diagram;
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0]).toEqual({
      id: 'n1',
      label: 'Nouveau nœud',
      shape: 'process',
      position: { x: 10, y: 20 }
    });
  });

  test('addNode shifts overlapping nodes diagonally', () => {
    const store = useDiagramStore.getState();
    
    // Add multiple nodes at the exact same position
    const id1 = store.addNode('process', 100, 100);
    const id2 = store.addNode('decision', 100, 100);
    const id3 = store.addNode('rounded', 100, 100);

    expect(id1).toBe('n1');
    expect(id2).toBe('n2');
    expect(id3).toBe('n3');

    const state = useDiagramStore.getState().diagram;
    expect(state.nodes).toHaveLength(3);
    
    expect(state.nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(state.nodes[1].position).toEqual({ x: 130, y: 130 });
    expect(state.nodes[2].position).toEqual({ x: 160, y: 160 });
  });

  test('AC8 — Renaming a node does not modify its internal ID', () => {
    const store = useDiagramStore.getState();
    const id = store.addNode('rounded', 0, 0);
    expect(id).toBe('n1');

    store.updateNodeLabel('n1', 'Nouveau Label Modifié');
    
    const state = useDiagramStore.getState().diagram;
    expect(state.nodes[0].id).toBe('n1');
    expect(state.nodes[0].label).toBe('Nouveau Label Modifié');
  });

  test('change shape and position of a node', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10);
    
    store.updateNodeShape('n1', 'stadium');
    store.updateNodePosition('n1', 100, 150);

    const state = useDiagramStore.getState().diagram;
    expect(state.nodes[0].shape).toBe('stadium');
    expect(state.nodes[0].position).toEqual({ x: 100, y: 150 });
  });

  test('AC13 — Suppressing a node deletes its incident edges', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0); // n1
    store.addNode('decision', 0, 0); // n2
    store.addNode('rounded', 0, 0); // n3

    store.addEdge('n1', 'n2'); // e1
    store.addEdge('n2', 'n3'); // e2

    let state = useDiagramStore.getState().diagram;
    expect(state.nodes).toHaveLength(3);
    expect(state.edges).toHaveLength(2);

    // Delete node n2
    store.deleteNode('n2');

    state = useDiagramStore.getState().diagram;
    expect(state.nodes).toHaveLength(2);
    // Both edges e1 (n1->n2) and e2 (n2->n3) are connected to n2 and must be deleted
    expect(state.edges).toHaveLength(0);
  });

  test('addEdge and toggleEdgeStyle', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0); // n1
    store.addNode('decision', 0, 0); // n2

    const edgeId = store.addEdge('n1', 'n2', 'solid');
    expect(edgeId).toBe('e1');

    let state = useDiagramStore.getState().diagram;
    expect(state.edges[0].style).toBe('solid');

    store.toggleEdgeStyle('e1');
    state = useDiagramStore.getState().diagram;
    expect(state.edges[0].style).toBe('dotted');
  });

  test('addEdge with sourceHandle and targetHandle and prevents duplicate handles edges', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0); // n1
    store.addNode('decision', 0, 0); // n2

    const edgeId1 = store.addEdge('n1', 'n2', 'solid', 'r-source', 'l-target');
    expect(edgeId1).toBe('e1');

    // Adding the exact same connection (same handles) returns the existing edge ID
    const edgeId2 = store.addEdge('n1', 'n2', 'solid', 'r-source', 'l-target');
    expect(edgeId2).toBe('e1');

    // Adding a connection from different handles creates a new edge
    const edgeId3 = store.addEdge('n1', 'n2', 'solid', 't-source', 'b-target');
    expect(edgeId3).toBe('e2');

    const state = useDiagramStore.getState().diagram;
    expect(state.edges).toHaveLength(2);
    expect(state.edges[0].sourceHandle).toBe('r-source');
    expect(state.edges[0].targetHandle).toBe('l-target');
    expect(state.edges[1].sourceHandle).toBe('t-source');
    expect(state.edges[1].targetHandle).toBe('b-target');
  });

  test('getNextNodeId and getNextEdgeId logic', () => {
    const nodes: DiagramNode[] = [
      { id: 'n1', label: '', shape: 'process', position: { x: 0, y: 0 } },
      { id: 'n5', label: '', shape: 'process', position: { x: 0, y: 0 } },
      { id: 'n2', label: '', shape: 'process', position: { x: 0, y: 0 } }
    ];
    expect(getNextNodeId(nodes)).toBe('n6');

    const edges: DiagramEdge[] = [
      { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
      { id: 'e12', from: 'n2', to: 'n3', label: '', style: 'solid' }
    ];
    expect(getNextEdgeId(edges)).toBe('e13');
  });

  test('AC14 — Schema version warning & load fallback', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Save incompatible schemaVersion to localStorage
    const STORAGE_KEY = 'sketch2mermaid_diagram_v1';
    const incompatibleDiagram = {
      schemaVersion: 999, // Unknown schemaVersion
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'n1', label: 'Test', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: []
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(incompatibleDiagram));

    // Call loadInitialDiagram directly to test localStorage loading logic
    const loaded = loadInitialDiagram();

    // Verify fallback to default empty diagram
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.nodes).toHaveLength(0);
    
    // Check warning was logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unrecognized schemaVersion "999"')
    );

    warnSpy.mockRestore();
  });
});
