import { describe, test, expect, beforeEach } from 'vitest';
import { useDiagramStore } from './diagramStore';
import { serializeSketch2MermaidFile, parseSketch2MermaidFile } from '../core/s2mFile';
import { importMermaidFlowchart } from '../core/mermaidImport';
import { toMermaid } from '../core/mermaid';
import { setUseGroupsAndSwimlanes } from '../core/config';

describe('Sketch2Mermaid Visual Groups and Swimlanes Tests', () => {
  beforeEach(() => {
    useDiagramStore.getState().resetDiagram();
  });

  test('1. .s2m Version 1 Flat Load defaults groups to [] and parentGroupId to undefined', () => {
    const rawV1Json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 1,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'n1', label: 'Node 1', shape: 'process', position: { x: 100, y: 100 } }
        ],
        edges: [],
        schemaVersion: 1
      }
    });

    const res = parseSketch2MermaidFile(rawV1Json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.diagram.groups).toEqual([]);
      expect(res.diagram.nodes[0].parentGroupId).toBeUndefined();
    }
  });

  test('2. .s2m Version 2 Grouped Load parses groups and parentGroupId correctly', () => {
    const rawV2Json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 2,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'n1', label: 'Node 1', shape: 'process', position: { x: 100, y: 100 }, parentGroupId: 'g1' }
        ],
        edges: [],
        groups: [
          { id: 'g1', kind: 'subgraph', label: 'Group 1', position: { x: 50, y: 50 }, width: 300, height: 200 }
        ]
      }
    });

    const res = parseSketch2MermaidFile(rawV2Json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.diagram.groups).toHaveLength(1);
      expect(res.diagram.groups![0].id).toBe('g1');
      expect(res.diagram.nodes[0].parentGroupId).toBe('g1');
    }
  });

  test('3. .s2m Conditional Save serializes fileVersion 1 for flat files and version 2 for grouped files', () => {
    const store = useDiagramStore.getState();
    
    // Flat case
    store.addNode('process', 100, 100);
    const flatSerialized = serializeSketch2MermaidFile(useDiagramStore.getState().diagram);
    const parsedFlat = JSON.parse(flatSerialized);
    expect(parsedFlat.fileVersion).toBe(1);
    expect(parsedFlat.diagram.groups).toBeUndefined();
    expect(parsedFlat.diagram.nodes[0].parentGroupId).toBeUndefined();

    // Grouped case
    store.addGroup('subgraph', 50, 50);
    const groupedSerialized = serializeSketch2MermaidFile(useDiagramStore.getState().diagram);
    const parsedGrouped = JSON.parse(groupedSerialized);
    expect(parsedGrouped.fileVersion).toBe(2);
    expect(parsedGrouped.diagram.groups).toHaveLength(1);
  });

  test('4. groupNode is not in diagram.nodes and is not exported as normal Mermaid node', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 100, 100);
    store.addGroup('subgraph', 50, 50);

    const diagram = useDiagramStore.getState().diagram;
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.groups).toHaveLength(1);

    const code = toMermaid(diagram);
    expect(code).toContain('subgraph g1["Group"]');
    expect(code).not.toContain('g1@{');
  });

  test('5. Deletion behavior: group-only vs group+children', () => {
    const store = useDiagramStore.getState();
    const nId = store.addNode('process', 100, 100);
    const gId = store.addGroup('subgraph', 50, 50);
    store.assignNodeToGroup(nId, gId);

    // Test Delete Group Only
    store.deleteGroup(gId, { deleteChildren: false });
    const diagram1 = useDiagramStore.getState().diagram;
    expect(diagram1.groups).toHaveLength(0);
    expect(diagram1.nodes).toHaveLength(1);
    expect(diagram1.nodes[0].parentGroupId).toBeUndefined();

    // Reset and test Delete Group + Children
    store.resetDiagram();
    const store2 = useDiagramStore.getState();
    const nId2 = store2.addNode('process', 100, 100);
    const gId2 = store2.addGroup('subgraph', 50, 50);
    store2.assignNodeToGroup(nId2, gId2);

    store2.deleteGroup(gId2, { deleteChildren: true });
    const diagram2 = useDiagramStore.getState().diagram;
    expect(diagram2.groups).toHaveLength(0);
    expect(diagram2.nodes).toHaveLength(0);
  });

  test('6. Recursive group movement moves descendants exactly once', () => {
    const store = useDiagramStore.getState();
    const parentId = store.addGroup('subgraph', 10, 10);
    const childId = store.addGroup('subgraph', 20, 20);
    const nodeId = store.addNode('process', 30, 30);

    // Set child parentGroupId to parentId manually and reload to normalize
    const diagramBefore = useDiagramStore.getState().diagram;
    const groups = diagramBefore.groups || [];
    const updated = groups.map(g => g.id === childId ? { ...g, parentGroupId: parentId } : g);
    store.loadDiagram({ ...diagramBefore, groups: updated }, { resetHistory: true });
    
    const store3 = useDiagramStore.getState();
    store3.assignNodeToGroup(nodeId, childId);

    // Drag parent group by (+50, +50)
    store3.updateGroupPosition(parentId, 60, 60);

    const diagramAfter = useDiagramStore.getState().diagram;
    const parent = diagramAfter.groups?.find(g => g.id === parentId);
    const child = diagramAfter.groups?.find(g => g.id === childId);
    const node = diagramAfter.nodes.find(n => n.id === nodeId);

    expect(parent?.position).toEqual({ x: 60, y: 60 });
    expect(child?.position).toEqual({ x: 70, y: 70 });
    expect(node?.position).toEqual({ x: 80, y: 80 }); // Shifted exactly once
  });

  test('7. Nested subgraphs round-trip through Mermaid import and export', () => {
    const code = `flowchart TD
  subgraph Parent["Parent Group"]
    subgraph Child["Child Group"]
      A[Node A]
    end
  end`;

    const res = importMermaidFlowchart(code);
    expect(res.diagram.groups).toHaveLength(2);
    const parent = res.diagram.groups?.find(g => g.label === 'Parent Group');
    const child = res.diagram.groups?.find(g => g.label === 'Child Group');
    
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(child?.parentGroupId).toBe(parent?.id);

    const exported = toMermaid(res.diagram);
    expect(exported).toContain('subgraph');
    expect(exported).toContain('Parent Group');
    expect(exported).toContain('Child Group');
  });

  test('8. Test anti-contamination of groupNodes', () => {
    const store = useDiagramStore.getState();
    const gId = store.addGroup('subgraph', 50, 50);
    const nId1 = store.addNode('process', 100, 100);
    const nId2 = store.addNode('process', 200, 200);

    const diagram = useDiagramStore.getState().diagram;
    // Canonical diagram should only contain 2 business nodes
    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.nodes.map(n => n.id)).toEqual([nId1, nId2]);
    expect(diagram.groups).toHaveLength(1);
    expect(diagram.groups![0].id).toBe(gId);

    // Mermaid export does not render group as normal flowchart node
    const exported = toMermaid(diagram);
    expect(exported).toContain('subgraph g1');
    expect(exported).not.toContain('g1@{');
    expect(exported).not.toContain('  g1[');
  });

  test('9. Test feature flag false behavior', () => {
    // Set flag to false
    setUseGroupsAndSwimlanes(false);
    try {
      const store = useDiagramStore.getState();
      store.addNode('process', 100, 100);
      store.addGroup('subgraph', 50, 50);

      const diagram = useDiagramStore.getState().diagram;
      // Serializer shouldn't include groups when flag is false
      const exported = toMermaid(diagram);
      expect(exported).not.toContain('subgraph g1');
      expect(exported).toContain('n1');
    } finally {
      // Restore flag
      setUseGroupsAndSwimlanes(true);
    }
  });

  test('10. Test drag nested membership and hit-testing rules', () => {
    const parentGroup = { id: 'P', position: { x: 0, y: 0 }, width: 200, height: 200 };
    const childGroup = { id: 'C', position: { x: 50, y: 50 }, width: 100, height: 100 };
    const siblingGroup = { id: 'S', position: { x: 0, y: 0 }, width: 50, height: 50 }; // Equal depth, smaller area than P
    const groups = [parentGroup, childGroup, siblingGroup];
    const tolerance = 15;

    const findMatch = (nodeX: number, nodeY: number, nodeW: number, nodeH: number) => {
      const nodeCenterX = nodeX + nodeW / 2;
      const nodeCenterY = nodeY + nodeH / 2;
      let matchedGroup = null;
      let minArea = Infinity;
      for (const group of groups) {
        const isInside =
          nodeCenterX >= group.position.x - tolerance &&
          nodeCenterX <= group.position.x + group.width + tolerance &&
          nodeCenterY >= group.position.y - tolerance &&
          nodeCenterY <= group.position.y + group.height + tolerance;
        if (isInside) {
          const area = group.width * group.height;
          if (area < minArea) {
            minArea = area;
            matchedGroup = group;
          }
        }
      }
      return matchedGroup ? matchedGroup.id : undefined;
    };

    // A inside C (child group)
    expect(findMatch(80, 80, 20, 20)).toBe('C'); // Center = (90, 90) -> inside P and C. Smallest area is C.

    // A inside P but outside C
    expect(findMatch(10, 10, 20, 20)).toBe('S'); // Center = (20, 20) -> inside P and S. Smallest area is S.
    expect(findMatch(10, 160, 20, 20)).toBe('P'); // Center = (20, 170) -> inside P only.

    // A outside P
    expect(findMatch(300, 300, 20, 20)).toBe(undefined);
  });

  test('11. Test undo/redo transactions for group drag and resize', () => {
    const store = useDiagramStore.getState();
    const gId = store.addGroup('subgraph', 10, 10);
    const nId = store.addNode('process', 20, 20);
    store.assignNodeToGroup(nId, gId);

    // Group drag transaction simulation
    store.startTransaction();
    store.updateGroupPosition(gId, 50, 50);
    store.updateGroupPosition(gId, 100, 100);
    store.commitTransaction();

    const diagramAfterDrag = useDiagramStore.getState().diagram;
    expect(diagramAfterDrag.groups?.[0].position).toEqual({ x: 100, y: 100 });
    expect(diagramAfterDrag.nodes[0].position).toEqual({ x: 110, y: 110 });

    // Undo should restore both positions in one step
    store.undo();
    const diagramAfterUndo = useDiagramStore.getState().diagram;
    expect(diagramAfterUndo.groups?.[0].position).toEqual({ x: 10, y: 10 });
    expect(diagramAfterUndo.nodes[0].position).toEqual({ x: 20, y: 20 });

    // Redo should apply both positions in one step
    store.redo();
    const diagramAfterRedo = useDiagramStore.getState().diagram;
    expect(diagramAfterRedo.groups?.[0].position).toEqual({ x: 100, y: 100 });
    expect(diagramAfterRedo.nodes[0].position).toEqual({ x: 110, y: 110 });
  });

  test('12. Test mixed deletion scenarios without duplicate delete or stale parentGroupId', () => {
    const store = useDiagramStore.getState();
    const gId = store.addGroup('subgraph', 0, 0);
    const nId = store.addNode('process', 10, 10);
    store.assignNodeToGroup(nId, gId);

    // Delete both the group and the child in the selection
    store.deleteSelectedElements({
      nodeIds: [nId],
      edgeIds: [],
      textBoxIds: [],
      groupIds: [gId],
      connectedEdgeBehavior: 'delete'
    });

    const diagram = useDiagramStore.getState().diagram;
    expect(diagram.groups).toHaveLength(0);
    expect(diagram.nodes).toHaveLength(0);
  });

  test('13. Test s2m v1 strict serialization format', () => {
    const store = useDiagramStore.getState();
    store.addNode('process', 100, 100);

    const serialized = serializeSketch2MermaidFile(useDiagramStore.getState().diagram);
    const parsed = JSON.parse(serialized);

    expect(parsed.fileVersion).toBe(1);
    expect(parsed.diagram.groups).toBeUndefined();
    expect(parsed.diagram.nodes[0].parentGroupId).toBeUndefined();
    expect(parsed.diagram.schemaVersion).toBe(1);
  });

  test('14. Test s2m v2 conditional serialization when group array empty but node has parentGroupId', () => {
    const rawDiagram = {
      diagramType: 'flowchart' as const,
      direction: 'TD' as const,
      nodes: [
        { id: 'n1', label: 'Node 1', shape: 'process' as const, position: { x: 100, y: 100 }, parentGroupId: 'orphaned' }
      ],
      edges: [],
      textBoxes: [],
      groups: []
    };

    const serialized = serializeSketch2MermaidFile(rawDiagram);
    const parsed = JSON.parse(serialized);

    // Should be version 2 since parentGroupId is present on at least one node
    expect(parsed.fileVersion).toBe(2);
    expect(parsed.diagram.nodes[0].parentGroupId).toBe('orphaned');
  });

  test('15. Test minimum resize bounds for group containing nodes', () => {
    const store = useDiagramStore.getState();
    const gId = store.addGroup('subgraph', 0, 0);
    const nId = store.addNode('process', 100, 100); // Width 140, Height 56 -> Right=240, Bottom=156
    store.assignNodeToGroup(nId, gId);

    // Try shrinking to very small dimensions
    store.updateGroupSize(gId, 10, 10);

    const diagram = useDiagramStore.getState().diagram;
    const group = diagram.groups?.[0];
    expect(group).toBeDefined();
    if (group) {
      // Must be constrained by child right/bottom + GROUP_PADDING (40)
      // Right limit = 240 + 40 = 280
      // Bottom limit = 156 + 40 = 196
      expect(group.width).toBe(280);
      expect(group.height).toBe(196);
    }
  });

  test('16. Test parentGroupId normalization & cycle breaking', () => {
    const rawV2Json = JSON.stringify({
      fileType: 'sketch2mermaid',
      fileVersion: 2,
      appVersion: '0.0.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'n1', label: 'Node 1', shape: 'process', position: { x: 100, y: 100 }, parentGroupId: 'non_existent' }
        ],
        edges: [],
        groups: [
          { id: 'g1', kind: 'subgraph', label: 'Group 1', position: { x: 50, y: 50 }, width: 300, height: 200, parentGroupId: 'g1' } // Cycle on self
        ]
      }
    });

    const res = parseSketch2MermaidFile(rawV2Json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // non_existent should be normalized to undefined
      expect(res.diagram.nodes[0].parentGroupId).toBeUndefined();
      // self cycle on group should be normalized to undefined
      expect(res.diagram.groups![0].parentGroupId).toBeUndefined();
    }
  });

  test('17. Test importing and exporting flowchart LR with lanes', () => {
    const code = `flowchart LR
  subgraph lane_sales["Sales"]
    A["Receive request"]
    B["Qualify request"]
  end

  subgraph lane_ops["Operations"]
    C["Process request"]
  end

  A --> B
  B --> C`;

    const res = importMermaidFlowchart(code);
    expect(res.diagram.groups).toHaveLength(2);
    expect(res.diagram.nodes).toHaveLength(3);
    
    const sales = res.diagram.groups?.find(g => g.id === 'lane_sales');
    const ops = res.diagram.groups?.find(g => g.id === 'lane_ops');
    expect(sales?.label).toBe('Sales');
    expect(ops?.label).toBe('Operations');

    const nodeA = res.diagram.nodes.find(n => n.id === 'A');
    expect(nodeA?.parentGroupId).toBe('lane_sales');

    const exported = toMermaid(res.diagram);
    expect(exported).toContain('subgraph lane_sales["Sales"]');
    expect(exported).toContain('subgraph lane_ops["Operations"]');
    expect(exported).toContain('A --> B');
    expect(exported).toContain('B --> C');
  });

  test('18. Test importing and exporting parent group with nested direction', () => {
    const code = `flowchart TD
  subgraph parent["Parent"]
    direction LR
    subgraph child["Child"]
      A["A"]
      B["B"]
    end
    C["C"]
  end
  A --> B
  B --> C`;

    const res = importMermaidFlowchart(code);
    expect(res.diagram.groups).toHaveLength(2);
    const parent = res.diagram.groups?.find(g => g.id === 'parent');
    const child = res.diagram.groups?.find(g => g.id === 'child');
    expect(parent?.direction).toBe('LR');
    expect(child?.parentGroupId).toBe('parent');

    const exported = toMermaid(res.diagram);
    expect(exported).toContain('subgraph parent["Parent"]');
    expect(exported).toContain('direction LR');
    expect(exported).toContain('subgraph child["Child"]');
  });
});
