import { beforeEach, describe, test, expect, vi } from 'vitest';
import { useDiagramStore, getNextNodeId, getNextEdgeId, getNextTextBoxId, loadInitialDiagram, normalizeDiagram, areDiagramsEqual } from './diagramStore';
import type { DiagramNode, DiagramEdge, TextBox } from '../core/types';

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
    // Reset history state for test isolation
    useDiagramStore.setState({ past: [], future: [], checkpoint: null });
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
      position: { x: 10, y: 20 },
      width: 140,
      height: 56,
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

  test.each(['collate', 'comLink'] as const)('%s nodes reject labels while remaining resizable', (shape) => {
    const store = useDiagramStore.getState();
    store.addNode(shape, 0, 0);

    let node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.label).toBe('');
    expect(node.width).toBe(120);
    expect(node.height).toBe(90);

    store.updateNodeLabel(node.id, 'Forbidden label');
    store.updateNodeSize(node.id, 150, 110);

    node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.label).toBe('');
    expect(node.width).toBe(150);
    expect(node.height).toBe(110);
  });

  test.each(['collate', 'comLink'] as const)('changing a labeled node to %s clears its label', (shape) => {
    const store = useDiagramStore.getState();
    store.addNode('process', 0, 0);
    store.updateNodeLabel('n1', 'Existing label');

    store.updateNodeShape('n1', shape);

    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.shape).toBe(shape);
    expect(node.label).toBe('');
  });

  test('normalizeDiagram removes historical labels from collate and communication-link nodes', () => {
    const normalized = normalizeDiagram({
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'Old collate label', shape: 'collate', position: { x: 0, y: 0 } },
        { id: 'n2', label: 'Old communication label', shape: 'comLink', position: { x: 200, y: 0 } },
        { id: 'n3', label: 'Preserved process label', shape: 'process', position: { x: 400, y: 0 } },
      ],
      edges: [],
      textBoxes: [],
    });

    expect(normalized.nodes.map((node) => node.label)).toEqual(['', '', 'Preserved process label']);
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

    expect(loaded.nodes).toHaveLength(0);
    
    // Check warning was logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unrecognized schemaVersion "999"')
    );

    warnSpy.mockRestore();
  });

  // ====== TEXT BOX TESTS ======

  test('addTextBox creates a text box with defaults', () => {
    const store = useDiagramStore.getState();
    const id = store.addTextBox(100, 200);
    expect(id).toBe('tb1');

    const state = useDiagramStore.getState().diagram;
    expect(state.textBoxes).toHaveLength(1);
    expect(state.textBoxes[0]).toEqual({
      id: 'tb1',
      text: 'Text',
      position: { x: 100, y: 200 },
      width: 150,
      height: 80,
      style: {
        fontSize: 14,
        bold: false,
        italic: false,
        textAlign: 'left',
        color: '#374151',
      },
    });
  });

  test('addTextBox sequential IDs', () => {
    const store = useDiagramStore.getState();
    const id1 = store.addTextBox(0, 0);
    const id2 = store.addTextBox(50, 50);
    expect(id1).toBe('tb1');
    expect(id2).toBe('tb2');
  });

  test('updateTextBoxText updates text content', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    store.updateTextBoxText('tb1', 'Updated annotation');

    const state = useDiagramStore.getState().diagram;
    expect(state.textBoxes[0].text).toBe('Updated annotation');
  });

  test('updateTextBoxStyle merges partial style updates', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    store.updateTextBoxStyle('tb1', { bold: true, fontSize: 20 });

    const state = useDiagramStore.getState().diagram;
    expect(state.textBoxes[0].style.bold).toBe(true);
    expect(state.textBoxes[0].style.fontSize).toBe(20);
    // Unchanged properties should remain at defaults
    expect(state.textBoxes[0].style.italic).toBe(false);
    expect(state.textBoxes[0].style.textAlign).toBe('left');
    expect(state.textBoxes[0].style.color).toBe('#374151');
  });

  test('updateTextBoxPosition updates position', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    store.updateTextBoxPosition('tb1', 300, 400);

    const state = useDiagramStore.getState().diagram;
    expect(state.textBoxes[0].position).toEqual({ x: 300, y: 400 });
  });

  test('deleteTextBox removes the text box', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    store.addTextBox(50, 50);
    expect(useDiagramStore.getState().diagram.textBoxes).toHaveLength(2);

    store.deleteTextBox('tb1');
    const state = useDiagramStore.getState().diagram;
    expect(state.textBoxes).toHaveLength(1);
    expect(state.textBoxes[0].id).toBe('tb2');
  });

  test('addTextBox initializes with default dimensions', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(10, 20);
    const tb = useDiagramStore.getState().diagram.textBoxes[0];
    expect(tb.width).toBe(150);
    expect(tb.height).toBe(80);
  });

  test('updateTextBoxSize updates width and height and clamps to minimums', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    const tbId = useDiagramStore.getState().diagram.textBoxes[0].id;
    
    // Valid resizing
    store.updateTextBoxSize(tbId, 200, 100);
    let tb = useDiagramStore.getState().diagram.textBoxes[0];
    expect(tb.width).toBe(200);
    expect(tb.height).toBe(100);

    // Below minimum limits
    store.updateTextBoxSize(tbId, 30, 20);
    tb = useDiagramStore.getState().diagram.textBoxes[0];
    expect(tb.width).toBe(80); // MIN_TEXT_BOX_WIDTH
    expect(tb.height).toBe(40); // MIN_TEXT_BOX_HEIGHT
  });

  test('updateTextBoxStyle normalizes empty color values to undefined', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    const tbId = useDiagramStore.getState().diagram.textBoxes[0].id;

    // Normalizing empty strings
    store.updateTextBoxStyle(tbId, { backgroundColor: '  ', borderColor: '' });
    let tb = useDiagramStore.getState().diagram.textBoxes[0];
    expect(tb.style.backgroundColor).toBeUndefined();
    expect(tb.style.borderColor).toBeUndefined();

    // Solid color values
    store.updateTextBoxStyle(tbId, { backgroundColor: '#ffffff', borderColor: '#000000' });
    tb = useDiagramStore.getState().diagram.textBoxes[0];
    expect(tb.style.backgroundColor).toBe('#ffffff');
    expect(tb.style.borderColor).toBe('#000000');
  });

  test('normalizeDiagram clamps dimensions and handles invalid/NaN values', () => {
    const raw = {
      schemaVersion: 1,
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [],
      edges: [],
      textBoxes: [
        {
          id: 'tb1',
          text: 'hello',
          position: { x: 0, y: 0 },
          width: NaN,
          height: -20,
          style: {
            backgroundColor: '  ',
            borderColor: ' #123456 '
          }
        }
      ]
    };

    const normalized = normalizeDiagram(raw);
    const tb = normalized.textBoxes[0];
    // NaN and negative values normalized/clamped:
    expect(tb.width).toBe(150); // DEFAULT_TEXT_BOX_WIDTH
    expect(tb.height).toBe(40);  // MIN_TEXT_BOX_HEIGHT (clamped -20)
    // Empty background stripped, spaces on border trimmed:
    expect(tb.style.backgroundColor).toBeUndefined();
    expect(tb.style.borderColor).toBe('#123456');
  });

  test('getNextTextBoxId computes correct ID', () => {
    const textBoxes: TextBox[] = [
      { id: 'tb1', text: '', position: { x: 0, y: 0 }, style: { fontSize: 14, bold: false, italic: false, textAlign: 'left', color: '#374151' } },
      { id: 'tb5', text: '', position: { x: 0, y: 0 }, style: { fontSize: 14, bold: false, italic: false, textAlign: 'left', color: '#374151' } },
    ];
    expect(getNextTextBoxId(textBoxes)).toBe('tb6');
  });

  test('resetDiagram clears text boxes', () => {
    const store = useDiagramStore.getState();
    store.addTextBox(0, 0);
    expect(useDiagramStore.getState().diagram.textBoxes).toHaveLength(1);

    store.resetDiagram();
    expect(useDiagramStore.getState().diagram.textBoxes).toHaveLength(0);
  });

  test('new node receives default width and height from shape config', () => {
    const store = useDiagramStore.getState();
    store.addNode('decision', 50, 50);
    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.width).toBe(120);
    expect(node.height).toBe(90);
  });

  test('updateNodeSize persists dimensions on the node', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10);
    store.updateNodeSize('n1', 200, 100);
    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.width).toBe(200);
    expect(node.height).toBe(100);
  });

  test('updateNodeSize clamps below minimum dimensions', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10); // minWidth: 90, minHeight: 44
    store.updateNodeSize('n1', 30, 20);
    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.width).toBe(90);
    expect(node.height).toBe(44);
  });

  test('updateNodeShape resets dimensions to new shape defaults', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10);
    store.updateNodeSize('n1', 300, 200);
    store.updateNodeShape('n1', 'decision');
    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.shape).toBe('decision');
    expect(node.width).toBe(120);
    expect(node.height).toBe(90);
  });

  test('updateNodeStyle merges background/border and text style updates safely', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10);
    
    // Initial style update
    store.updateNodeStyle('n1', { backgroundColor: '#ff0000', borderColor: '#00ff00' });
    
    let node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.style?.backgroundColor).toBe('#ff0000');
    expect(node.style?.borderColor).toBe('#00ff00');
    expect(node.style?.text).toBeUndefined();

    // Partial update to text style
    store.updateNodeStyle('n1', { text: { fontSize: 16, bold: true } });
    node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.style?.backgroundColor).toBe('#ff0000');
    expect(node.style?.borderColor).toBe('#00ff00');
    expect(node.style?.text?.fontSize).toBe(16);
    expect(node.style?.text?.bold).toBe(true);

    // Update only background color
    store.updateNodeStyle('n1', { backgroundColor: '#0000ff' });
    node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.style?.backgroundColor).toBe('#0000ff');
    expect(node.style?.borderColor).toBe('#00ff00');
    expect(node.style?.text?.fontSize).toBe(16);
    expect(node.style?.text?.bold).toBe(true);
  });

  test('updateNodeTextStyle merges text style updates safely', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 10, 10);
    
    store.updateNodeStyle('n1', { backgroundColor: '#ff0000', text: { color: '#00ff00', fontSize: 14 } });
    
    // Call updateNodeTextStyle
    store.updateNodeTextStyle('n1', { bold: true, color: '#0000ff' });
    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(node.style?.backgroundColor).toBe('#ff0000'); // remains unchanged
    expect(node.style?.text?.fontSize).toBe(14); // remains unchanged
    expect(node.style?.text?.bold).toBe(true); // updated
    expect(node.style?.text?.color).toBe('#0000ff'); // updated
  });

  test('normalizeDiagram legacy textStyle migration', () => {
    const store = useDiagramStore.getState();
    const legacyDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [
        {
          id: 'n1',
          label: 'Legacy Node',
          shape: 'process' as const,
          position: { x: 0, y: 0 },
          // Legacy canvas-only textStyle
          textStyle: { fontSize: 18, bold: true, color: '#ff0000' }
        }
      ],
      edges: [],
      textBoxes: []
    };

    store.loadDiagram(legacyDiagram, { resetHistory: true });
    const node = useDiagramStore.getState().diagram.nodes[0];
    
    // Check it has been migrated to style.text
    expect(node.style?.text?.fontSize).toBe(18);
    expect(node.style?.text?.bold).toBe(true);
    expect(node.style?.text?.color).toBe('#ff0000');
    
    // And legacy textStyle property is removed
    expect((node as { textStyle?: unknown }).textStyle).toBeUndefined();
  });

  test('addEdge defaults direction to directed', () => {
    const store = useDiagramStore.getState();
    store.resetDiagram();
    
    // Add nodes
    store.addNode('process', 0, 0);
    store.addNode('process', 100, 0);
    
    const edgeId = store.addEdge('n1', 'n2', 'solid');
    const edge = useDiagramStore.getState().diagram.edges.find(e => e.id === edgeId);
    expect(edge?.direction).toBe('directed');
  });

  test('updateEdgeDirection updates edge direction correctly', () => {
    const store = useDiagramStore.getState();
    store.resetDiagram();
    store.addNode('process', 0, 0);
    store.addNode('process', 100, 0);
    const edgeId = store.addEdge('n1', 'n2', 'solid');
    
    store.updateEdgeDirection(edgeId, 'undirected');
    expect(useDiagramStore.getState().diagram.edges[0].direction).toBe('undirected');
    
    store.updateEdgeDirection(edgeId, 'bidirectional');
    expect(useDiagramStore.getState().diagram.edges[0].direction).toBe('bidirectional');

    store.updateEdgeDirection(edgeId, 'reverse');
    expect(useDiagramStore.getState().diagram.edges[0].direction).toBe('reverse');
  });

  test('normalizeDiagram edge direction defensive fallback', () => {
    const store = useDiagramStore.getState();
    const badDiagram = {
      schemaVersion: 1,
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [
        { id: 'n1', label: 'A', shape: 'process' as const, position: { x: 0, y: 0 } },
        { id: 'n2', label: 'B', shape: 'process' as const, position: { x: 100, y: 0 } }
      ],
      edges: [
        // @ts-expect-error - testing bad direction value
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'banana' },
        // @ts-expect-error - testing missing direction field
        { id: 'e2', from: 'n1', to: 'n2', label: '', style: 'dotted' },
        // Testing that reverse is preserved correctly
        { id: 'e3', from: 'n1', to: 'n2', label: '', style: 'solid', direction: 'reverse' }
      ],
      textBoxes: []
    };

    store.loadDiagram(badDiagram, { resetHistory: true });
    const edges = useDiagramStore.getState().diagram.edges;
    expect(edges[0].direction).toBe('directed');
    expect(edges[1].direction).toBe('directed');
    expect(edges[2].direction).toBe('reverse');
  });


  test('normalizeDiagram is idempotent and preserves detached edges', () => {
    const raw = {
      schemaVersion: 1,
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'n1', label: 'A', shape: 'process', position: { x: 0, y: 0 } }
      ],
      edges: [
        // legacy string endpoint to real node:
        { id: 'e1', from: 'n1', to: 'n2', label: 'E1', style: 'solid', direction: 'directed' }, // n2 is missing, becomes detached
        // detached endpoint:
        {
          id: 'e2',
          from: { kind: 'detached', point: { x: 45, y: 90 } },
          to: { kind: 'connected', nodeId: 'n1', handleId: 'right' },
          label: 'E2',
          style: 'dotted',
          direction: 'bidirectional',
          exportMode: 'canvasOnly'
        }
      ],
      textBoxes: [
        {
          id: 'tb1',
          text: 'hello',
          position: { x: 10, y: 20 },
          width: 100,
          height: 50,
          style: { backgroundColor: '#ff0000', borderColor: '#00ff00' }
        }
      ]
    };

    const firstPass = normalizeDiagram(raw as unknown as CanonicalDiagram);
    const secondPass = normalizeDiagram(firstPass);

    // Verify first pass preserved/normalized everything:
    expect(firstPass.edges).toHaveLength(2);
    expect(firstPass.edges[0].from.kind).toBe('connected');
    expect(firstPass.edges[0].to.kind).toBe('detached'); // n2 was not in nodes
    
    const to0 = firstPass.edges[0].to;
    if (to0.kind !== 'detached') throw new Error('Expected detached');
    expect(to0.point).toEqual({ x: 200, y: 200 }); // default fallback for toEndpoint

    expect(firstPass.edges[1].from.kind).toBe('detached');
    const from1 = firstPass.edges[1].from;
    if (from1.kind !== 'detached') throw new Error('Expected detached');
    expect(from1.point).toEqual({ x: 45, y: 90 });
    expect(firstPass.edges[1].exportMode).toBe('canvasOnly');

    // Verify idempotence:
    expect(secondPass).toEqual(firstPass);
  });



  test('loadDiagram preserves undirected and bidirectional directions', () => {
    const store = useDiagramStore.getState();
    const diagram = {
      schemaVersion: 1,
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [
        { id: 'n1', label: 'A', shape: 'process' as const, position: { x: 0, y: 0 } },
        { id: 'n2', label: 'B', shape: 'process' as const, position: { x: 100, y: 0 } },
        { id: 'n3', label: 'C', shape: 'process' as const, position: { x: 200, y: 0 } }
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' as const, direction: 'undirected' as const },
        { id: 'e2', from: 'n2', to: 'n3', label: '', style: 'dotted' as const, direction: 'bidirectional' as const },
        { id: 'e3', from: 'n1', to: 'n3', label: '', style: 'solid' as const, direction: 'directed' as const }
      ],
      textBoxes: []
    };

    store.loadDiagram(diagram, { resetHistory: true });
    const edges = useDiagramStore.getState().diagram.edges;
    expect(edges[0].direction).toBe('undirected');
    expect(edges[1].direction).toBe('bidirectional');
    expect(edges[2].direction).toBe('directed');
  });

  // ====== UNDO/REDO TESTS ======

  describe('Undo/Redo history', () => {
    test('undo restores the previous diagram after addNode', () => {
      const store = useDiagramStore.getState();
      expect(store.diagram.nodes).toHaveLength(0);

      store.addNode('process', 10, 20);
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().past).toHaveLength(1);

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      expect(useDiagramStore.getState().past).toHaveLength(0);
      expect(useDiagramStore.getState().future).toHaveLength(1);
    });

    test('redo restores the undone diagram', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 10, 20);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);

      useDiagramStore.getState().redo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('a new mutation after undo clears the future stack', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 10, 20);
      store.addNode('decision', 50, 50);
      expect(useDiagramStore.getState().past).toHaveLength(2);

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().future).toHaveLength(1);

      // New mutation should clear future
      useDiagramStore.getState().addNode('rounded', 100, 100);
      expect(useDiagramStore.getState().future).toHaveLength(0);
    });

    test('a transaction with multiple mutations creates exactly one undo step', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0); // n1
      store.addNode('process', 100, 0); // n2
      const pastLenBefore = useDiagramStore.getState().past.length;

      // Start transaction, do multiple mutations
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().updateNodeLabel('n1', 'Modified');
      useDiagramStore.getState().updateNodePosition('n1', 50, 50);
      useDiagramStore.getState().commitTransaction();

      // Should have added exactly one entry to past
      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore + 1);

      // Undo should restore both label AND position in one step
      useDiagramStore.getState().undo();
      const node = useDiagramStore.getState().diagram.nodes.find(n => n.id === 'n1');
      expect(node?.label).toBe('Nouveau nœud');
      expect(node?.position).toEqual({ x: 0, y: 0 });
    });

    test('an empty transaction (no changes) creates no history entry', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);
      const pastLenBefore = useDiagramStore.getState().past.length;

      useDiagramStore.getState().startTransaction();
      // No mutations
      useDiagramStore.getState().commitTransaction();

      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore);
    });

    test('nested startTransaction calls do not overwrite the existing checkpoint (idempotency)', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);

      useDiagramStore.getState().startTransaction();
      const checkpointAfterFirst = useDiagramStore.getState().checkpoint;
      
      // Mutate during transaction
      useDiagramStore.getState().updateNodeLabel('n1', 'Step1');
      
      // Second startTransaction should be a no-op (idempotent)
      useDiagramStore.getState().startTransaction();
      expect(useDiagramStore.getState().checkpoint).toBe(checkpointAfterFirst);

      useDiagramStore.getState().commitTransaction();
      // Undo should go back to original label, not 'Step1'
      useDiagramStore.getState().undo();
      const node = useDiagramStore.getState().diagram.nodes.find(n => n.id === 'n1');
      expect(node?.label).toBe('Nouveau nœud');
    });

    test('takeSnapshot is ignored during an active transaction', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);
      const pastLenBefore = useDiagramStore.getState().past.length;

      useDiagramStore.getState().startTransaction();
      // Mutations inside transaction call takeSnapshot() internally but it should be no-op
      useDiagramStore.getState().updateNodeLabel('n1', 'Inside Transaction');
      useDiagramStore.getState().updateNodePosition('n1', 99, 99);
      
      // Past should NOT have grown during the transaction
      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore);

      useDiagramStore.getState().commitTransaction();
      // Only one entry added after commit
      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore + 1);
    });

    test('deleteNode/deleteEdge inside transaction do not create individual snapshots', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0); // n1
      store.addNode('decision', 100, 0); // n2
      store.addEdge('n1', 'n2'); // e1
      const pastLenBefore = useDiagramStore.getState().past.length;

      // Simulate grouped delete (as done in Canvas.tsx onNodesDelete)
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().deleteNode('n1');
      useDiagramStore.getState().deleteEdge('e1'); // edge may already be removed by cascade, but should not error
      useDiagramStore.getState().commitTransaction();

      // Exactly one undo step
      expect(useDiagramStore.getState().past.length).toBe(pastLenBefore + 1);
    });

    test('resetDiagram is undoable', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);
      store.addNode('decision', 100, 0);
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);

      useDiagramStore.getState().resetDiagram();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
    });

    test('loadDiagram with resetHistory: true clears past, future, and checkpoint', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);
      store.addNode('decision', 100, 0);
      expect(useDiagramStore.getState().past.length).toBeGreaterThan(0);

      const newDiagram = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'LR' as const,
        nodes: [{ id: 'n1', label: 'Imported', shape: 'process' as const, position: { x: 0, y: 0 } }],
        edges: [],
        textBoxes: [],
      };

      useDiagramStore.getState().loadDiagram(newDiagram, { resetHistory: true });
      expect(useDiagramStore.getState().past).toHaveLength(0);
      expect(useDiagramStore.getState().future).toHaveLength(0);
      expect(useDiagramStore.getState().checkpoint).toBeNull();
      expect(useDiagramStore.getState().diagram.nodes[0].label).toBe('Imported');
    });

    test('loadDiagram with resetHistory: false is undoable', () => {
      const store = useDiagramStore.getState();
      store.addNode('process', 0, 0);
      const originalNodeCount = useDiagramStore.getState().diagram.nodes.length;

      const newDiagram = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'LR' as const,
        nodes: [
          { id: 'n1', label: 'From Mermaid', shape: 'rounded' as const, position: { x: 0, y: 0 } },
          { id: 'n2', label: 'Also Mermaid', shape: 'decision' as const, position: { x: 100, y: 0 } },
        ],
        edges: [],
        textBoxes: [],
      };

      useDiagramStore.getState().loadDiagram(newDiagram, { resetHistory: false });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      expect(useDiagramStore.getState().checkpoint).toBeNull();

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(originalNodeCount);
    });

    test('history depth is capped at 50 for takeSnapshot', () => {
      const store = useDiagramStore.getState();
      // Generate 55 distinct states
      for (let i = 0; i < 55; i++) {
        store.addNode('process', i * 100, i * 100);
      }
      expect(useDiagramStore.getState().past.length).toBeLessThanOrEqual(50);
    });

    test('commitTransaction also respects the 50-step history depth limit', () => {
      // Fill past to near-capacity
      for (let i = 0; i < 52; i++) {
        useDiagramStore.getState().addNode('process', i * 100, i * 100);
      }
      const pastBefore = useDiagramStore.getState().past.length;
      expect(pastBefore).toBeLessThanOrEqual(50);

      // Transaction commit should also enforce limit
      useDiagramStore.getState().startTransaction();
      useDiagramStore.getState().updateNodeLabel('n1', 'Transaction Test');
      useDiagramStore.getState().commitTransaction();

      expect(useDiagramStore.getState().past.length).toBeLessThanOrEqual(50);
    });

    test('areDiagramsEqual returns true for structurally equal diagrams', () => {
      const a = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'TD' as const,
        nodes: [{ id: 'n1', label: 'A', shape: 'process' as const, position: { x: 0, y: 0 } }],
        edges: [],
        textBoxes: [],
      };
      const b = { ...a, nodes: [...a.nodes] };
      expect(areDiagramsEqual(a, b)).toBe(true);
    });

    test('areDiagramsEqual returns false for different diagrams', () => {
      const a = {
        schemaVersion: 1,
        diagramType: 'flowchart' as const,
        direction: 'TD' as const,
        nodes: [{ id: 'n1', label: 'A', shape: 'process' as const, position: { x: 0, y: 0 } }],
        edges: [],
        textBoxes: [],
      };
      const b = {
        ...a,
        nodes: [{ id: 'n1', label: 'B', shape: 'process' as const, position: { x: 0, y: 0 } }],
      };
      expect(areDiagramsEqual(a, b)).toBe(false);
    });
  });

  describe('Flexible / Ghost Arrows System', () => {
    test('activeTool toggles between select and arrow', () => {
      expect(useDiagramStore.getState().activeTool).toBe('select');
      useDiagramStore.getState().setActiveTool('arrow');
      expect(useDiagramStore.getState().activeTool).toBe('arrow');
      useDiagramStore.getState().setActiveTool('select');
      expect(useDiagramStore.getState().activeTool).toBe('select');
    });

    test('normalizeDiagram recalculates connectionStatus correctly', () => {
      const raw = {
        diagramType: 'flowchart' as const,
        direction: 'TD' as const,
        nodes: [
          { id: 'n1', label: 'A', shape: 'process' as const, position: { x: 0, y: 0 } },
          { id: 'n2', label: 'B', shape: 'process' as const, position: { x: 100, y: 100 } }
        ],
        edges: [
          {
            id: 'e1',
            from: { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
            to: { kind: 'connected', nodeId: 'n2', handleId: 'l-target' },
            connectionStatus: 'detached' as const, // Incorrect in raw data
            exportMode: 'mermaid' as const,
            label: '',
            style: 'solid' as const,
            direction: 'directed' as const
          },
          {
            id: 'e2',
            from: { kind: 'detached', point: { x: 50, y: 50 } },
            to: { kind: 'connected', nodeId: 'n2', handleId: 'l-target' },
            connectionStatus: 'connected' as const, // Incorrect in raw data
            exportMode: 'mermaid' as const,
            label: '',
            style: 'solid' as const,
            direction: 'directed' as const
          }
        ],
        textBoxes: []
      };

      const normalized = normalizeDiagram(raw);
      expect(normalized.edges[0].connectionStatus).toBe('connected');
      expect(normalized.edges[1].connectionStatus).toBe('detached');
    });

    test('addEdge allows adding edges with detached/ghost endpoints', () => {
      const store = useDiagramStore.getState();
      store.resetDiagram();
      store.addNode('process', 0, 0); // created with ID 'n1'

      const e1Id = store.addEdge(
        { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
        { kind: 'detached', point: { x: 300, y: 300 } }
      );
      const e2Id = store.addEdge(
        { kind: 'detached', point: { x: 10, y: 10 } },
        { kind: 'detached', point: { x: 50, y: 50 } }
      );

      const edges = useDiagramStore.getState().diagram.edges;
      const e1 = edges.find(e => e.id === e1Id)!;
      const e2 = edges.find(e => e.id === e2Id)!;

      expect(e1.connectionStatus).toBe('detached');
      expect(e1.to.kind).toBe('detached');
      if (e1.to.kind === 'detached') {
        expect(e1.to.point).toEqual({ x: 300, y: 300 });
      } else {
        throw new Error('expected detached target endpoint');
      }

      expect(e2.connectionStatus).toBe('detached');
      expect(e2.from.kind).toBe('detached');
      expect(e2.to.kind).toBe('detached');
    });

    test('surgical deletion of node detaches edge endpoints and can be undo/redo round-tripped', () => {
      const store = useDiagramStore.getState();
      store.resetDiagram();
      store.addNode('process', 0, 0);   // 'n1'
      store.addNode('process', 100, 100); // 'n2'
      const edgeId = store.addEdge(
        { kind: 'connected', nodeId: 'n1', handleId: 'r-source' },
        { kind: 'connected', nodeId: 'n2', handleId: 'l-target' }
      );

      // Perform surgical deletion of n2, detaching the edge endpoint
      store.deleteSelectedElements({
        nodeIds: ['n2'],
        edgeIds: [],
        textBoxIds: [],
        connectedEdgeBehavior: 'detach',
        endpointPositions: {
          [edgeId]: { to: { x: 150, y: 150 } }
        }
      });

      let state = useDiagramStore.getState().diagram;
      expect(state.nodes.find(n => n.id === 'n2')).toBeUndefined();
      
      let edge = state.edges.find(e => e.id === edgeId)!;
      expect(edge.to.kind).toBe('detached');
      if (edge.to.kind === 'detached') {
        expect(edge.to.point).toEqual({ x: 150, y: 150 });
      } else {
        throw new Error('expected detached target endpoint');
      }
      expect(edge.connectionStatus).toBe('detached');

      // Undo deletion
      store.undo();
      state = useDiagramStore.getState().diagram;
      expect(state.nodes.find(n => n.id === 'n2')).toBeDefined();
      edge = state.edges.find(e => e.id === edgeId)!;
      expect(edge.to.kind).toBe('connected');
      if (edge.to.kind === 'connected') {
        expect(edge.to.nodeId).toBe('n2');
      } else {
        throw new Error('expected connected target endpoint');
      }
      expect(edge.connectionStatus).toBe('connected');

      // Redo deletion
      store.redo();
      state = useDiagramStore.getState().diagram;
      expect(state.nodes.find(n => n.id === 'n2')).toBeUndefined();
      edge = state.edges.find(e => e.id === edgeId)!;
      expect(edge.to.kind).toBe('detached');
      if (edge.to.kind === 'detached') {
        expect(edge.to.point).toEqual({ x: 150, y: 150 });
      } else {
        throw new Error('expected detached target endpoint');
      }
      expect(edge.connectionStatus).toBe('detached');
    });
  });
});
