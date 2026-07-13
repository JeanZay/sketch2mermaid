import { describe, expect, it } from 'vitest';
import type { CanonicalDiagram, DiagramEdge, DiagramNode, TextBox } from '../types';
import { autoLayoutDiagram, AUTO_LAYOUT_COLLISION_GAP } from './autoLayout';

function node(id: string, x = 300, y = 300, shape: DiagramNode['shape'] = 'process'): DiagramNode {
  return {
    id,
    label: id,
    shape,
    position: { x, y },
    width: 140,
    height: 56,
  };
}

function connectedEdge(id: string, from: string, to: string, exportMode: DiagramEdge['exportMode'] = 'mermaid'): DiagramEdge {
  return {
    id,
    from: { kind: 'connected', nodeId: from, handleId: null },
    to: { kind: 'connected', nodeId: to, handleId: null },
    connectionStatus: 'connected',
    exportMode,
    label: '',
    style: 'solid',
    direction: 'directed',
  };
}

function diagram(
  nodes: DiagramNode[],
  edges: DiagramEdge[] = [],
  direction: CanonicalDiagram['direction'] = 'TD',
): CanonicalDiagram {
  return {
    diagramType: 'flowchart',
    direction,
    nodes,
    edges,
    textBoxes: [],
    groups: [],
  };
}

function rectsHaveGap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap: number,
): boolean {
  return a.x + a.width + gap <= b.x
    || b.x + b.width + gap <= a.x
    || a.y + a.height + gap <= b.y
    || b.y + b.height + gap <= a.y;
}

describe('autoLayoutDiagram', () => {
  it.each([
    ['TD', 'y', 1],
    ['BT', 'y', -1],
    ['LR', 'x', 1],
    ['RL', 'x', -1],
  ] as const)('lays out a chain in %s direction', async (direction, axis, sign) => {
    const input = diagram(
      [node('A'), node('B'), node('C')],
      [connectedEdge('e1', 'A', 'B'), connectedEdge('e2', 'B', 'C')],
      direction,
    );

    const result = await autoLayoutDiagram(input);
    const positions = Object.fromEntries(result.diagram.nodes.map((item) => [item.id, item.position]));

    expect((positions.B[axis] - positions.A[axis]) * sign).toBeGreaterThan(0);
    expect((positions.C[axis] - positions.B[axis]) * sign).toBeGreaterThan(0);
    expect(result.mode).toBe('dagre-fallback');
    expect(input.nodes[0].position).toEqual({ x: 300, y: 300 });
  });

  it('keeps comment nodes, duplicate edges, styles, ids, and canvas-only edges', async () => {
    const duplicateA = connectedEdge('e1', 'A', 'B');
    const duplicateB = { ...connectedEdge('e2', 'A', 'B'), label: 'same' };
    const canvasOnly = {
      ...connectedEdge('e3', 'B', 'C', 'canvasOnly'),
      data: { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    } satisfies DiagramEdge;
    const input = diagram(
      [
        { ...node('A'), style: { backgroundColor: '#fff' } },
        node('B'),
        node('C', 500, 500, 'comment'),
      ],
      [duplicateA, duplicateB, canvasOnly],
      'LR',
    );

    const result = await autoLayoutDiagram(input);

    expect(result.diagram.nodes.map((item) => item.id)).toEqual(['A', 'B', 'C']);
    expect(result.diagram.nodes.find((item) => item.id === 'C')?.shape).toBe('comment');
    expect(result.diagram.nodes.find((item) => item.id === 'A')?.style).toEqual({ backgroundColor: '#fff' });
    expect(result.diagram.edges.map((edge) => edge.id)).toEqual(['e1', 'e2', 'e3']);
    const retainedCanvasEdge = result.diagram.edges.find((edge) => edge.id === 'e3')!;
    expect(retainedCanvasEdge.exportMode).toBe('canvasOnly');
    expect(retainedCanvasEdge.data).toBeUndefined();
    expect(retainedCanvasEdge.from.kind === 'connected' && retainedCanvasEdge.from.handleId).toMatch(/-source$/);
    expect(retainedCanvasEdge.to.kind === 'connected' && retainedCanvasEdge.to.handleId).toMatch(/-target$/);
  });

  it('keeps a text annotation near its anchor while resolving node collisions', async () => {
    const textBox: TextBox = {
      id: 'tb1',
      text: 'Note',
      position: { x: 300, y: 300 },
      width: 150,
      height: 80,
      style: {},
    };
    const input = diagram([node('A', 300, 300)]);
    input.textBoxes = [textBox];

    const result = await autoLayoutDiagram(input);
    const laidOutNode = result.diagram.nodes[0];
    const laidOutText = result.diagram.textBoxes[0];

    expect(rectsHaveGap(
      { ...laidOutNode.position, width: laidOutNode.width!, height: laidOutNode.height! },
      { ...laidOutText.position, width: laidOutText.width!, height: laidOutText.height! },
      AUTO_LAYOUT_COLLISION_GAP,
    )).toBe(true);
  });

  it('translates a fully detached arrow without changing its vector', async () => {
    const detached: DiagramEdge = {
      id: 'free',
      from: { kind: 'detached', point: { x: 300, y: 300 } },
      to: { kind: 'detached', point: { x: 420, y: 340 } },
      connectionStatus: 'detached',
      exportMode: 'canvasOnly',
      label: '',
      style: 'solid',
      direction: 'directed',
    };
    const result = await autoLayoutDiagram(diagram([node('A', 300, 300)], [detached]));
    const edge = result.diagram.edges[0];

    expect(edge.from.kind).toBe('detached');
    expect(edge.to.kind).toBe('detached');
    if (edge.from.kind === 'detached' && edge.to.kind === 'detached') {
      expect(edge.to.point.x - edge.from.point.x).toBe(120);
      expect(edge.to.point.y - edge.from.point.y).toBe(40);
    }
  });

  it('moves the loose endpoint of a partially detached arrow with its connected node', async () => {
    const partial: DiagramEdge = {
      id: 'partial',
      from: { kind: 'connected', nodeId: 'A', handleId: 'r-source' },
      to: { kind: 'detached', point: { x: 500, y: 320 } },
      connectionStatus: 'detached',
      exportMode: 'canvasOnly',
      label: '',
      style: 'solid',
      direction: 'directed',
    };
    const input = diagram([node('A', 300, 300)], [partial], 'LR');
    const oldCenter = { x: 370, y: 328 };
    const result = await autoLayoutDiagram(input);
    const laidOutNode = result.diagram.nodes[0];
    const newCenter = {
      x: laidOutNode.position.x + laidOutNode.width! / 2,
      y: laidOutNode.position.y + laidOutNode.height! / 2,
    };
    const edge = result.diagram.edges[0];

    expect(edge.to.kind).toBe('detached');
    if (edge.to.kind === 'detached') {
      expect(edge.to.point).toEqual({
        x: Math.round(500 + newCenter.x - oldCenter.x),
        y: Math.round(320 + newCenter.y - oldCenter.y),
      });
    }
  });

  it('packs a diagram made only of canvas-only objects', async () => {
    const input = diagram([], [{
      id: 'free',
      from: { kind: 'detached', point: { x: 0, y: 0 } },
      to: { kind: 'detached', point: { x: 100, y: 0 } },
      connectionStatus: 'detached',
      exportMode: 'canvasOnly',
      label: '',
      style: 'solid',
      direction: 'directed',
    }]);
    input.textBoxes = [{
      id: 'tb1',
      text: 'Only annotation',
      position: { x: 0, y: 0 },
      width: 150,
      height: 80,
      style: {},
    }];

    const result = await autoLayoutDiagram(input);
    const text = result.diagram.textBoxes[0];
    const edge = result.diagram.edges[0];
    expect(text.position).toEqual({ x: 8, y: 8 });
    if (edge.from.kind === 'detached' && edge.to.kind === 'detached') {
      const edgeRect = {
        x: Math.min(edge.from.point.x, edge.to.point.x) - 8,
        y: Math.min(edge.from.point.y, edge.to.point.y) - 8,
        width: Math.abs(edge.to.point.x - edge.from.point.x) + 16,
        height: Math.abs(edge.to.point.y - edge.from.point.y) + 16,
      };
      expect(rectsHaveGap(
        { ...text.position, width: text.width!, height: text.height! },
        edgeRect,
        AUTO_LAYOUT_COLLISION_GAP,
      )).toBe(true);
    }
  });

  it('preserves swimlane kind and lays out its children with local Dagre', async () => {
    const input = diagram(
      [{ ...node('A'), parentGroupId: 'g1' }, { ...node('B'), parentGroupId: 'g1' }],
      [connectedEdge('e1', 'A', 'B')],
      'LR',
    );
    input.groups = [{
      id: 'g1',
      kind: 'lane',
      label: 'Lane',
      position: { x: 0, y: 0 },
      width: 500,
      height: 200,
    }];

    const result = await autoLayoutDiagram(input);
    const group = result.diagram.groups![0];
    expect(group.kind).toBe('lane');
    expect(result.mode).toBe('dagre-fallback');
    expect(result.warnings).toEqual([]);
    expect(result.diagram.nodes[0].position.x).toBeLessThan(result.diagram.nodes[1].position.x);
  });
});
