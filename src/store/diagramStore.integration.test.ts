/**
 * Integration-style test that simulates the exact React Flow event sequences
 * for the two critical scenarios identified in review.
 * 
 * These tests operate directly on the Zustand store, simulating the exact
 * call sequences that Canvas.tsx event handlers produce.
 */
import { beforeEach, describe, test, expect, vi } from 'vitest';
import { useDiagramStore } from './diagramStore';

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

describe('React Flow event sequence integration tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useDiagramStore.getState().resetDiagram();
    useDiagramStore.setState({ past: [], future: [], checkpoint: null });
  });

  describe('Scenario 1: Delete node with incident edges', () => {
    test('deleteNode cascade + separate onEdgesDelete = single undo step restoring node AND edge', () => {
      const store = useDiagramStore.getState();
      
      // Setup: 2 nodes connected by 1 edge
      store.addNode('process', 0, 0);       // n1
      store.addNode('decision', 100, 0);     // n2
      store.addEdge('n1', 'n2');             // e1
      
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
      
      const pastLenBefore = useDiagramStore.getState().past.length;
      
      // Simulate exact Canvas.tsx onNodesDelete handler sequence
      // (React Flow fires this FIRST for the deleted node)
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().deleteNode('n1'); // AC13: cascades edge removal
      useDiagramStore.getState().commitTransaction();
      
      // Verify: node AND edge both removed
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
      
      // Simulate exact Canvas.tsx onEdgesDelete handler sequence
      // (React Flow fires this SECOND for the incident edges, even though they're already gone)
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().deleteEdge('e1'); // Edge already gone — no-op in store
      useDiagramStore.getState().commitTransaction();
      
      // KEY ASSERTION: Only ONE history entry should have been added
      // (the second transaction was empty since edges were already cascade-deleted)
      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore + 1);
      
      // NOW: Ctrl+Z (undo) should restore BOTH node AND edge in a single step
      useDiagramStore.getState().undo();
      
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.nodes.find(n => n.id === 'n1')).toBeTruthy();
      expect(useDiagramStore.getState().diagram.edges.find(e => e.id === 'e1')).toBeTruthy();
    });

    test('deleteNode cascade + onEdgesDelete fires BEFORE onNodesDelete commits (worst case)', () => {
      const store = useDiagramStore.getState();
      
      // Setup
      store.addNode('process', 0, 0);
      store.addNode('decision', 100, 0);
      store.addEdge('n1', 'n2');
      
      
      // Worst case: what if React Flow fires onEdgesDelete FIRST?
      // This would be unusual but let's verify it still works
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().deleteEdge('e1');
      useDiagramStore.getState().commitTransaction();
      
      // Then onNodesDelete fires
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().deleteNode('n1'); // AC13 would try to remove edges, but e1 already gone
      useDiagramStore.getState().commitTransaction();
      
      // Two separate undo steps in this worst-case scenario
      // But each undo step individually restores consistently
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
      
      // First undo: restores node n1 (without edge, since edge was deleted separately)
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      
      // Second undo: restores edge e1
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });
  });

  describe('Scenario 2: Drag position capture', () => {
    test('drag transaction captures original position and final position is in store before commit', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 100, 100);
      
      const originalPos = { ...useDiagramStore.getState().diagram.nodes[0].position };
      expect(originalPos).toEqual({ x: 100, y: 100 });
      
      // Simulate exact React Flow drag sequence:
      // 1. onNodeDragStart fires
      useDiagramStore.getState().startTransaction();
      
      // 2. Multiple onNodesChange position updates during drag (continuous)
      useDiagramStore.getState().updateNodePosition('n1', 150, 150);
      useDiagramStore.getState().updateNodePosition('n1', 200, 200);
      useDiagramStore.getState().updateNodePosition('n1', 300, 300);
      useDiagramStore.getState().updateNodePosition('n1', 500, 500); // final position
      
      // 3. onNodeDragStop fires
      useDiagramStore.getState().commitTransaction();
      
      const finalPos = useDiagramStore.getState().diagram.nodes[0].position;
      expect(finalPos).toEqual({ x: 500, y: 500 });
      
      // Ctrl+Z: should go back to original position
      useDiagramStore.getState().undo();
      const restoredPos = useDiagramStore.getState().diagram.nodes[0].position;
      expect(restoredPos).toEqual({ x: 100, y: 100 });
      
      // Ctrl+Y: should go forward to final position
      useDiagramStore.getState().redo();
      const redonePos = useDiagramStore.getState().diagram.nodes[0].position;
      expect(redonePos).toEqual({ x: 500, y: 500 });
    });

    test('resize transaction captures original size and final size', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 100, 100);
      
      const originalNode = useDiagramStore.getState().diagram.nodes[0];
      const originalWidth = originalNode.width;
      const originalHeight = originalNode.height;
      
      // Simulate resize sequence:
      // 1. onResizeStart fires
      useDiagramStore.getState().startTransaction();
      
      // 2. Multiple onResize updates during resize (continuous)
      useDiagramStore.getState().updateNodeSize('n1', 160, 70);
      useDiagramStore.getState().updateNodeSize('n1', 200, 100);
      useDiagramStore.getState().updateNodeSize('n1', 250, 130); // final size
      
      // 3. onResizeEnd fires
      useDiagramStore.getState().commitTransaction();
      
      const finalNode = useDiagramStore.getState().diagram.nodes[0];
      expect(finalNode.width).toBe(250);
      expect(finalNode.height).toBe(130);
      
      // Ctrl+Z: should go back to original size
      useDiagramStore.getState().undo();
      const restoredNode = useDiagramStore.getState().diagram.nodes[0];
      expect(restoredNode.width).toBe(originalWidth);
      expect(restoredNode.height).toBe(originalHeight);
      
      // Ctrl+Y: should go forward to final size
      useDiagramStore.getState().redo();
      const redoneNode = useDiagramStore.getState().diagram.nodes[0];
      expect(redoneNode.width).toBe(250);
      expect(redoneNode.height).toBe(130);
    });
  });

  describe('Button state verification', () => {
    test('fresh state: no undo, no redo available', () => {
      expect(useDiagramStore.getState().past).toHaveLength(0);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('after addNode: undo available, redo not available', () => {
      useDiagramStore.getState().addNode('process', 0, 0);
      expect(useDiagramStore.getState().past.length).toBeGreaterThan(0);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('after undo: redo available', () => {
      useDiagramStore.getState().addNode('process', 0, 0);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().future.length).toBeGreaterThan(0);
    });

    test('after new action following undo: redo cleared', () => {
      useDiagramStore.getState().addNode('process', 0, 0);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().future.length).toBeGreaterThan(0);

      useDiagramStore.getState().addNode('decision', 50, 50);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('after .s2m import (resetHistory: true): undo and redo disabled', () => {
      useDiagramStore.getState().addNode('process', 0, 0);
      useDiagramStore.getState().addNode('decision', 100, 0);

      const imported = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'TD' as const,
        nodes: [{ id: 'n1', label: 'Imported', shape: 'process' as const, position: { x: 0, y: 0 } }],
        edges: [],
        textBoxes: [],
      };
      useDiagramStore.getState().loadDiagram(imported, { resetHistory: true });

      expect(useDiagramStore.getState().past).toHaveLength(0);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('after Mermaid import (resetHistory: false): undo available', () => {
      useDiagramStore.getState().addNode('process', 0, 0);

      const imported = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'LR' as const,
        nodes: [{ id: 'n1', label: 'From Mermaid', shape: 'rounded' as const, position: { x: 0, y: 0 } }],
        edges: [],
        textBoxes: [],
      };
      useDiagramStore.getState().loadDiagram(imported, { resetHistory: false });

      expect(useDiagramStore.getState().past.length).toBeGreaterThan(0);
    });
  });
});
