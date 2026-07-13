import { beforeEach, describe, expect, it } from 'vitest';
import type { CanonicalDiagram } from '../types';
import { useDiagramStore } from '../../store/diagramStore';
import { autoLayoutDiagram } from './autoLayout';

function makeDiagram(): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction: 'LR',
    nodes: [
      { id: 'A', label: 'A', shape: 'process', position: { x: 500, y: 500 }, width: 140, height: 56 },
      { id: 'B', label: 'B', shape: 'process', position: { x: 100, y: 100 }, width: 140, height: 56 },
    ],
    edges: [{
      id: 'e1',
      from: { kind: 'connected', nodeId: 'A', handleId: null },
      to: { kind: 'connected', nodeId: 'B', handleId: null },
      connectionStatus: 'connected',
      exportMode: 'mermaid',
      label: '',
      style: 'solid',
      direction: 'directed',
    }],
    textBoxes: [],
    groups: [],
  };
}

describe('auto-layout history integration', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      diagram: makeDiagram(),
      past: [],
      future: [],
      checkpoint: null,
      selectedNodeIds: ['A'],
      selectedEdgeIds: ['e1'],
    });
  });

  it('applies as one undoable load and redo restores the layout', async () => {
    const before = structuredClone(useDiagramStore.getState().diagram);
    const result = await autoLayoutDiagram(before);

    useDiagramStore.getState().loadDiagram(result.diagram, { resetHistory: false });
    const laidOut = structuredClone(useDiagramStore.getState().diagram);

    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().selectedNodeIds).toEqual([]);
    expect(useDiagramStore.getState().selectedEdgeIds).toEqual([]);
    expect(laidOut.nodes.map((node) => node.position)).not.toEqual(before.nodes.map((node) => node.position));

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().diagram.nodes.map((node) => node.position))
      .toEqual(before.nodes.map((node) => node.position));

    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().diagram.nodes.map((node) => node.position))
      .toEqual(laidOut.nodes.map((node) => node.position));
  });
});
