import { beforeEach, describe, test, expect, vi } from 'vitest';
import { useDiagramStore } from './diagramStore';
import {
  buildCopiedSelectionSnapshot,
  createDuplicatesFromSnapshot,
  DUPLICATE_OFFSET
} from './duplicateHelpers';
import { toMermaid } from '../core/mermaid';

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

describe('Duplicate Helpers & Actions Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useDiagramStore.getState().resetDiagram();
    useDiagramStore.setState({ past: [], future: [], checkpoint: null, copiedSelection: null });
  });

  test('buildCopiedSelectionSnapshot and createDuplicatesFromSnapshot - Single Node', () => {
    const store = useDiagramStore.getState();
    const nodeId = store.addNode('process', 10, 20);
    
    const diagram = useDiagramStore.getState().diagram;
    const snapshot = buildCopiedSelectionSnapshot(diagram, {
      nodeIds: [nodeId],
      edgeIds: [],
      textBoxIds: []
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].id).toBe(nodeId);
    expect(snapshot.nodes[0].position).toEqual({ x: 10, y: 20 });

    const result = createDuplicatesFromSnapshot(snapshot, diagram);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).not.toBe(nodeId); // fresh ID
    expect(result.nodes[0].position).toEqual({
      x: 10 + DUPLICATE_OFFSET.x,
      y: 20 + DUPLICATE_OFFSET.y
    });
  });

  test('buildCopiedSelectionSnapshot and createDuplicatesFromSnapshot - Mixed selection with internal edge', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode('process', 10, 20);
    const n2 = store.addNode('decision', 100, 200);
    const edgeId = store.addEdge(n1, n2);

    const diagram = useDiagramStore.getState().diagram;
    
    // Auto-detects internal edge even if not explicitly selected
    const snapshot = buildCopiedSelectionSnapshot(diagram, {
      nodeIds: [n1, n2],
      edgeIds: [],
      textBoxIds: []
    });

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.edges[0].id).toBe(edgeId);

    const result = createDuplicatesFromSnapshot(snapshot, diagram);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    
    const clonedN1 = result.nodes.find((n) => n.id !== n1 && n.id !== n2);
    const clonedN2 = result.nodes.find((n) => n.id !== n1 && n.id !== n2 && n.id !== clonedN1?.id);
    
    expect(clonedN1).toBeDefined();
    expect(clonedN2).toBeDefined();
    
    const clonedEdge = result.edges[0];
    expect(clonedEdge.id).not.toBe(edgeId);
    
    // Rewired endpoints check
    expect(clonedEdge.from.kind).toBe('connected');
    expect(clonedEdge.to.kind).toBe('connected');
    if (clonedEdge.from.kind === 'connected' && clonedEdge.to.kind === 'connected') {
      expect([clonedN1?.id, clonedN2?.id]).toContain(clonedEdge.from.nodeId);
      expect([clonedN1?.id, clonedN2?.id]).toContain(clonedEdge.to.nodeId);
    }
  });

  test('Edge selected with only one endpoint selected -> edge not duplicated', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode('process', 10, 20);
    const n2 = store.addNode('decision', 100, 200);
    const edgeId = store.addEdge(n1, n2);

    const diagram = useDiagramStore.getState().diagram;
    
    const snapshot = buildCopiedSelectionSnapshot(diagram, {
      nodeIds: [n1],
      edgeIds: [edgeId],
      textBoxIds: []
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.edges).toHaveLength(0); // Case B: only one endpoint selected, should be skipped
  });

  test('duplicateSelection - Groups silently ignored', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode('process', 10, 20);
    
    // Add group (if groups exist)
    if (store.addGroup) {
      store.addGroup('subgraph', 50, 50, 200, 200);
    }
    
    const diagram = useDiagramStore.getState().diagram;
    const groupIds = (diagram.groups || []).map((g) => g.id);
    
    const snapshot = buildCopiedSelectionSnapshot(diagram, {
      nodeIds: [...groupIds, n1],
      edgeIds: [],
      textBoxIds: []
    });

    // Groups are in nodes list in ReactFlow sometimes but in diagram.groups in canonical diagram.
    // In canonical diagram, groups is a separate array.
    // Our buildCopiedSelectionSnapshot should filter out any elements that are not in diagram.nodes.
    // Since diagram.groups is separate, group IDs will not be found in diagram.nodes.
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].id).toBe(n1);
  });

  describe('Edge-only duplication', () => {
    test('creates a detached ghost edge and preserves properties', () => {
      const store = useDiagramStore.getState();
      const n1 = store.addNode('process', 10, 20);
      const n2 = store.addNode('decision', 100, 200);
      const edgeId = store.addEdge(n1, n2);
      
      // Update edge style/label/direction
      store.updateEdgeLabel(edgeId, 'Test Connection');
      store.updateEdgeTextStyle(edgeId, { bold: true, italic: true, color: '#ff0000' });
      store.updateEdgeDirection(edgeId, 'bidirectional');
      
      const diagramBefore = useDiagramStore.getState().diagram;
      
      const snapshot = buildCopiedSelectionSnapshot(diagramBefore, {
        nodeIds: [],
        edgeIds: [edgeId],
        textBoxIds: []
      });

      expect(snapshot.nodes).toHaveLength(0);
      expect(snapshot.edges).toHaveLength(1);

      const result = createDuplicatesFromSnapshot(snapshot, diagramBefore);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(1);

      const cloned = result.edges[0];
      expect(cloned.id).not.toBe(edgeId);
      
      // Verifies:
      // - preserves label/style/direction/textStyle
      expect(cloned.label).toBe('Test Connection');
      expect(cloned.style).toBe('solid');
      expect(cloned.direction).toBe('bidirectional');
      expect(cloned.textStyle).toEqual({ bold: true, italic: true, color: '#ff0000' });

      // - sets connectionStatus = "detached"
      expect(cloned.connectionStatus).toBe('detached');
      
      // - sets exportMode = "canvasOnly"
      expect(cloned.exportMode).toBe('canvasOnly');

      // - endpoints are detached and offset
      expect(cloned.from.kind).toBe('detached');
      expect(cloned.to.kind).toBe('detached');
      
      // n1 is process (width 140, height 56), bottom anchor: x=10+70=80, y=20+56=76
      // n2 is decision (width 120, height 90), bottom anchor: x=100+60=160, y=200+90=290
      if (cloned.from.kind === 'detached' && cloned.to.kind === 'detached') {
        expect(cloned.from.point.x).toBe(80 + DUPLICATE_OFFSET.x);
        expect(cloned.from.point.y).toBe(76 + DUPLICATE_OFFSET.y);
        expect(cloned.to.point.x).toBe(160 + DUPLICATE_OFFSET.x);
        expect(cloned.to.point.y).toBe(290 + DUPLICATE_OFFSET.y);
      }
    });

    test('does not appear in Mermaid export', () => {
      const store = useDiagramStore.getState();
      const n1 = store.addNode('process', 10, 20);
      const n2 = store.addNode('decision', 100, 200);
      const edgeId = store.addEdge(n1, n2);

      // Duplicate the edge
      const diagram = useDiagramStore.getState().diagram;
      const snapshot = buildCopiedSelectionSnapshot(diagram, {
        nodeIds: [],
        edgeIds: [edgeId],
        textBoxIds: []
      });
      const result = createDuplicatesFromSnapshot(snapshot, diagram);
      
      // Add the duplicated edge to store
      useDiagramStore.setState({
        diagram: {
          ...diagram,
          edges: [...diagram.edges, ...result.edges]
        }
      });

      const updatedDiagram = useDiagramStore.getState().diagram;
      expect(updatedDiagram.edges).toHaveLength(2);
      
      const mermaidCode = toMermaid(updatedDiagram);
      // The original edge (connected) should be in Mermaid: e.g. "n1 --> n2"
      // The cloned edge (exportMode: canvasOnly) should NOT be in Mermaid
      expect(mermaidCode).toContain('n1');
      expect(mermaidCode).toContain('n2');
      expect(mermaidCode).not.toContain(result.edges[0].id);
      
      // Let's count connection arrows in Mermaid
      const lines = mermaidCode.split('\n');
      const arrowLines = lines.filter(line => line.includes('-->') || line.includes('<-->') || line.includes('---'));
      expect(arrowLines).toHaveLength(1); // Only the original one is exported
    });

    test('survives .s2m serialization/deserialization', () => {
      const store = useDiagramStore.getState();
      const n1 = store.addNode('process', 10, 20);
      const n2 = store.addNode('decision', 100, 200);
      const edgeId = store.addEdge(n1, n2);

      const diagram = useDiagramStore.getState().diagram;
      const snapshot = buildCopiedSelectionSnapshot(diagram, {
        nodeIds: [],
        edgeIds: [edgeId],
        textBoxIds: []
      });
      const result = createDuplicatesFromSnapshot(snapshot, diagram);
      
      const fullDiagram = {
        ...diagram,
        edges: [...diagram.edges, ...result.edges]
      };

      // Serialize
      const serialized = JSON.stringify(fullDiagram);
      
      // Deserialize
      const parsed = JSON.parse(serialized) as import('../core/types').CanonicalDiagram;
      
      // Load back into store/helper
      expect(parsed.edges).toHaveLength(2);
      const clonedEdge = parsed.edges.find((e: import('../core/types').DiagramEdge) => e.id === result.edges[0].id);
      expect(clonedEdge).toBeDefined();
      expect(clonedEdge.connectionStatus).toBe('detached');
      expect(clonedEdge.exportMode).toBe('canvasOnly');
      expect(clonedEdge.from.kind).toBe('detached');
      expect(clonedEdge.from.point.x).toBe(80 + DUPLICATE_OFFSET.x);
    });

    test('supports undo/redo', () => {
      const store = useDiagramStore.getState();
      const n1 = store.addNode('process', 10, 20);
      const n2 = store.addNode('decision', 100, 200);
      const edgeId = store.addEdge(n1, n2);

      // Perform store-based duplicateSelection
      const dupResult = store.duplicateSelection({
        nodeIds: [],
        edgeIds: [edgeId],
        textBoxIds: []
      });

      expect(dupResult).toBeDefined();
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(2);
      const clonedEdgeId = dupResult!.edgeIds[0];

      // Undo
      store.undo();
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.edges[0].id).toBe(edgeId);

      // Redo
      store.redo();
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(2);
      expect(useDiagramStore.getState().diagram.edges.map((e) => e.id)).toContain(clonedEdgeId);
    });

    test('supports successive pasteSelection calls with cumulative offsets', () => {
      const store = useDiagramStore.getState();
      
      // Clear diagram first
      useDiagramStore.setState({
        diagram: {
          nodes: [],
          edges: [],
          textBoxes: [],
          groups: [],
          direction: 'TB'
        }
      });
      
      const n1 = store.addNode('process', 10, 20);
      
      // Copy n1
      store.copySelection({
        nodeIds: [n1],
        edgeIds: [],
        textBoxIds: []
      });
      
      // First Paste
      const paste1 = store.pasteSelection();
      expect(paste1).toBeDefined();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      const node2 = useDiagramStore.getState().diagram.nodes.find((n) => n.id === paste1!.nodeIds[0])!;
      expect(node2.position).toEqual({ x: 10 + DUPLICATE_OFFSET.x, y: 20 + DUPLICATE_OFFSET.y });
      
      // Second Paste
      const paste2 = store.pasteSelection();
      expect(paste2).toBeDefined();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(3);
      const node3 = useDiagramStore.getState().diagram.nodes.find((n) => n.id === paste2!.nodeIds[0])!;
      expect(node3.position).toEqual({ x: 10 + 2 * DUPLICATE_OFFSET.x, y: 20 + 2 * DUPLICATE_OFFSET.y });
    });
  });
});
